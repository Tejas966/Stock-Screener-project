<?php
declare(strict_types=1);

/*
 * Test bootstrap: points the service at the TEST database (DB_TEST_NAME) and
 * rebuilds its schema from database/migrations + seeds before the suite runs.
 * Requires a running MySQL server and the credentials from the root .env.
 */
require dirname(__DIR__) . '/vendor/autoload.php';

use FundamentalX\Config;

$testDb = Config::get('DB_TEST_NAME', 'fundamentalx_test');
putenv("DB_NAME={$testDb}");
putenv('PHP_SERVICE_SECRET=test-secret-0123456789abcdef');

$root = dirname(__DIR__, 2);
$pdo = new PDO(
    sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', Config::get('DB_HOST', '127.0.0.1'), Config::get('DB_PORT', '3306'), $testDb),
    Config::require('DB_USER'),
    Config::get('DB_PASSWORD', ''),
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);
$pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $table) {
    $pdo->exec("DROP TABLE `{$table}`");
}
$pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
foreach (glob($root . '/database/migrations/*.sql') as $file) {
    $pdo->exec((string) file_get_contents($file));
}
foreach (glob($root . '/database/seeds/*.sql') as $file) {
    $pdo->exec((string) file_get_contents($file));
}
