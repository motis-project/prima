#!/bin/sh

BASEDIR=$(dirname $0)
SCENARIO=$1

if [ $# -eq 0 ]
  then
    echo "No argument supplied\nTry: sh load.sh <path to sql dumps>"
    exit 1
fi


PGPASSWORD=pw psql postgresql://localhost:6500/prima --user postgres < $BASEDIR/$SCENARIO/zone.sql
PGPASSWORD=pw psql postgresql://localhost:6500/prima --user postgres < $BASEDIR/$SCENARIO/company.sql
PGPASSWORD=pw psql postgresql://localhost:6500/prima --user postgres < $BASEDIR/$SCENARIO/vehicle.sql
PGPASSWORD=pw psql postgresql://localhost:6500/prima --user postgres < $BASEDIR/$SCENARIO/availability.sql
PGPASSWORD=pw psql postgresql://localhost:6500/prima --user postgres < $BASEDIR/$SCENARIO/tour.sql
