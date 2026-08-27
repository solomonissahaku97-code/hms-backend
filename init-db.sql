-- Optional PostgreSQL extensions commonly needed by Sequelize apps
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- All microservices share the single 'hms' database (POSTGRES_DB env var).
-- Each service uses table prefixes or schema namespacing to avoid collisions.
