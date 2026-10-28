FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:standalone

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 ASSET_DIR=/app/client
COPY --from=build --chown=node:node /app/standalone/client ./client
COPY --from=build --chown=node:node /app/standalone/server.mjs ./server.mjs
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
