#!/bin/sh

export DB="postgresql://postgres:pw@localhost:6500/"
export DATABASE_URL="postgresql://postgres:pw@localhost:6500/prima"

docker compose up -d pg

sleep 2

echo "DROP DATABASE prima;" | psql $DB
echo "CREATE DATABASE prima;" | psql $DB

pnpm run kysely migrate:latest

psql $DATABASE_URL --user postgres < data/zone.sql
psql $DATABASE_URL --user postgres < data/company.sql
psql $DATABASE_URL --user postgres < data/vehicle.sql
psql $DATABASE_URL --user postgres < data/user.sql
psql $DATABASE_URL --user postgres < data/rideShareVehicle.sql
psql $DATABASE_URL --user postgres < data/rideShareZone.sql
psql $DATABASE_URL --user postgres < data/taxiFilter.sql