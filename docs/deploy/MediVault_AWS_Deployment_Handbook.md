
# MediVault AWS Deployment Handbook
Version 1.0

> This handbook documents the complete end-to-end deployment of MediVault from a
> local development machine to AWS EC2 using Docker, Docker Hub, MongoDB,
> Nginx and S3. It also records every issue encountered and how it was solved.

# Table of Contents

1. Project Architecture
2. Deployment Roadmap
3. Prerequisites
4. Local Dockerization
5. Docker Compose Validation
6. Docker Hub Workflow
7. AWS Infrastructure
8. EC2 Provisioning
9. Security Groups
10. Elastic IP
11. S3 Bucket
12. IAM Role
13. SSH Access
14. Docker Installation
15. Swap Memory
16. Disk Expansion
17. MongoDB Deployment
18. Backend Deployment
19. Backend Environment Variables
20. Frontend Deployment
21. VITE_API_URL Explained
22. Nginx Reverse Proxy
23. Verification Checklist
24. Troubleshooting
25. Lessons Learned
26. Production Improvements
27. CI/CD Roadmap
28. Useful Commands

---

# 1. Project Architecture

```
Developer
   │
   ├── Docker Build
   ├── Docker Hub
   │
   ▼
AWS EC2
├── Nginx (80)
├── Frontend Container (8080)
├── Backend Container (4000)
└── MongoDB Container (27017)

Backend
 └── S3 Bucket (IAM Role)
```

---

# 2. Deployment Roadmap

Phase 1
- Dockerize application

Phase 2
- Verify locally using Docker Compose

Phase 3
- Publish images to Docker Hub

Phase 4
- AWS Infrastructure
  - EC2
  - Security Group
  - Elastic IP
  - S3
  - IAM

Phase 5
- Deploy containers

Phase 6
- Configure Nginx

Phase 7
- CI/CD

---

# 3. Prerequisites

- Docker Desktop
- Git
- GitHub repository
- Docker Hub account
- AWS account
- SSH key pair

Verify:

```bash
docker --version
git --version
```

---

# 4. Local Dockerization

Files created:

- apps/backend/Dockerfile
- apps/frontend/Dockerfile
- docker-compose.yml
- .dockerignore

Verification:

```bash
docker compose build
docker compose up -d
docker compose ps
curl http://localhost:4000/health
```

Expected:
- Backend healthy
- Frontend healthy
- MongoDB healthy

---

# 5. Database Seeding

```bash
docker compose exec backend node scripts/seedDemoData.js
```

---

# 6. Docker Hub

Username:

```
devam246
```

Tag:

```bash
docker tag my-react-app-backend:latest devam246/medivault-backend:v1.0.0
docker tag my-react-app-frontend:latest devam246/medivault-frontend:v1.0.0
```

Push:

```bash
docker push devam246/medivault-backend:v1.0.0
docker push devam246/medivault-frontend:v1.0.0
```

Always verify:

```bash
docker pull devam246/medivault-backend:v1.0.0
docker pull devam246/medivault-frontend:v1.0.0
```

---

# 7. AWS Infrastructure

EC2:
- Ubuntu LTS
- t3.micro (Free Tier)
- 20 GB gp3

Elastic IP:
- Attach after launch.

Security Group:
- SSH 22
- HTTP 80
- HTTPS 443

Temporary during deployment:
- TCP 4000
- TCP 8080

S3 Bucket:
- medivault-uploads-devam

IAM:
- EC2 role with S3 access.

---

# 8. SSH

```bash
ssh -i medivault-key.pem ubuntu@<elastic-ip>
```

Common issue:

Timeout

Cause:
- Security Group
- Wrong IP
- Instance not running

---

# 9. Docker on EC2

```bash
sudo apt update
sudo apt install docker.io -y
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ubuntu
```

Reconnect afterwards.

---

# 10. Swap

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Purpose:
- Prevent OOM on t3.micro.

---

