FROM node:20-bookworm AS frontend-builder
WORKDIR /app
COPY package.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm install
COPY frontend frontend
RUN npm --workspace frontend run build

FROM node:20-bookworm
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm install --omit=dev
COPY backend backend
COPY templates templates
COPY --from=frontend-builder /app/frontend/dist frontend/dist
EXPOSE 3000
CMD ["npm", "--workspace", "backend", "run", "start"]
