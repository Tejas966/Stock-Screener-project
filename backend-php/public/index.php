<?php
declare(strict_types=1);

/*
 * Front controller for the internal PHP persistence service.
 *   php -S 127.0.0.1:8002 -t public public/index.php
 * Bind to 127.0.0.1 so the service is reachable only by the local Node gateway.
 */

use FundamentalX\App;
use FundamentalX\Config;
use FundamentalX\Database;
use FundamentalX\Http\HttpException;
use FundamentalX\Http\JsonResponse;
use FundamentalX\Http\Request;

$autoload = dirname(__DIR__) . '/vendor/autoload.php';
if (is_readable($autoload)) {
    require $autoload;
} else {
    // Fallback PSR-4 autoloader so the service runs even before `composer install`.
    spl_autoload_register(static function (string $class): void {
        $prefix = 'FundamentalX\\';
        if (str_starts_with($class, $prefix)) {
            $file = dirname(__DIR__) . '/src/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
            if (is_readable($file)) {
                require $file;
            }
        }
    });
}

try {
    $app = new App(Database::connect(), Config::require('PHP_SERVICE_SECRET'));
    $response = $app->handle(Request::fromGlobals());
} catch (\PDOException) {
    error_log('[fundamentalx-php] cannot connect to database');
    $response = JsonResponse::error(new HttpException(503, 'DATABASE_UNAVAILABLE', 'Database connection failed'));
} catch (\Throwable $e) {
    error_log('[fundamentalx-php] startup error: ' . $e->getMessage());
    $response = JsonResponse::error(new HttpException(500, 'SERVICE_MISCONFIGURED', 'Service is not configured correctly'));
}
$response->send();
