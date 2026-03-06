FROM node:24-bookworm-slim AS base

WORKDIR /workspace

# Keep dependency installation cacheable across stages.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/cli/package.json apps/cli/package.json
COPY packages/catalog/package.json packages/catalog/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

FROM base AS dev

COPY . .

EXPOSE 4173 47221

CMD ["npm", "run", "dev", "--workspace", "@openclaw-skill-center/web"]

FROM base AS build

COPY . .

RUN npm run build

FROM node:24-bookworm-slim AS prod-web

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /workspace/package.json /workspace/package-lock.json ./
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps ./apps
COPY --from=build /workspace/packages ./packages

EXPOSE 47221

CMD ["npm", "run", "start", "--workspace", "@openclaw-skill-center/web"]

FROM node:24-bookworm-slim AS prod-cli

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /workspace/package.json /workspace/package-lock.json ./
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps ./apps
COPY --from=build /workspace/packages ./packages

ENTRYPOINT ["node", "apps/cli/dist/index.js"]
