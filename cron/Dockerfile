FROM node:20-slim

RUN apt-get update && apt-get install -y wget gnupg2 lsb-release && \
    echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list && \
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - && \
    apt-get update && \
    apt-get install -y cron postgresql-client-16 && \
    corepack enable && \
    corepack prepare pnpm@latest --activate && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY scripts /app/scripts
COPY cron/crontab /etc/cron.d/cron-jobs

RUN chmod 0644 /etc/cron.d/cron-jobs && \
    chmod +x /app/scripts/*.sh && \
    crontab /etc/cron.d/cron-jobs && \
    touch /var/log/cron.log

CMD ["sh", "-c", "printenv | grep -v \"no_proxy\" > /etc/environment && cron && tail -f /var/log/cron.log"]
