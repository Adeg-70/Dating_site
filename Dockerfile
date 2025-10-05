# Use official Node.js runtime
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install dependencies
RUN npm install --production --prefix server

# Copy application code
COPY . .

# Create non-root user
RUN adduser -D appuser && chown -R appuser /app
USER appuser

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Start application
CMD ["npm", "run", "start:prod", "--prefix", "server"]