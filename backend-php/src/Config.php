<?php
declare(strict_types=1);

namespace FundamentalX;

/**
 * Reads configuration from real environment variables first, then from the
 * project-root .env file. No secret has a default value.
 */
final class Config
{
    /** @var array<string,string> */
    private static array $fileValues = [];
    private static bool $loaded = false;

    public static function get(string $key, ?string $default = null): ?string
    {
        $env = getenv($key);
        if ($env !== false && $env !== '') {
            return $env;
        }
        self::loadFile();
        return self::$fileValues[$key] ?? $default;
    }

    public static function require(string $key): string
    {
        $value = self::get($key);
        if ($value === null || $value === '') {
            throw new \RuntimeException("Missing required configuration value: {$key}");
        }
        return $value;
    }

    private static function loadFile(): void
    {
        if (self::$loaded) {
            return;
        }
        self::$loaded = true;
        $path = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.env';
        if (!is_readable($path)) {
            return;
        }
        foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
                continue;
            }
            [$k, $v] = explode('=', $line, 2);
            $v = trim($v);
            // Strip optional surrounding quotes.
            if (strlen($v) >= 2 && ($v[0] === '"' || $v[0] === "'") && $v[-1] === $v[0]) {
                $v = substr($v, 1, -1);
            }
            self::$fileValues[trim($k)] = $v;
        }
    }
}
