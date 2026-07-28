FROM postgres:16-alpine

# Copy the initialization script so schemas are created automatically on first boot
COPY scripts/init-schemas.sql /docker-entrypoint-initdb.d/init-schemas.sql
