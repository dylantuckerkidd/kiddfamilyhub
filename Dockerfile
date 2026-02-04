FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Build client and server
RUN npm run build

# Create data directory
RUN mkdir -p /app/server/data

EXPOSE 3000

CMD ["npm", "start"]
