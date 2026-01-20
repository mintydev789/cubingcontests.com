#!/bin/bash

#####################################################
# Script for testing production environment locally #
#####################################################

# $1 - (optional) --cleanup/-c - just bring the containers down without restarting

if [ "$(pwd | tail -c 5)" == "/bin" ]; then
  echo "Please run this script from the repo's root directory"
  exit 1
fi

docker compose -f docker-compose.cc.yml down

if [ "$1" != "--cleanup" ] && [ "$1" != "-c" ]; then
  source .env # needed for the build args

  docker build --build-arg PORT="$NEXTJS_PORT" \
               --build-arg NEXT_PUBLIC_BASE_URL="http://localhost:$NEXTJS_PORT" \
               -t "$DOCKER_IMAGE_NAME" ./client &&

  docker compose -f docker-compose.cc.yml up
fi
