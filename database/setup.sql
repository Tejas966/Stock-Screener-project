-- Run ONCE as the MySQL root user to create the application databases and user:
--   mysql -u root -p < database/setup.sql
-- Change the password here AND in your .env (DB_PASSWORD). Do not reuse a real password.
CREATE DATABASE IF NOT EXISTS fundamentalx      CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS fundamentalx_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'fundamentalx'@'localhost' IDENTIFIED BY 'change-me-local-password';
CREATE USER IF NOT EXISTS 'fundamentalx'@'127.0.0.1' IDENTIFIED BY 'change-me-local-password';

GRANT ALL PRIVILEGES ON fundamentalx.*      TO 'fundamentalx'@'localhost';
GRANT ALL PRIVILEGES ON fundamentalx.*      TO 'fundamentalx'@'127.0.0.1';
GRANT ALL PRIVILEGES ON fundamentalx_test.* TO 'fundamentalx'@'localhost';
GRANT ALL PRIVILEGES ON fundamentalx_test.* TO 'fundamentalx'@'127.0.0.1';
FLUSH PRIVILEGES;
