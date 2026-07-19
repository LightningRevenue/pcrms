FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
COPY worker ./worker

ARG WORKER_ENTRY=worker/gmail-sync-worker.ts
ENV WORKER_ENTRY=${WORKER_ENTRY}

CMD npx tsx $WORKER_ENTRY
