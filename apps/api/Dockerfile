FROM node:20-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY . .

RUN pnpm --filter @vbo/shared build && pnpm --filter @vbo/api build

FROM base AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build /app /app

EXPOSE 3000

CMD ["pnpm", "--filter", "@vbo/api", "start:prod"]
