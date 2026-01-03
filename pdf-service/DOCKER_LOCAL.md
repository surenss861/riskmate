# Running PDF Service Locally with Docker

## Quick Start

```bash
cd pdf-service
./docker-run.sh
```

This will:
- Build the Docker image (if not already built)
- Start the container on port 3000
- Set the required environment variables

## Useful Commands

### View Logs
```bash
# Follow logs in real-time
docker logs -f pdf-service-local

# View last 50 lines
docker logs --tail 50 pdf-service-local
```

### Stop the Service
```bash
docker stop pdf-service-local
```

### Start the Service (if stopped)
```bash
docker start pdf-service-local
```

### Restart the Service
```bash
docker restart pdf-service-local
```

### Remove the Container
```bash
docker stop pdf-service-local
docker rm pdf-service-local
```

### Rebuild and Run
```bash
# Rebuild the image
docker build -t pdf-service:local .

# Remove old container (if exists)
docker stop pdf-service-local 2>/dev/null
docker rm pdf-service-local 2>/dev/null

# Run again
./docker-run.sh
```

## Testing

### Health Check
```bash
curl http://localhost:3000/health
```

### Test PDF Generation
```bash
node test-auth.js 151bf8598584fbfe2dd4753d1fa56ec1939af8dc0efde65a83df03a357e1e0bf http://localhost:3000
```

Or update the test script to use localhost:
```bash
PDF_SERVICE_URL=http://localhost:3000 node test-auth.js
```

## Using with Your Vercel App

To test your Vercel app against the local PDF service:

1. Update your `.env.local`:
```env
PDF_SERVICE_URL=http://localhost:3000
PDF_SERVICE_SECRET=151bf8598584fbfe2dd4753d1fa56ec1939af8dc0efde65a83df03a357e1e0bf
```

2. Make sure your Vercel app can reach `localhost:3000` (or use a tunnel like ngrok)

## Container Status

Check if the container is running:
```bash
docker ps --filter name=pdf-service-local
```

View container stats:
```bash
docker stats pdf-service-local
```

## Troubleshooting

### Port Already in Use
If port 3000 is already in use, change the port:
```bash
PORT=3001 ./docker-run.sh
```

Then access at `http://localhost:3001`

### Container Won't Start
Check logs for errors:
```bash
docker logs pdf-service-local
```

### Rebuild from Scratch
```bash
docker stop pdf-service-local
docker rm pdf-service-local
docker rmi pdf-service:local
docker build -t pdf-service:local .
./docker-run.sh
```

