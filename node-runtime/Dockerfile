FROM node:20-slim

RUN useradd -m -u 10001 executor

WORKDIR /app

COPY node-runtime/package*.json ./
RUN npm install --omit=dev


COPY node-runtime/app ./app


COPY proto ./proto

RUN mkdir -p /tmp/executions && chown -R executor:executor /tmp/executions

USER executor

ENV NODE_ENV=production

EXPOSE 50052

CMD ["node", "app/server.js"]