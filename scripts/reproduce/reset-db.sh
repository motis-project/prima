#!/bin/bash

set -e

export DB="postgresql://postgres:pw@localhost:6500"
export TARGET_DB="prima"
# Wait for DB to be ready
sleep 2

# Terminate all connections to target DB
psql "${DB}/postgres" -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = '${TARGET_DB}' AND pid <> pg_backend_pid();
"

# Drop and recreate the DB
psql "${DB}/postgres" -c "DROP DATABASE IF EXISTS ${TARGET_DB};"
psql "${DB}/postgres" -c "CREATE DATABASE ${TARGET_DB};"
