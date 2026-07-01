FROM node:20-bullseye-slim

# Install Python and build tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root package files and backend workspace package files
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/

# Install backend dependencies using npm workspaces
RUN npm ci --omit=dev --workspace=apps/backend

# Copy Python requirements
COPY apps/rag-service/requirements.txt ./apps/rag-service/

# Install Python packages
RUN pip3 install --no-cache-dir -r apps/rag-service/requirements.txt

# Copy backend source
COPY apps/backend/src/ ./apps/backend/src/
COPY apps/backend/scripts/ ./apps/backend/scripts/
COPY apps/backend/migrations/ ./apps/backend/migrations/

# Copy RAG service
COPY apps/rag-service/ ./apps/rag-service/

# Change working directory
WORKDIR /app/apps/backend

# Expose backend port
EXPOSE 4000

ENV PORT=4000 \
    NODE_ENV=production \
    PYTHON_PATH=python3

CMD ["node", "src/server.js"]