FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY node_modules ./node_modules
COPY dist ./dist

ENV TAIGA_API_URL=http://host.docker.internal:9000/api/v1

CMD ["node", "dist/server.js"]
