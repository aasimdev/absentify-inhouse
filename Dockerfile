FROM node:18-alpine AS base

ARG NEXT_PUBLIC_AZURE_AD_TENANT_ID
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ARG NEXT_PUBLIC_IS_LOCALHOST
ARG NEXT_PUBLIC_MAINTENANCE
ARG NEXT_PUBLIC_MSAL_CLIENTID
ARG NEXT_PUBLIC_MSAL_CLIENTID_CALENDARS_PERMISSION
ARG NEXT_PUBLIC_MSAL_CLIENTID_GROUPS_PERMISSION
ARG NEXT_PUBLIC_MSAL_CLIENTID_MAILBOX_PERMISSION
ARG NEXT_PUBLIC_MSAL_CLIENTID_USERS_PERMISSION
ARG NEXT_PUBLIC_MS_PWA
ARG NEXT_PUBLIC_PADDLE_API_URL
ARG NEXT_PUBLIC_PADDLE_SANDBOX
ARG NEXT_PUBLIC_PADDLE_VENDOR_ID
ARG NEXT_PUBLIC_RUNMODE
ARG SKIP_ENV_VALIDATION
ARG SENTRY_URL
ARG SENTRY_AUTH_TOKEN
ARG NEXT_PUBLIC_APPINSIGHTS_CONNECTIONSTRING
ARG NEXT_PUBLIC_APPINSIGHTS_INSTRUMENTATIONKEY
ARG AZURE_BLOB_URL
ARG AZURE_BLOB_COMPANY_LOGO_URL

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json schema.prisma yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .


# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED 1
# Generate Prisma Files
RUN npx prisma generate --schema ./schema.prisma

ENV NEXT_PUBLIC_AZURE_AD_TENANT_ID $NEXT_PUBLIC_AZURE_AD_TENANT_ID
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID $NEXT_PUBLIC_GA_MEASUREMENT_ID
ENV NEXT_PUBLIC_IS_LOCALHOST $NEXT_PUBLIC_IS_LOCALHOST
ENV NEXT_PUBLIC_MAINTENANCE $NEXT_PUBLIC_MAINTENANCE
ENV NEXT_PUBLIC_MSAL_CLIENTID $NEXT_PUBLIC_MSAL_CLIENTID
ENV NEXT_PUBLIC_MSAL_CLIENTID_CALENDARS_PERMISSION $NEXT_PUBLIC_MSAL_CLIENTID_CALENDARS_PERMISSION
ENV NEXT_PUBLIC_MSAL_CLIENTID_GROUPS_PERMISSION $NEXT_PUBLIC_MSAL_CLIENTID_GROUPS_PERMISSION
ENV NEXT_PUBLIC_MSAL_CLIENTID_MAILBOX_PERMISSION $NEXT_PUBLIC_MSAL_CLIENTID_MAILBOX_PERMISSION
ENV NEXT_PUBLIC_MSAL_CLIENTID_USERS_PERMISSION $NEXT_PUBLIC_MSAL_CLIENTID_USERS_PERMISSION
ENV NEXT_PUBLIC_MS_PWA $NEXT_PUBLIC_MS_PWA
ENV NEXT_PUBLIC_PADDLE_API_URL $NEXT_PUBLIC_PADDLE_API_URL
ENV NEXT_PUBLIC_PADDLE_SANDBOX $NEXT_PUBLIC_PADDLE_SANDBOX
ENV NEXT_PUBLIC_PADDLE_VENDOR_ID $NEXT_PUBLIC_PADDLE_VENDOR_ID
ENV NEXT_PUBLIC_RUNMODE $NEXT_PUBLIC_RUNMODE
ENV SKIP_ENV_VALIDATION $SKIP_ENV_VALIDATION
ENV SENTRY_URL $SENTRY_URL
ENV SENTRY_AUTH_TOKEN $SENTRY_AUTH_TOKEN
ENV NEXT_PUBLIC_APPINSIGHTS_CONNECTIONSTRING $NEXT_PUBLIC_APPINSIGHTS_CONNECTIONSTRING
ENV NEXT_PUBLIC_APPINSIGHTS_INSTRUMENTATIONKEY $NEXT_PUBLIC_APPINSIGHTS_INSTRUMENTATIONKEY
ENV AZURE_BLOB_URL $AZURE_BLOB_URL
ENV AZURE_BLOB_COMPANY_LOGO_URL $AZURE_BLOB_COMPANY_LOGO_URL

RUN \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/schema.prisma ./
COPY --from=builder /app/migrations ./migrations

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD npx prisma migrate deploy && HOSTNAME="0.0.0.0" node server.js
