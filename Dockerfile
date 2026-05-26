# Stage 1: Build dependencies
FROM node:18-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Stage 2: Production image
FROM node:18-alpine

WORKDIR /app
COPY --from=build /app /app
EXPOSE 3000

CMD ["npm", "run", "dev"]
