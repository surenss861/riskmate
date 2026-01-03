#!/bin/bash
# Script to run PDF service locally with Docker

SECRET=${PDF_SERVICE_SECRET:-151bf8598584fbfe2dd4753d1fa56ec1939af8dc0efde65a83df03a357e1e0bf}
PORT=${PORT:-3000}

echo "Starting PDF service on port $PORT"
echo "Secret: ${SECRET:0:16}..."
echo ""
echo "To view logs: docker logs -f pdf-service-local"
echo "To stop: docker stop pdf-service-local"
echo "To test: curl http://localhost:$PORT/health"
echo ""

docker run -d \
  --name pdf-service-local \
  -p $PORT:3000 \
  -e PDF_SERVICE_SECRET="$SECRET" \
  -e PORT=3000 \
  pdf-service:local

