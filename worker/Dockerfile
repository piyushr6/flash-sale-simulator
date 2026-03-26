FROM node:18-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY worker.js ./

# No port needed — this is a background queue worker
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD pgrep -f "node worker.js" || exit 1

CMD ["node", "worker.js"]
