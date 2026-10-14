<?php
declare(strict_types=1);

namespace FundamentalX\Repositories;

use FundamentalX\Database;
use PDO;

/**
 * CRUD for saved_screens. EVERY query is scoped by user_id, so a user can
 * never read or modify another user's rows (a foreign id simply "does not exist").
 */
final class SavedScreenRepository
{
    private const COLUMNS = 'id, name, description, criteria, created_at, updated_at';

    public function __construct(private readonly PDO $db)
    {
    }

    /** @return list<array<string,mixed>> */
    public function listForUser(int $userId): array
    {
        $stmt = $this->db->prepare('SELECT ' . self::COLUMNS . ' FROM saved_screens WHERE user_id = ? ORDER BY updated_at DESC, id DESC');
        $stmt->execute([$userId]);
        return array_map([$this, 'hydrate'], $stmt->fetchAll());
    }

    /** @return array<string,mixed>|null */
    public function find(int $userId, int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT ' . self::COLUMNS . ' FROM saved_screens WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
        $row = $stmt->fetch();
        return $row === false ? null : $this->hydrate($row);
    }

    public function nameTaken(int $userId, string $name, ?int $exceptId = null): bool
    {
        $stmt = $this->db->prepare('SELECT id FROM saved_screens WHERE user_id = ? AND name = ? AND id <> ?');
        $stmt->execute([$userId, $name, $exceptId ?? 0]);
        return $stmt->fetchColumn() !== false;
    }

    /** @param array<string,mixed> $criteria */
    public function create(int $userId, string $name, ?string $description, array $criteria): int
    {
        $stmt = $this->db->prepare('INSERT INTO saved_screens (user_id, name, description, criteria) VALUES (?, ?, ?, ?)');
        $stmt->execute([$userId, $name, $description, json_encode($criteria, JSON_THROW_ON_ERROR)]);
        return (int) $this->db->lastInsertId();
    }

    /**
     * Partial update; only the provided keys change.
     * @param array{name?:string, description?:?string, criteria?:array<string,mixed>} $changes
     */
    public function update(int $userId, int $id, array $changes): bool
    {
        $sets = [];
        $params = [];
        if (array_key_exists('name', $changes)) {
            $sets[] = 'name = ?';
            $params[] = $changes['name'];
        }
        if (array_key_exists('description', $changes)) {
            $sets[] = 'description = ?';
            $params[] = $changes['description'];
        }
        if (array_key_exists('criteria', $changes)) {
            $sets[] = 'criteria = ?';
            $params[] = json_encode($changes['criteria'], JSON_THROW_ON_ERROR);
        }
        if ($sets === []) {
            return $this->find($userId, $id) !== null;
        }
        // Column names above are fixed literals; only values are bound.
        $params[] = $id;
        $params[] = $userId;
        $stmt = $this->db->prepare('UPDATE saved_screens SET ' . implode(', ', $sets) . ' WHERE id = ? AND user_id = ?');
        $stmt->execute($params);
        return $stmt->rowCount() > 0 || $this->find($userId, $id) !== null;
    }

    public function delete(int $userId, int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM saved_screens WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
        return $stmt->rowCount() > 0;
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private function hydrate(array $row): array
    {
        $row['id'] = (int) $row['id'];
        $row['created_at'] = Database::isoUtc($row['created_at']);
        $row['updated_at'] = Database::isoUtc($row['updated_at']);
        $row['criteria'] = json_decode((string) $row['criteria'], true, 16, JSON_THROW_ON_ERROR);
        return $row;
    }
}
