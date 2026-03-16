FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install

COPY tsconfig.json ./
COPY src ./src

EXPOSE 3001

CMD ["npm", "run", "dev"]
