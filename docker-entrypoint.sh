#!/bin/sh
set -e

# Apply any pending database migrations, then start the server.
node_modules/.bin/prisma migrate deploy
exec node_modules/.bin/next start
