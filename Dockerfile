FROM node:26-alpine3.23
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 5000

CMD ["node", "dist/server.js"]