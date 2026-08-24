FROM node:20-alpine AS base

RUN apk add --no-cache git openssh-client

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000
