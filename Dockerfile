FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app source
COPY . .

# Create data directory
RUN mkdir -p /app/data/uploads

# Expose port
EXPOSE 3000

# Set environment variable for data directory
ENV DATA_DIR=/app/data

# Run the application
CMD ["node", "server.js"]