FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
COPY frontend/package.json ./frontend/package.json
RUN npm install --workspace frontend

COPY frontend ./frontend
COPY shared ./shared
ARG VITE_API_URL=http://localhost:4000/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build --workspace frontend

FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
