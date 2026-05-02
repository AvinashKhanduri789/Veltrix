FROM node:20-alpine

WORKDIR /app

COPY gateway_service/package*.json ./
RUN npm install --production

COPY gateway_service/ .
COPY proto /proto

EXPOSE 8080

CMD ["node", "src/index.js"]