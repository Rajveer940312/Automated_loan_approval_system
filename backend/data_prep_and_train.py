import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.svm import SVC
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
import joblib
import os

CSV_PATH = os.path.join(os.path.dirname(__file__), 'loan_approval_dataset.csv')
TARGET = 'loan_status'
MODEL_OUT = 'model.joblib'
RANDOM_STATE = 42

# --- Load dataset ---
df = pd.read_csv(CSV_PATH)
df.columns = [c.strip().lower() for c in df.columns]

# Convert labels Approved/Rejected to numeric
df[TARGET] = df[TARGET].str.strip().str.lower().map({'approved': 1, 'rejected': 0})
df = df.dropna(subset=[TARGET])

# Numeric columns
numeric_features = [
    'no_of_dependents', 'income_annum', 'loan_amount', 'loan_term', 'cibil_score',
    'residential_assets_value', 'commercial_assets_value', 'luxury_assets_value', 'bank_asset_value'
]

# Convert numeric columns safely
for col in numeric_features:
    df[col] = pd.to_numeric(df[col], errors='coerce')

# Categorical columns
categorical_features = ['education', 'self_employed']

# Exclude loan_id and target from features
features = [c for c in df.columns if c not in ['loan_id', TARGET]]

# Preprocessing
num_transformer = Pipeline(steps=[
    ('imputer', SimpleImputer(strategy='median')),
    ('scaler', StandardScaler())
])

cat_transformer = Pipeline(steps=[
    ('imputer', SimpleImputer(strategy='most_frequent')),
    ('onehot', OneHotEncoder(handle_unknown='ignore'))
])

preprocessor = ColumnTransformer(transformers=[
    ('num', num_transformer, numeric_features),
    ('cat', cat_transformer, categorical_features)
])


X = df[features]
y = df[TARGET].astype(int)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y if len(y.unique()) > 1 else None
)
# Define models
models = {
    "RandomForest": RandomForestClassifier(n_estimators=200, random_state=RANDOM_STATE),
    "LogisticRegression": LogisticRegression(max_iter=1000),
    "DecisionTree": DecisionTreeClassifier(random_state=RANDOM_STATE),
    "KNN": KNeighborsClassifier(),
    "SVM": SVC()
}
best_model = None
best_score = 0
best_name = ""

for name, model in models.items():
    pipe = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('classifier', model)
    ])
    
    pipe.fit(X_train, y_train)
    preds = pipe.predict(X_test)
    acc = accuracy_score(y_test, preds)
    
    print(f"{name} Accuracy: {acc:.4f}")
    
    if acc > best_score:
        best_score = acc
        best_model = pipe
        best_name = name

print("\n✅ Best Model:", best_name)
print("Best Accuracy:", best_score)

# Final clf
clf = best_model

clf.fit(X_train, y_train)

preds = clf.predict(X_test)

print('Accuracy:', accuracy_score(y_test, preds))
print('\nClassification Report:\n', classification_report(y_test, preds))
print('\nConfusion Matrix:\n', confusion_matrix(y_test, preds))

joblib.dump({
    'pipeline': clf,
    'model_name': best_name,
    'features': features,
    'numeric_features': numeric_features,
    'categorical_features': categorical_features
}, MODEL_OUT)