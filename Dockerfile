FROM node:20-alpine AS webbuild
WORKDIR /web
COPY astrodeck-web/package*.json ./
RUN npm ci
COPY astrodeck-web/ ./
RUN npm run build

FROM node:20-alpine AS backend
WORKDIR /app
COPY astrodeck-backend/package*.json ./
RUN npm ci --omit=dev
COPY astrodeck-backend/ ./
COPY --from=webbuild /web/dist ./public_web

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
