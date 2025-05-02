FROM node:20-slim

RUN apt-get update && apt-get install -y \
    wget \
    gnupg2 \
    lsb-release \
    cron \
    && \
    echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list && \
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - && \
    apt-get update && \
    apt-get install -y postgresql-client-16 && \
    corepack enable && \
    corepack prepare pnpm@latest --activate && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY cron/scripts /app/scripts

RUN mkdir -p /etc/cron.d

RUN touch /var/log/cron.log

COPY cron/cron-loader.js /usr/local/bin/
RUN chmod +x /usr/local/bin/cron-loader.js

ENTRYPOINT ["/usr/local/bin/cron-loader.js"]

CMD ["tail", "-f", "/var/log/cron.log"]