FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
COPY scripts ./scripts
RUN mkdir -p media && chown -R node:node /app
USER node
EXPOSE 4000
CMD ["node", "src/server.js"]
