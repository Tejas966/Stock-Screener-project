<?php
declare(strict_types=1);

namespace FundamentalX\Repositories;

use FundamentalX\Database;
use PDO;

/** CRUD for research_notes, always scoped by user_id. */
final class ResearchNoteRepository
{
    private const SELECT = 'SELECT n.id, n.title, n.content, n.company_id, c.symbol AS company_symbol,
                                   c.company_name, n.created_at, n.updated_at
                            FROM research_notes n
                            LEFT JOIN companies c ON c.id = n.company_id';

    public function __construct(private readonly PDO $db)
    {
    }

    /** @return array{items: list<array<string,mixed>>, total: int} */
    public function listForUser(int $userId, ?int $companyId, int $limit, int $offset): array
    {
        $where = 'n.user_id = ?';
        $params = [$userId];
        if ($companyId !== null) {
            $where .= ' AND n.company_id = ?';
            $params[] = $companyId;
        }
        $count = $this->db->prepare("SELECT COUNT(*) FROM research_notes n WHERE {$where}");
        $count->execute($params);

        // LIMIT/OFFSET are bound as integers (native prepares allow this).
        $stmt = $this->db->prepare(self::SELECT . " WHERE {$where} ORDER BY n.updated_at DESC, n.id DESC LIMIT ? OFFSET ?");
        foreach ($params as $i => $p) {
            $stmt->bindValue($i + 1, $p, PDO::PARAM_INT);
        }
        $stmt->bindValue(count($params) + 1, $limit, PDO::PARAM_INT);
        $stmt->bindValue(count($params) + 2, $offset, PDO::PARAM_INT);
        $stmt->execute();
        return ['items' => array_map([$this, 'hydrate'], $stmt->fetchAll()), 'total' => (int) $count->fetchColumn()];
    }

    /** @return array<string,mixed>|null */
    public function find(int $userId, int $id): ?array
    {
        $stmt = $this->db->prepare(self::SELECT . ' WHERE n.id = ? AND n.user_id = ?');
        $stmt->execute([$id, $userId]);
        $row = $stmt->fetch();
        return $row === false ? null : $this->hydrate($row);
    }

    public function companyIdForSymbol(string $symbol): ?int
    {
        // Read-only use of the Node-owned companies table.
        $stmt = $this->db->prepare('SELECT id FROM companies WHERE symbol = ?');
        $stmt->execute([$symbol]);
        $id = $stmt->fetchColumn();
        return $id === false ? null : (int) $id;
    }

    public function create(int $userId, ?int $companyId, string $title, string $content): int
    {
        $stmt = $this->db->prepare('INSERT INTO research_notes (user_id, company_id, title, content) VALUES (?, ?, ?, ?)');
        $stmt->execute([$userId, $companyId, $title, $content]);
        return (int) $this->db->lastInsertId();
    }

    /** @param array{title?:string, content?:string, company_id?:?int} $changes */
    public function update(int $userId, int $id, array $changes): bool
    {
        $sets = [];
        $params = [];
        foreach (['title', 'content', 'company_id'] as $col) {
            if (array_key_exists($col, $changes)) {
                $sets[] = "{$col} = ?"; // fixed column whitelist
                $params[] = $changes[$col];
            }
        }
        if ($sets === []) {
            return $this->find($userId, $id) !== null;
        }
        $params[] = $id;
        $params[] = $userId;
        $stmt = $this->db->prepare('UPDATE research_notes SET ' . implode(', ', $sets) . ' WHERE id = ? AND user_id = ?');
        $stmt->execute($params);
        return $stmt->rowCount() > 0 || $this->find($userId, $id) !== null;
    }

    public function delete(int $userId, int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM research_notes WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
        return $stmt->rowCount() > 0;
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private function hydrate(array $row): array
    {
        $row['id'] = (int) $row['id'];
        $row['created_at'] = Database::isoUtc($row['created_at']);
        $row['updated_at'] = Database::isoUtc($row['updated_at']);
        $row['company_id'] = $row['company_id'] === null ? null : (int) $row['company_id'];
        return $row;
    }
}
