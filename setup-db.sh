#!/bin/sh

docker compose up -d pg

sleep 2

echo "DROP DATABASE prima;" | psql postgresql://postgres:pw@localhost:6500
echo "CREATE DATABASE prima;" | psql postgresql://postgres:pw@localhost:6500
pnpm run kysely migrate:latest
