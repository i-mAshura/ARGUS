FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source
COPY src/ src/
COPY public/ public/
COPY vite.config.js index.html ./

# Expose port
EXPOSE 3000

# Run dev server
CMD ["npm", "run", "dev", "--", "--host"]
