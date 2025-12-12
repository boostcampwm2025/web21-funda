FROM node:lts-alpine

# pnpm 설치
RUN npm install -g pnpm

WORKDIR /app

COPY pnpm-lock.yaml ./
COPY package.json ./

COPY apps/backend/package.json ./apps/backend/

RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000

CMD ["pnpm", "dev", "--filter=backend"]
