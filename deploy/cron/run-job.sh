#!/bin/sh
set -eu

job="${1:?job name is required}"
url="${2:?job URL is required}"
method="${3:-GET}"
lock="/run/lock/lodgecore-${job}.lock"

if [ -z "${CRON_SECRET:-}" ]; then
  echo "[$job] CRON_SECRET is not configured" >&2
  exit 78
fi

mkdir -p /run/lock
exec /usr/bin/flock -n "$lock" \
  /usr/bin/curl --fail --silent --show-error \
    --connect-timeout 15 --max-time 300 \
    --retry 3 --retry-delay 10 --retry-all-errors \
    -X "$method" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H 'Accept: application/json' \
    "$url"
