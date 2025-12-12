FROM node:lts-alpine

# pnpm 설치
RUN npm install -g pnpm

WORKDIR /app

# 루트 pnpm-lock.yaml과 package.json 복사 (캐시 효율성)
COPY pnpm-lock.yaml ./
COPY package.json ./

# 각 앱의 package.json 복사
COPY apps/frontend/package.json ./apps/frontend/

# 의존성 설치
RUN pnpm install 

# 전체 파일 복사
COPY . .

EXPOSE 5173

CMD ["pnpm", "run", "dev", "--filter=frontend", "--", "--host"]