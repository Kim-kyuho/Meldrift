FROM node:20-alpine

RUN apk add --no-cache git openssh-client

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/free/package.json ./apps/free/package.json
COPY apps/plus/package.json ./apps/plus/package.json
RUN npm ci

COPY . .

EXPOSE 3000 3001

CMD ["npm", "run", "dev"]
