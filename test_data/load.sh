#!/bin/sh

BASEDIR=$(dirname $0)
PGPASSWORD=pw psql postgresql://localhost:6500/prima --user postgres < $BASEDIR/test_data.sql
