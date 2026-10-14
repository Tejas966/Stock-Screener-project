<?php
declare(strict_types=1);

namespace FundamentalX\Tests;

use FundamentalX\App;
use FundamentalX\Database;
use FundamentalX\Http\JsonResponse;
use FundamentalX\Http\Request;
use PDO;
use PHPUnit\Framework\TestCase;

abstract class ServiceTestCase extends TestCase
{
    protected const SECRET = 'test-secret-0123456789abcdef';
    protected PDO $db;
    protected App $app;
    protected int $alice;
    protected int $bob;

    protected function setUp(): void
    {
        $this->db = Database::connect();
        $this->db->exec('DELETE FROM research_notes');
        $this->db->exec('DELETE FROM saved_screens');
        $this->db->exec('DELETE FROM users');
        $insert = $this->db->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
        $insert->execute(['Alice', 'alice@example.test', 'x']);
        $this->alice = (int) $this->db->lastInsertId();
        $insert->execute(['Bob', 'bob@example.test', 'x']);
        $this->bob = (int) $this->db->lastInsertId();
        $this->app = new App($this->db, self::SECRET);
    }

    /** @param array<string,mixed>|null $body */
    protected function call(string $method, string $path, ?int $userId, ?array $body = null, array $query = [], ?string $secret = self::SECRET): JsonResponse
    {
        $headers = ['content-type' => 'application/json'];
        if ($secret !== null) {
            $headers['x-internal-secret'] = $secret;
        }
        if ($userId !== null) {
            $headers['x-user-id'] = (string) $userId;
        }
        return $this->app->handle(new Request($method, $path, $headers, $query, $body === null ? '' : json_encode($body)));
    }
}
