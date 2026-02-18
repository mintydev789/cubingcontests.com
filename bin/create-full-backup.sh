#!/bin/bash

if [ ! -d "./volumes" ]; then
  echo "Error: volumes directory not found (this script must be run from the project root directory)"
  exit 1
fi

cyan='\033[0;36m'
nc='\033[0m' # no color
backup_name="backup_$(date "+%Y-%m-%d_%H-%M-%S")"

echo -e "${cyan}Backing up .env, volumes/db/data and volumes/storage to $backup_name...${nc}\n" &&
sudo rsync --archive --xattrs .env volumes/db/data volumes/storage ./$backup_name/ &&

echo -e "${cyan}Stopping DB and storage containers...${nc}\n" &&
sudo docker stop supabase-db supabase-storage supabase-imgproxy &&

echo -e "\n${cyan}Syncing the changes from the last few seconds for completeness...${nc}\n" &&
sudo rsync --checksum --delete --archive --xattrs volumes/db/data volumes/storage ./$backup_name/ &&
sudo chown -R $USER:$USER $backup_name &&

echo -e "${cyan}Restarting Supabase containers...${nc}\n" &&
sudo docker compose -f docker-compose.supabase.yml up -d &&

echo -e "\n${cyan}Creating encrypted archive...${nc}" &&
tar -czf "$backup_name.tar.gz" $backup_name &&
rm -rf $backup_name &&
mkdir -p $HOME/backups &&
gpg --symmetric --cipher-algo AES256 -o "$HOME/backups/$backup_name.tar.gz.gpg" "./$backup_name.tar.gz" &&
rm -f $backup_name.tar.gz &&

echo -e "\n${cyan}Done! Backup saved as $HOME/backups/$backup_name.tar.gz.gpg${nc}"
