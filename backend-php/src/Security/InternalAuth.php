<?php
declare(strict_types=1);

namespace FundamentalX\Security;

use FundamentalX\Http\HttpException;
use FundamentalX\Http\Request;
use PDO;

/**
 * Service-to-service authentication.
 *
 * The browser never talks to this service. The Node.js gateway authenticates
 * the user (session cookie), then forwards the request with:
 *   X-Internal-Secret : shared secret (PHP_SERVICE_SECRET), compared in constant time
 *   X-User-Id         : the id of the user Node authenticated
 * The user id is only trusted because the secret proves the caller is Node.
 */
final class InternalAuth
{
    public function __construct(private readonly PDO $db, private readonly string $secret)
    {
        if (strlen($secret) < 16) {
            throw new \RuntimeException('PHP_SERVICE_SECRET must be at least 16 characters');
        }
    }

    public function authenticate(Request $request): int
    {
        $provided = $request->header('x-internal-secret') ?? '';
        if (!hash_equals($this->secret, $provided)) {
            throw new HttpException(401, 'UNAUTHORIZED_SERVICE', 'Invalid internal service credentials');
        }
        $rawUserId = $request->header('x-user-id') ?? '';
        if (!preg_match('/^[1-9][0-9]{0,9}$/', $rawUserId)) {
            throw new HttpException(401, 'INVALID_USER_CONTEXT', 'Missing or invalid user context');
        }
        $userId = (int) $rawUserId;
        $stmt = $this->db->prepare('SELECT 1 FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        if ($stmt->fetchColumn() === false) {
            throw new HttpException(401, 'INVALID_USER_CONTEXT', 'User does not exist');
        }
        return $userId;
    }
}
