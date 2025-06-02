# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# First create package-lock.json
RUN npm install --package-lock-only

# Then install dependencies
RUN npm ci --omit=dev

# Copy application files
COPY . .

# Expose port
EXPOSE 3000

# Set default environment variables
ENV ALLOWED_ORIGINS=http://localhost:3000,chrome-extension://your-extension-id \
    PORT=3000 \
    NODE_ENV=development \
    RATE_LIMIT_WINDOW_MS=900000 \
    RATE_LIMIT_MAX_REQUESTS=100

# Start the application
CMD ["node", "server.js"] 