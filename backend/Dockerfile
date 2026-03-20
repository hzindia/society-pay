FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --omit=dev

# Generate Prisma client
RUN npx prisma generate

# Copy source
COPY . .

EXPOSE 4000

# Run migrations and start
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
