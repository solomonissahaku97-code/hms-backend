FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY app/ ./app/
EXPOSE 3011
CMD ["node", "app/server.js"]
