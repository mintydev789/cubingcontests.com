#!/bin/bash

# This script originates from the docker/reset.sh script in the supabase repo

if [ "$(pwd | tail -c 5)" == "/bin" ]; then
  echo "Please run this script from the repo's root directory"
  exit 1
fi

echo "WARNING: This will remove all containers and container data. This action cannot be undone!"
read -p "Are you sure you want to proceed? (y/N) " -n 1 -r
echo    # Move to a new line
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Operation cancelled."
    exit 1
fi

echo "Stopping and removing all containers..."
docker compose -f docker-compose.supabase.yml down -v --remove-orphans

echo "Cleaning up bind-mounted directories..."
BIND_MOUNTS=(
  "./volumes/db/data"
)

for DIR in "${BIND_MOUNTS[@]}"; do
  if [ -d "$DIR" ]; then
    echo "Deleting $DIR..."
    rm -rf "$DIR"
  else
    echo "Directory $DIR does not exist. Skipping bind mount deletion step..."
  fi
done

echo "Cleanup complete!"
