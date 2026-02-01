#!/bin/bash

##################################################
# Script for (re)starting production environment #
##################################################

# $1 - (optional) --restart/-r - skip apt update and DB dump

if [ "$(pwd | tail -c 5)" == "/bin" ]; then
  echo "Please run this script from the repo's root directory"
  exit 1
fi

source .env
sudo docker pull "$DOCKER_IMAGE_NAME"

if [ "$1" != "--restart" ] && [ "$1" != "-r" ]; then
  cd client &&
  pnpm run db:migrate &&
  cd .. &&

  sudo docker compose -f docker-compose.rr.yml up -d
else
  sudo apt update &&
  sudo apt dist-upgrade &&

  # TO-DO: MAKE DUMPS WORK AGAIN (use Supabase cron)!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  # ./bin/dump-db.sh /dump

  sudo docker stop rr-nextjs &&

  cd client &&
  pnpm run db:migrate &&
  cd .. &&
  echo && # just print a new line in the terminal

  sudo docker compose -f docker-compose.rr.yml up -d
fi
