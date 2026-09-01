# Use official Node.js 22 LTS image (matches better-sqlite3 >= 22 engine requirement)
FROM node:22-slim AS base

# Install build dependencies for better-sqlite3 native bindings
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Ensure data directory exists for SQLite database storage
RUN mkdir -p /app/data

# Set environment variables
ENV NODE_ENV=production
ENV DB_PATH=/app/data/bot.sqlite

# Run the bot
CMD ["node", "src/index.js"]
