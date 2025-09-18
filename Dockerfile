FROM node:20-slim

WORKDIR /usr/src/app

# Install OpenSSL, a dependency for Prisma
RUN apt-get update && apt-get install -y openssl

# Copy package.json and prisma schema first to leverage Docker cache
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

# Then copy the rest of the source code
COPY . .

# Prisma generate is now handled by postinstall script
# RUN npx prisma generate

# CMD is now handled by docker-compose
# CMD ["npm", "run", "start:dev"]
