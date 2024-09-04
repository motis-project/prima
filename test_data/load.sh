#!/bin/bash

set -euo pipefail
set -o xtrace

BASEDIR=$(dirname $0)
SCENARIO=$1
DATABASE_URL=postgresql://localhost:6500

if [ $# -eq 0 ]
  then
    echo "No argument supplied\nTry: sh load.sh <path to sql dumps>"
    exit 1
fi

echo "DROP DATABASE prima;" | PGPASSWORD=pw psql $DATABASE_URL --user postgres
echo "CREATE DATABASE prima;" | PGPASSWORD=pw psql $DATABASE_URL --user postgres

npm run kysely migrate:latest

cd $BASEDIR

export PGPASSWORD=pw

psql $DATABASE_URL/prima --user postgres < $SCENARIO/address.sql
psql $DATABASE_URL/prima --user postgres < $SCENARIO/zone.sql
psql $DATABASE_URL/prima --user postgres < $SCENARIO/company.sql
psql $DATABASE_URL/prima --user postgres < $SCENARIO/vehicle.sql
psql $DATABASE_URL/prima --user postgres < $SCENARIO/availability.sql
psql $DATABASE_URL/prima --user postgres < $SCENARIO/tour.sql
psql $DATABASE_URL/prima --user postgres < $SCENARIO/auth_user.sql
psql $DATABASE_URL/prima --user postgres < $SCENARIO/event.sql
