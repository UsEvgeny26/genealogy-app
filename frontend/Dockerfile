# frontend/Dockerfile
# --- Этап сборки ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

ARG INTERNAL_API_URL=http://backend:8000
ENV INTERNAL_API_URL=$INTERNAL_API_URL

RUN npm run build

# --- Этап запуска ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Копируем только необходимые файлы из этапа сборки
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]