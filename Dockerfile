FROM node:20

RUN apt-get update && apt-get install -y \
  postgresql \
  postgresql-contrib \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /var/lib/postgresql/data/archive

COPY build /build
COPY migrations /build/migrations
COPY package.json /
COPY node_modules /node_modules

ENV POSTGRES_DB=your_database_name
ENV POSTGRES_USER=your_user_name
ENV POSTGRES_PASSWORD=your_password
ENV PGDATA=/var/lib/postgresql/data

RUN echo "archive_mode = on" >> /usr/share/postgresql/postgresql.conf.sample && \
    echo "archive_command = 'cp %p /var/lib/postgresql/data/archive/%f'" >> /usr/share/postgresql/postgresql.conf.sample

CMD service postgresql start && node /build
