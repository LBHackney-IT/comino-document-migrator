FROM node:gallium-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY src ./src

ENTRYPOINT ["node", "src/index.js"]
