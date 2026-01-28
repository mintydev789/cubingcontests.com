#!/bin/bash

##################################################
# Script for (re)starting production environment #
##################################################

# $1 - (optional) --restart/-r - skip apt update and DB dump

if [ "$(pwd | tail -c 5)" == "/bin" ] || [ $EUID != 0 ]; then
  echo "Please run this script with sudo from the repo's root directory"
  exit 1
fi

source .env
docker pull "$DOCKER_IMAGE_NAME"

if [ "$1" != "--restart" ] && [ "$1" != "-r" ]; then
  cd client &&
  pnpm run db:migrate &&
  cd .. &&

  docker compose -f docker-compose.cc.yml up -d
else
  apt update &&
  apt dist-upgrade &&

  # TO-DO: MAKE DUMPS WORK AGAIN (use Supabase cron)!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  # ./bin/dump-db.sh /dump

  docker stop cc-nextjs &&

  cd client &&
  pnpm run db:migrate &&
  cd .. &&
  echo && # just print a new line in the terminal

  docker compose -f docker-compose.cc.yml up -d
fi
