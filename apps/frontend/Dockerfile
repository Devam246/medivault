# Stage 1: Build Vite static assets
FROM node:20-alpine AS builder
WORKDIR /app

# Accept VITE_API_URL as a build argument so the correct backend URL is baked in at build time
ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=$VITE_API_URL

# Copy workspace package files for layer caching
COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/

# Install only frontend workspace dependencies
RUN npm ci --workspace=apps/frontend

# Copy frontend source
COPY apps/frontend/ ./apps/frontend/

# Build Vite application — produces apps/frontend/dist/
RUN npm run build --workspace=apps/frontend

# Stage 2: Serve with Nginx
FROM nginx:1.25-alpine

# Copy Nginx SPA config
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from Stage 1
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
