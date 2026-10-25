FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run lint && npm test -- --run && npm run build
ENV VITE_API_BASE_URL=/api/v1 VITE_USE_MOCKS=false BACKEND_URL=http://backend:8080
EXPOSE 5173
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s CMD wget -q -O /dev/null http://127.0.0.1:5173/ || exit 1
CMD ["npm", "run", "dev"]
