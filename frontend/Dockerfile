# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

# Stage 2: Build the project
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build


# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Copy build output and assets
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js

EXPOSE 3000
CMD ["npm", "run", "start"]
