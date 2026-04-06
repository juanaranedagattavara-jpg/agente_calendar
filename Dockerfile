FROM node:20-alpine
RUN apk add --no-cache curl && npm install -g pnpm
WORKDIR /app
COPY api/package.json ./
RUN pnpm install --prod
COPY api/index.js ./
COPY dashboard/ ./dashboard/
EXPOSE 3001
CMD ["node", "index.js"]
