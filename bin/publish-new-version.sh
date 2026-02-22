#!/bin/bash

if [ -z "$1" ] || [ "$1" != "--no-checks" ]; then
  cd client
  pnpm run check &&
  pnpm run test --bail=1 &&
  cp ../.env ./.env.local &&
  pnpm run build &&
  cd ..
fi

if [ $? -gt 0 ]; then
  echo -e "\n\nPlease make sure all checks pass before publishing a new version"
  exit
fi

git tag | sort -t "." -k1,1n -k2,2n -k3,3n -k4,4n | tail
echo "Please give the new version tag:"
read new_version

if [ -z "$1" ] || [ "$1" != '--no-git' ]; then
  echo "Pushing version $new_version to Github..."
  git tag --force --annotate "$new_version" -m "Version $new_version" &&
  git push --force origin --tags
fi

if [ -z "$1" ] || [ "$1" != '--no-docker' ]; then
  echo -e "\nPushing to Dockerhub"
  docker login

  source .env # needed for the build args

  # Build Next JS container
  docker build --build-arg NEXT_PUBLIC_BASE_URL="https://$PROD_HOSTNAME" \
               --build-arg NEXT_PUBLIC_PROJECT_NAME="$NEXT_PUBLIC_PROJECT_NAME" \
               --build-arg NEXT_PUBLIC_CONTACT_EMAIL="$NEXT_PUBLIC_CONTACT_EMAIL" \
               --build-arg NEXT_PUBLIC_EXPORTS_TO_KEEP="$NEXT_PUBLIC_EXPORTS_TO_KEEP" \
               --build-arg NEXT_PUBLIC_STORAGE_PUBLIC_BUCKET_BASE_URL="$NEXT_PUBLIC_STORAGE_PUBLIC_BUCKET_BASE_URL" \
               -t "$DOCKER_IMAGE_NAME:$new_version" ./client &&

  docker tag "$DOCKER_IMAGE_NAME:$new_version"  "$DOCKER_IMAGE_NAME:latest" &&
  docker push "$DOCKER_IMAGE_NAME:$new_version"  &&
  docker push "$DOCKER_IMAGE_NAME:latest"
fi

if [ $? == 0 ]; then
  echo -e "\nDone!"
fi
