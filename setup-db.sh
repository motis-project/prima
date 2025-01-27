#!/bin/sh

export DATABASE_URL="postgresql://postgres:pw@localhost:6500"

# docker compose up -d pg

# sleep 2

# echo "DROP DATABASE prima;" | psql $DATABASE_URL
# echo "CREATE DATABASE prima;" | psql $DATABASE_URL

# pnpm run kysely migrate:latest

psql $DATABASE_URL/prima --user postgres < data/address.sql
psql $DATABASE_URL/prima --user postgres < data/zone.sql
psql $DATABASE_URL/prima --user postgres < data/company.sql
psql $DATABASE_URL/prima --user postgres < data/vehicle.sql
psql $DATABASE_URL/prima --user postgres < data/availability.sql
psql $DATABASE_URL/prima --user postgres < data/tour.sql
psql $DATABASE_URL/prima --user postgres < data/user.sql
psql $DATABASE_URL/prima --user postgres < data/event.sql
