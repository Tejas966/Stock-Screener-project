-- Used only by docker-compose.yml: create the test database and grant the app user access.
CREATE DATABASE IF NOT EXISTS fundamentalx_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON fundamentalx_test.* TO 'fundamentalx'@'%';
FLUSH PRIVILEGES;
