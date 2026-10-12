FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
COPY backend/package.json ./backend/package.json
RUN npm install --workspace backend

COPY backend ./backend
RUN npm run prisma:generate --workspace backend
RUN npm run build --workspace backend

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/backend/package.json ./backend/package.json

WORKDIR /app/backend
EXPOSE 4000
CMD ["node", "dist/index.js"]
