FROM node:22-bookworm-slim
WORKDIR /bot
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.mjs config.mjs ./
USER node
CMD ["node", "index.mjs"]