# 11. Disk Expansion

Problem:

```
no space left on device
```

Solution:

Increase EBS volume to 20 GB.

Linux:

```bash
sudo apt install cloud-guest-utils -y
sudo growpart /dev/nvme0n1 1
sudo resize2fs /dev/nvme0n1p1
df -h
```

---

# 12. MongoDB

```bash
mkdir -p ~/mongo-data

docker run -d --name mongodb --restart always -p 27017:27017 -v ~/mongo-data:/data/db mongo:6-jammy
```

---

# 13. Backend

Repository:

https://github.com/Devam246/medivault

Run:

```bash
docker run -d --name medivault-backend --restart always --link mongodb:mongodb -p 4000:4000 --env-file ~/my-react-app/apps/backend/.env devam246/medivault-backend:v1.0.0
```

Health:

```bash
curl http://localhost:4000/health
```

---

# 14. Backend Environment

Required variables include:

- NODE_ENV
- PORT
- FRONTEND_URL
- JWT_SECRET
- DATA_STORE
- MONGO_URI
- MONGO_DB_NAME
- AWS_REGION
- S3_BUCKET_NAME
- SEPOLIA_RPC_URL
- CONTRACT_ADDRESS
- CONTRACT_ABI_JSON
- PRIVATE_KEY
- GROQ_API_KEY

---

# 15. Frontend

Problem encountered:

```
VITE_API_URL=http://localhost:4000
```

Reason:

Browser localhost != EC2 localhost.

Solution:

```bash
docker build -f apps/frontend/Dockerfile --build-arg VITE_API_URL=http://<elastic-ip>:4000 -t devam246/medivault-frontend:v1.0.1 .
```

---

# 16. Nginx

Install:

```bash
sudo apt install nginx -y
```

Validate:

```bash
sudo nginx -t
sudo systemctl restart nginx
```

Goal:

Port 80 -> Frontend

Eventually proxy backend routes instead of exposing port 4000.

---

# 17. Verification Checklist

- Docker running
- MongoDB connected
- Backend healthy
- Frontend accessible
- Nginx active
- Images available on Docker Hub
- EC2 reachable
- S3 accessible

---

# 18. Troubleshooting

## SSH timeout
Fix security group and Elastic IP.

## Docker login failed

```bash
docker login -u devam246
```

## Push access denied

Not authenticated.

## Docker daemon unavailable

Start Docker Desktop / Docker service.

## Frontend cannot reach backend

Wrong VITE_API_URL.

## no space left on device

Expand EBS and resize filesystem.

## docker-compose version warning

Remove obsolete version key.

## Nginx config

Always validate:

```bash
sudo nginx -t
```

---

# 19. Best Practices

- Build locally or in CI.
- Push immutable version tags.
- Verify with docker pull.
- Never expose MongoDB publicly.
- Keep SSH restricted.
- Prefer IAM Roles over access keys.
- Add health endpoints.
- Use Nginx for reverse proxy.
- Use relative API paths in future.

---

# 20. Future Improvements

- HTTPS (Let's Encrypt)
- Custom Domain
- Route53
- CloudWatch
- AWS Secrets Manager
- GitHub Actions
- Blue/Green deployment
- Amazon ECR
- ECS/Fargate
- Automated backups

---

# 21. Useful Commands

Docker:

```bash
docker ps
docker logs <container>
docker images
docker pull
docker push
docker exec -it <container> sh
```

Nginx:

```bash
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl status nginx
```

Disk:

```bash
df -h
lsblk
docker system df
```

Network:

```bash
curl http://localhost:4000/health
curl http://localhost
```

---

# Final Notes

This handbook captures the deployment journey from local Docker development to a working AWS-hosted application.

When rebuilding:
1. Complete infrastructure first.
2. Verify every phase before moving on.
3. Deploy immutable Docker images.
4. Test backend before frontend.
5. Put Nginx in front of the application.
6. Automate deployments with GitHub Actions.
