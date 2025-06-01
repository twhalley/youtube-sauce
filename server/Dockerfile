# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create volume for logs
VOLUME [ "/usr/src/app/logs" ]

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"] 