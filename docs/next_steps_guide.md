# MediVault — Production Deployment Next Steps Guide

This step-by-step checklist outlines exactly what is left for you to execute to verify and launch MediVault.

---

## Step 1: Verify Locally via Docker Compose

1. **Launch Docker Desktop** on your local machine.
2. Open **PowerShell** in the project root (`C:\Base\my-react-app`) and run:
   ```powershell
   # Boot all containers in detached mode
   docker-compose up -d --build
   ```
3. Verify that the containers are healthy:
   ```powershell
   docker-compose ps
   ```
4. Test the backend health endpoint:
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:4000/health"
   ```
   *(Should return `{"status":"ok"}`)*
5. Open your browser and go to `http://localhost/` to access the MediVault frontend dashboard.

---

## Step 2: Set Up AWS Infrastructure

1. **Provision EC2 Instance**:
   - Launch an EC2 Instance (Recommended: `t3.medium`, Ubuntu Server 22.04 LTS).
   - Configure the EC2 Security Group to open port `22` (SSH), port `80` (HTTP), and port `443` (HTTPS) to the public.
2. **Create S3 Bucket**:
   - Create an Amazon S3 Bucket named `medivault-uploads-prod` in your AWS region.
   - Attach an IAM Instance Profile (IAM Role) to your EC2 instance containing read/write permissions to the S3 bucket:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Action": [
             "s3:PutObject",
             "s3:GetObject",
             "s3:DeleteObject"
           ],
           "Resource": "arn:aws:s3:::medivault-uploads-prod/*"
         }
       ]
     }
     ```

---

## Step 3: Run the Application on AWS EC2

1. **SSH into the EC2 Instance**:
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip
   ```
2. **Install Docker**:
   ```bash
   sudo apt-get update && sudo apt-get install -y docker.io docker-compose
   sudo systemctl start docker && sudo systemctl enable docker
   sudo usermod -aG docker ubuntu
   # Exit and reconnect to apply group permissions
   exit
   ```
3. **Start MongoDB Container**:
   ```bash
   mkdir -p ~/mongo-data
   docker run -d \
     --name mongodb \
     --restart always \
     -p 27017:27017 \
     -v ~/mongo-data:/data/db \
     mongo:6-jammy
   ```
4. **Copy Code & Setup Environments**:
   - Clone your repository onto the EC2 instance or copy the repository files.
   - Create `apps/backend/.env` on the EC2 server and populate with production values.
5. **Run the Backend Container**:
   ```bash
   docker build -f apps/backend/Dockerfile -t medivault-backend:latest .
   
   docker run -d \
     --name medivault-backend \
     --restart always \
     -p 4000:4000 \
     --link mongodb:mongodb \
     -e NODE_ENV=production \
     -e DATA_STORE=mongo \
     -e MONGO_URI=mongodb://mongodb:27017/medivault \
     -e MONGO_DB_NAME=medivault \
     -e S3_BUCKET_NAME=medivault-uploads-prod \
     -e AWS_REGION=us-east-1 \
     -e FRONTEND_URL=https://medivault.yourdomain.com \
     --env-file apps/backend/.env \
     medivault-backend:latest
   ```
6. **Run the Frontend Container**:
   ```bash
   docker build -f apps/frontend/Dockerfile \
     --build-arg VITE_API_URL=https://api.medivault.yourdomain.com \
     -t medivault-frontend:latest .

   docker run -d \
     --name medivault-frontend \
     --restart always \
     -p 8080:80 \
     medivault-frontend:latest
   ```

---

## Step 4: Configure Domain, Nginx & SSL Certs

1. Install **Nginx** and **Certbot** natively on the EC2 host:
   ```bash
   sudo apt-get install -y nginx certbot python3-certbot-nginx
   ```
2. Create Nginx server block config at `/etc/nginx/sites-available/medivault`:
   ```nginx
   server {
       listen 80;
       server_name medivault.yourdomain.com api.medivault.yourdomain.com;

       location / {
           if ($host = "api.medivault.yourdomain.com") {
               proxy_pass http://127.0.0.1:4000;
           }
           if ($host = "medivault.yourdomain.com") {
               proxy_pass http://127.0.0.1:8080;
           }
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
3. Enable and restart Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/medivault /etc/nginx/sites-enabled/
   sudo systemctl restart nginx
   ```
4. Acquire free SSL Certificates:
   ```bash
   sudo certbot --nginx -d medivault.yourdomain.com -d api.medivault.yourdomain.com
   ```

---

## Step 5: Enable CI/CD Pipeline

1. **Commit Workflow**:
   - Create a file at `.github/workflows/deploy.yml` and copy the GitHub Action workflow definition from [v2.0_implementation_guide.md](file:///c:/Base/my-react-app/docs/v2.0_implementation_guide.md).
2. **Set Repository Secrets**:
   - Go to your GitHub Repository -> Settings -> Secrets and variables -> Actions.
   - Add `EC2_HOST` (IP of your EC2 instance).
   - Add `EC2_SSH_KEY` (The contents of your AWS private key `.pem` file).
3. **Deploy**: Push changes to `main` branch to trigger the pipeline automatically.
