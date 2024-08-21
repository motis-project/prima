#!/bin/bash

set -euo pipefail
set -o xtrace

BASEDIR=$(dirname $0)
SCENARIO=$1

if [ $# -eq 0 ]
  then
    echo "No argument supplied\nTry: sh load.sh <path to sql dumps>"
    exit 1
fi

echo "DROP DATABASE prima;" | PGPASSWORD=pw psql postgresql://localhost:6500 --user postgres
echo "CREATE DATABASE prima;" | PGPASSWORD=pw psql postgresql://localhost:6500 --user postgres

npm run kysely migrate:latest

cd $BASEDIR

export PGPASSWORD=pw

psql postgresql://localhost:6500/prima --user postgres < $SCENARIO/address.sql
psql postgresql://localhost:6500/prima --user postgres < $SCENARIO/taxi_rates.sql
psql postgresql://localhost:6500/prima --user postgres < $SCENARIO/zone.sql
psql postgresql://localhost:6500/prima --user postgres < $SCENARIO/company.sql
psql postgresql://localhost:6500/prima --user postgres < $SCENARIO/vehicle.sql
psql postgresql://localhost:6500/prima --user postgres < $SCENARIO/availability.sql
psql postgresql://localhost:6500/prima --user postgres < $SCENARIO/tour.sql
psql postgresql://localhost:6500/prima --user postgres < $SCENARIO/auth_user.sql
psql postgresql://localhost:6500/prima --user postgres < $SCENARIO/event.sql
