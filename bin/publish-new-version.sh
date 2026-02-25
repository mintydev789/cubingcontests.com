#!/bin/bash

if [ "$(pwd | tail -c 5)" == "/bin" ]; then
  echo "Please run this script from the repo's root directory"
  exit 1
fi

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

cyan='\033[0;36m'
nc='\033[0m' # no color

git tag | sort -t "." -k1,1n -k2,2n -k3,3n | tail
echo -e "\n${cyan}Please give the new version tag:${nc}"
read new_version

echo -e "\n${cyan}Pushing version $new_version to Github...${nc}"
git tag --force --annotate "$new_version" -m "Version $new_version" &&
git push --force origin --tags &&
git push

echo -e "\n${cyan}Release new Docker image? (y/N)${nc}"
read answer

if [ "$answer" == "y" ] || [ "$answer" == "Y" ]; then
  ./bin/release-new-image.sh
fi
