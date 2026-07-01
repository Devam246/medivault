
# later.md
# MediVault - Remaining Production Tasks

This document tracks the remaining work after completing the AWS deployment.

Status: **Application successfully deployed on AWS EC2**

---

# ✅ Completed

- Dockerized backend and frontend
- Docker Compose setup
- Local Docker verification
- Database seeding
- Docker Hub images
- EC2 provisioning
- Elastic IP
- Security Group
- IAM Role
- S3 Bucket
- MongoDB deployment
- Backend deployment
- Frontend deployment
- Root disk expansion (20 GB)
- Swap configuration
- Nginx installation
- Application accessible on AWS

---

# 🚀 Phase 7 — CI/CD (Next Session)

## Goal

Every push to `main` should automatically deploy the application.

Pipeline:

Developer
↓
git push origin main
↓
GitHub Actions
↓
Build Docker Images
↓
Push Docker Hub
↓
SSH into EC2
↓
Pull latest images
↓
Restart containers

---

## 1. Create Docker Hub Access Token

Docker Hub
→ Account Settings
→ Personal Access Tokens

Permissions:
- Read
- Write
- Delete

---

## 2. GitHub Repository Secrets

Create:

- DOCKERHUB_USERNAME
- DOCKERHUB_TOKEN
- EC2_HOST
- EC2_USERNAME
- EC2_SSH_KEY

---

## 3. GitHub Workflow

Create:

.github/workflows/deploy.yml

Workflow should:

- Checkout repository
- Login to Docker Hub
- Build backend image
- Push backend image
- Build frontend image
- Push frontend image
- SSH into EC2
- Pull latest images
- Restart containers
- Verify deployment

---

# Production Improvements

## Remove public ports

Currently:

- 4000
- 8080

After frontend uses relative API routes:

Remove:

- TCP 4000
- TCP 8080

Keep only:

- SSH (22)
- HTTP (80)
- HTTPS (443)

---

## Frontend

Current:

VITE_API_URL=http://<elastic-ip>:4000

Future:

Use relative routes and let Nginx proxy backend requests.

Benefits:

- No frontend rebuild when IP/domain changes
- Better production architecture
- Backend remains private

---

## HTTPS

When a domain is available:

- Purchase/connect domain
- Point DNS to Elastic IP
- Install Certbot
- Enable HTTPS
- Redirect HTTP → HTTPS

---

## Monitoring

- CloudWatch
- Docker logs
- Health endpoint monitoring
- Disk usage alerts

---

## Security

- AWS Secrets Manager / SSM Parameter Store
- Principle of least privilege for IAM
- Rotate secrets
- Enable EBS encryption if needed

---

## Backups

MongoDB:

- mongodump
- Upload to S3
- Automate with cron

---

## Future AWS Improvements

- Amazon ECR
- ECS/Fargate
- Load Balancer
- Auto Scaling
- Route53
- CloudFront
- Blue/Green Deployments

---

# Before Next Session

Have ready:

- Docker Hub Access Token
- GitHub Secrets
- Repository admin access

Then we'll complete the CI/CD pipeline end-to-end.

Estimated time: 45–60 minutes.
