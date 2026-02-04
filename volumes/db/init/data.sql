-- Set up extensions
DROP EXTENSION IF EXISTS pgjwt CASCADE; -- not used for supabase/postgres from PG version 17
CREATE EXTENSION pg_cron;
CREATE EXTENSION unaccent;
SELECT * FROM pg_extension; -- log available extensions

-- Create user and schema
\set db_name `echo "$POSTGRES_DB"`
\set db_schema `echo "$RR_DB_SCHEMA"`
\set db_username `echo "$RR_DB_USERNAME"`
\set db_password `echo "$RR_DB_PASSWORD"`

CREATE USER :"db_username" WITH PASSWORD :'db_password';
CREATE SCHEMA :"db_schema";
ALTER SCHEMA :"db_schema" OWNER TO :"db_username";

-- TO-DO: REMOVE THIS PERMISSION ONCE THIS PR IS MERGED!!!!! https://github.com/drizzle-team/drizzle-orm/pull/4025
GRANT CREATE ON DATABASE :"db_name" TO :"db_username";

-- Give storage user the permission to create its schema
GRANT CREATE ON DATABASE :"db_name" TO supabase_storage_admin;