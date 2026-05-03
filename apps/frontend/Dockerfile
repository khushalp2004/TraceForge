FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json next.config.js postcss.config.js tailwind.config.ts ./
COPY next-env.d.ts ./
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY context ./context

EXPOSE 3000

CMD ["npm", "run", "dev"]
