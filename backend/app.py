from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd
import numpy as np
import shap 
import sqlite3 
import json
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# --- Configuration ---
MODEL_FILE = "model.joblib"
# Define the institutional risk policy threshold (50% chance of default or higher is rejection)
RISK_THRESHOLD = 0.50 
DATABASE_FILE = "audit.db"

# Initialize FastAPI app
app = FastAPI(title="FinTech-Approve: Loan Approval Prediction API")

# Enable CORS (Allows frontend to communicate with this API)
app.add_middleware(
    CORSMiddleware,
    # Use specific origins for robustness, including common development addresses
    allow_origins=[
        "http://localhost:3000",      # Development frontend
        "http://localhost:8000",      # Docker container (local build)
        "http://127.0.0.1:3000",      # Local development
        "http://127.0.0.1:8000",      # Local development backend
    ], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database Initialization and Logging Functions ---

def init_db():
    """Initializes the SQLite database and creates the audit table if it doesn't exist."""
    try:
        conn = sqlite3.connect(DATABASE_FILE)
        cursor = conn.cursor()
        
        # Table schema to store decision details and XAI reasons
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS loan_audits (
                timestamp TEXT,
                loan_approval TEXT,
                approval_probability REAL,
                input_data TEXT,           -- Original JSON input data
                risk_drivers_json TEXT     -- XAI drivers stored as JSON string
            )
        """)
        conn.commit()
        conn.close()
        print(f"Database {DATABASE_FILE} initialized successfully.")
    except sqlite3.Error as e:
        print(f"Error initializing database: {e}")

# Run initialization once on server startup
init_db()

def log_audit_entry(input_data: dict, loan_approval: str, proba: float, risk_drivers: list):
    """Saves a single decision record to the audit table."""
    try:
        conn = sqlite3.connect(DATABASE_FILE)
        cursor = conn.cursor()
        
        # Convert complex objects to JSON strings for storage
        input_data_json = json.dumps(input_data)
        risk_drivers_json = json.dumps(risk_drivers)
        
        timestamp = pd.Timestamp.now().isoformat()
        
        cursor.execute("""
            INSERT INTO loan_audits (timestamp, loan_approval, approval_probability, input_data, risk_drivers_json)
            VALUES (?, ?, ?, ?, ?)
        """, (timestamp, loan_approval, proba, input_data_json, risk_drivers_json))
        
        conn.commit()
        conn.close()
    except sqlite3.Error as e:
        print(f"Error logging audit entry: {e}")

# --- Model Loading and Initialization ---
try:
    model_data = joblib.load(MODEL_FILE)
    pipeline = model_data["pipeline"]
    features = model_data["features"]
    
    # ----------------------------------------------------------------------------------
    # --- ROBUST SHAP FIX: Use PermutationExplainer on Transformed Data ---
    
    # 1. Extract the actual classifier model from the pipeline
    classifier = pipeline.named_steps['classifier']
    preprocessor = pipeline.named_steps['preprocessor']

    # 2. Get the transformed feature names
    # This is complex, but generally the input features plus the OHE columns.
    ohe_feature_names = list(preprocessor.named_transformers_['cat'].named_steps['onehot'].get_feature_names_out(model_data['categorical_features']))
    
    # Assuming 'numeric_features' is available in model_data (standard practice)
    transformed_feature_names = model_data['numeric_features'] + list(ohe_feature_names)
    
    # 3. Create a stable background set by transforming the dummy data once
    # We transform the *dummy* background data used previously to ensure correct SHAP dimensions.
    background_data_dict = {
        'no_of_dependents': [0.0], 'education': ['Graduate'], 'self_employed': ['No'],    
        'income_annum': [0.0], 'loan_amount': [0.0], 'loan_term': [0.0], 
        'cibil_score': [0.0], 'residential_assets_value': [0.0], 'commercial_assets_value': [0.0], 
        'luxury_assets_value': [0.0], 'bank_asset_value': [0.0]
    }
    background_df_raw = pd.DataFrame(background_data_dict)[features]
    
    # We only use the transformed data for the explainer's reference
    transformed_background = preprocessor.transform(background_df_raw)

    # 4. Define the SHAP prediction function to run ONLY the classifier
    def classifier_prediction_function(X_transformed):
        # We need to return the probability for the positive class (index 1)
        return classifier.predict_proba(X_transformed)[:, 1]

    # 5. Initialize the Explainer
    # Use the PermutationExplainer, which is more robust for tabular models.
    explainer = shap.PermutationExplainer(
        classifier_prediction_function, 
        transformed_background # Explainer now works on the numpy array output of the preprocessor
    )
    
    print(f"Model and SHAP Explainer loaded successfully. Transformed Features: {len(transformed_feature_names)}")
    
    # ----------------------------------------------------------------------------------
    
except Exception as e:
    print(f"Error loading model or initializing SHAP: {e}")
    pipeline = None
    features = []
    # If SHAP fails, define a generic list of feature names to prevent a crash later
    transformed_feature_names = [] 

# Define input schema (UNCHANGED)
class LoanInput(BaseModel):
    # Set to float to match the numerical treatment in the ML pipeline
    no_of_dependents: float 
    education: str
    self_employed: str
    income_annum: float
    loan_amount: float
    loan_term: float
    cibil_score: float
    residential_assets_value: float
    commercial_assets_value: float
    luxury_assets_value: float
    bank_asset_value: float

# Prediction endpoint
@app.post("/predict")
def predict_loan(data: LoanInput):
    if pipeline is None:
        return {"error": "Model not loaded. Check server logs."}
        
    # Get dictionary of input data
    input_data_dict = data.dict()
    df = pd.DataFrame([input_data_dict])[features]

    # Get prediction probability (P(Approval) at index [1])
    proba = pipeline.predict_proba(df)[0][1] if hasattr(pipeline, "predict_proba") else None
    
    # 1. Apply Decision Logic (Configurable Business Rule Engine)
    if proba is None:
        loan_approval = "Error"
    # FIX: If P(Approval) is greater than or equal to threshold, APPROVE.
    elif proba >= RISK_THRESHOLD:
        loan_approval = "Approved"
    # Otherwise, REJECT.
    else:
        loan_approval = "Rejected"

    # 2. Calculate Explainable AI (XAI) - SHAP Values (MODIFIED CALL)
    
    # Transform the single input instance using the fitted preprocessor 
    X_transformed = preprocessor.transform(df) 
    
    # Calculate SHAP values on the transformed input using the specialized explainer
    # We use the transformed_feature_names to map the results back correctly
    shap_values = explainer.shap_values(X_transformed)[0] # [0] extracts the result for the single row
    
    # Combine transformed feature names with their SHAP values
    feature_contributions = list(zip(transformed_feature_names, shap_values))
    
    # Sort contributions by absolute value to find the top 5 drivers
    sorted_contributions = sorted(feature_contributions, key=lambda x: abs(x[1]), reverse=True)
    
    # Format top 5 drivers for the frontend
    risk_drivers = []
    for feature, contribution in sorted_contributions[:5]:
        # Clean up feature name (handles OHE names like 'education_Graduate')
        clean_feature = feature.replace('_', ' ').title().replace('Graduate', 'Education: Graduate')
        
        risk_drivers.append({
            "feature": clean_feature,
            "contribution_score": float(contribution),
            "effect": "Support Rejection" if contribution > 0 else "Support Approval"
        })

    # 3. LOG THE AUDIT ENTRY (Crucial for Synopsis Compliance)
    log_audit_entry(
        input_data=data.dict(),
        loan_approval=loan_approval,
        proba=proba,
        risk_drivers=risk_drivers
    )

    # 4. Return Full, Structured Response to Frontend 
    return {
        "loan_approval": loan_approval,
        "approval_probability": round(float(proba), 3) if proba is not None else None,
        "risk_drivers": risk_drivers 
    }

# Optional: basic health check route (EXISTING)
@app.get("/health")
def health():
    return {"message": "FinTech-Approve API is running. Model ready."}

# Mount the static files (built Next.js frontend)
# We assume the 'static' directory contains the exported Next.js files
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    # Only mount subdirectories if they actually exist
    next_static = os.path.join(static_dir, "_next")
    if os.path.exists(next_static):
        app.mount("/_next", StaticFiles(directory=next_static), name="next_static")
    
    images_static = os.path.join(static_dir, "images")
    if os.path.exists(images_static):
        app.mount("/images", StaticFiles(directory=images_static), name="images_static")
    # Add other static mounts if needed (e.g., manifest.json, icons)

@app.get("/{rest_of_path:path}")
async def serve_frontend(rest_of_path: str):
    # Try to serve a specific file if it exists in the static directory
    file_path = os.path.join(static_dir, rest_of_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    # Default to serving index.html for all other routes (SPA behavior)
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Static files not found. Please build the frontend."}
