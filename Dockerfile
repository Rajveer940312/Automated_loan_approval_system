# --- STAGE 1: Build the Next.js Frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- STAGE 2: Build the Python Backend ---
FROM python:3.11-slim
WORKDIR /app

# Install backend dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy backend code and model
COPY backend/app.py backend/model.joblib ./backend/
COPY backend/check_audit.py ./backend/
COPY backend/data_prep_and_train.py ./backend/

# Copy built frontend from Stage 1 into the backend's static directory
COPY --from=frontend-builder /app/frontend/out ./backend/static

# Expose the API port
EXPOSE 8000

# Set working directory to backend for execution
WORKDIR /app/backend

# Command to run the application using Uvicorn
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
