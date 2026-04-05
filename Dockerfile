FROM node:20-alpine
WORKDIR /app
COPY api/package.json ./
RUN npm install --omit=dev
COPY api/index.js ./
COPY dashboard/ ./dashboard/
EXPOSE 3001
CMD ["node", "index.js"]
