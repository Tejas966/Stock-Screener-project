<?php
declare(strict_types=1);

namespace FundamentalX;

use PDO;

/** Creates the shared PDO connection with safe defaults. */
final class Database
{
    public static function connect(): PDO
    {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            Config::get('DB_HOST', '127.0.0.1'),
            Config::get('DB_PORT', '3306'),
            Config::require('DB_NAME')
        );
        $pdo = new PDO($dsn, Config::require('DB_USER'), Config::get('DB_PASSWORD', ''), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            // Real server-side prepared statements (no client-side emulation).
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ]);
        // All timestamps are stored and returned in UTC (see isoUtc()).
        $pdo->exec("SET time_zone = '+00:00'");
        return $pdo;
    }

    /** MySQL 'Y-m-d H:i:s' (UTC session) -> ISO-8601 '...T...Z' for unambiguous JSON. */
    public static function isoUtc(?string $value): ?string
    {
        return $value === null ? null : str_replace(' ', 'T', $value) . 'Z';
    }
}
