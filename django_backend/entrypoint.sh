#!/bin/bash
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "Running database migrations..."
    python manage.py migrate --noinput
fi

echo "Starting application..."
exec "$@"
