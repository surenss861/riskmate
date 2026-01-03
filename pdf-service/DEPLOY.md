# Quick Deploy Guide

## Option 1: Test Locally with Docker

```bash
# Build the image
docker build -t pdf-service .

# Run the container
docker run -p 3000:3000 -e PDF_SERVICE_SECRET=your-secret-key-here pdf-service

# Test it
curl http://localhost:3000/health
```

## Option 2: Deploy to Render (Easiest - No CLI needed)

1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repo
4. Set:
   - **Name**: `pdf-service`
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Root Directory**: `pdf-service`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `pdf-service/Dockerfile`
5. Add environment variables:
   - `PDF_SERVICE_SECRET` = (generate a random secret, e.g., use `openssl rand -hex 32`)
6. Click "Create Web Service"
7. Wait for deployment (~5-10 minutes)
8. Copy the service URL (e.g., `https://pdf-service-xxxx.onrender.com`)

## Option 3: Deploy to Railway (Also Easy - No CLI needed)

1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repo
4. Railway auto-detects the Dockerfile
5. Add environment variables:
   - `PDF_SERVICE_SECRET` = (generate a random secret)
6. Deploy
7. Copy the service URL

## Option 4: Deploy to Fly.io (Requires CLI)

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch (creates fly.toml)
fly launch

# Set secret
fly secrets set PDF_SERVICE_SECRET=your-secret-key-here

# Deploy
fly deploy
```

## After Deployment

1. Get your service URL (e.g., `https://pdf-service-xxxx.onrender.com`)
2. Test health endpoint: `curl https://your-service-url/health`
3. Set in Vercel environment variables:
   - `PDF_SERVICE_URL` = `https://your-service-url`
   - `PDF_SERVICE_SECRET` = (same secret you set in the service)
4. Redeploy Vercel

