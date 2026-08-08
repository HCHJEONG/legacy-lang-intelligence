FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm ci --omit=dev

COPY .next ./.next
COPY public ./public
COPY analysis-output ./analysis-output
COPY next.config.ts tsconfig.json next-env.d.ts ./

EXPOSE 3000
CMD ["npm", "run", "start"]
