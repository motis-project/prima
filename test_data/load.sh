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

git submodule update --init --recursive
cd kysely-ctl
npm run build

echo "DROP DATABASE prima;" | PGPASSWORD=pw psql postgresql://localhost:6500 --user postgres
echo "CREATE DATABASE prima;" | PGPASSWORD=pw psql postgresql://localhost:6500 --user postgres

cd -
node ./kysely-ctl/dist/bin.js migrate:latest

echo "cd $BASEDIR"
cd $BASEDIR

export PGPASSWORD=pw

psql postgresql://localhost:6500/prima --user postgres < $SCENARIO/clear.sql
psql postgresql://localhost:6500/prima --user postgres < $SCENARIO/address.sql
psql postgresql://localhost:6500/prima --user postgres < $SCENARIO/zone.sql
psql postgresql://localhost:6500/prima --user postgres < $SCENARIO/company.sql
psql postgresql://localhost:6500/prima --user postgres < $SCENARIO/vehicle.sql
psql postgresql://localhost:6500/prima --user postgres < $SCENARIO/availability.sql
psql postgresql://localhost:6500/prima --user postgres < $SCENARIO/tour.sql
psql postgresql://localhost:6500/prima --user postgres < $SCENARIO/event.sql
