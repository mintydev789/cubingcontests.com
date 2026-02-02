#!/bin/bash

#####################################################
# Script for testing production environment locally #
#####################################################

# $1 - (optional) --cleanup/-c - just bring the containers down without restarting

if [ "$(pwd | tail -c 5)" == "/bin" ]; then
  echo "Please run this script from the repo's root directory"
  exit 1
fi

docker compose -f docker-compose.rr.yml down

if [ "$1" != "--cleanup" ] && [ "$1" != "-c" ]; then
  source .env # needed for the build args

  docker build --build-arg NEXT_PUBLIC_BASE_URL="$NEXT_PUBLIC_BASE_URL" \
               --build-arg NEXT_PUBLIC_CONTACT_EMAIL="$NEXT_PUBLIC_CONTACT_EMAIL" \
               --build-arg NEXT_PUBLIC_STORAGE_PUBLIC_BUCKET_BASE_URL="$NEXT_PUBLIC_STORAGE_PUBLIC_BUCKET_BASE_URL" \
               -t "$DOCKER_IMAGE_NAME" ./client &&

  cd client &&
  pnpm run db:migrate &&
  cd .. &&

  docker compose -f docker-compose.rr.yml up
fi
