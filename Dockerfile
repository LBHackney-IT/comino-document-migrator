FROM node:gallium-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY esbuild.config.js ./
COPY src ./src

RUN npm run build


FROM node:gallium-alpine

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY package*.json ./

RUN npm ci --only=production

ENTRYPOINT ["npm", "run", "start"]
