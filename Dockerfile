FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY bin ./bin
COPY src ./src

USER node

CMD ["node", "bin/telnet2mqtt.mjs"]
