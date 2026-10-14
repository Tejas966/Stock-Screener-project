<?php
declare(strict_types=1);

namespace FundamentalX\Controllers;

use FundamentalX\Http\HttpException;
use FundamentalX\Http\JsonResponse;
use FundamentalX\Http\Request;
use FundamentalX\Repositories\ResearchNoteRepository;
use FundamentalX\Validation\Validator;

final class ResearchNoteController
{
    public const TITLE_MAX = 150;
    public const CONTENT_MAX = 10000;
    private const SYMBOL_PATTERN = '/^[A-Z0-9&\-]{1,20}\.(NS|BO)$/';

    public function __construct(private readonly ResearchNoteRepository $repo)
    {
    }

    public function index(int $userId, Request $request): JsonResponse
    {
        $limit = $this->intParam($request->query['limit'] ?? null, 50, 1, 100, 'limit');
        $offset = $this->intParam($request->query['offset'] ?? null, 0, 0, 100000, 'offset');
        $companyId = null;
        if (isset($request->query['company']) && $request->query['company'] !== '') {
            $companyId = $this->resolveCompany((string) $request->query['company'], 'company');
        }
        $result = $this->repo->listForUser($userId, $companyId, $limit, $offset);
        return JsonResponse::ok($result + ['limit' => $limit, 'offset' => $offset]);
    }

    public function show(int $userId, int $id): JsonResponse
    {
        return JsonResponse::ok($this->findOr404($userId, $id));
    }

    public function store(int $userId, Request $request): JsonResponse
    {
        $v = new Validator($request->json());
        $v->rejectUnknown(['title', 'content', 'company_symbol']);
        $title = $v->string('title', 1, self::TITLE_MAX);
        $content = $v->string('content', 1, self::CONTENT_MAX);
        $symbol = $v->string('company_symbol', 1, 32, false);
        $v->assertValid();

        $companyId = $symbol === null ? null : $this->resolveCompany($symbol, 'company_symbol');
        $id = $this->repo->create($userId, $companyId, (string) $title, (string) $content);
        return JsonResponse::ok($this->findOr404($userId, $id), 201);
    }

    public function update(int $userId, int $id, Request $request): JsonResponse
    {
        $this->findOr404($userId, $id);
        $v = new Validator($request->json());
        $v->rejectUnknown(['title', 'content', 'company_symbol']);
        $changes = [];
        if ($v->has('title')) {
            $changes['title'] = $v->string('title', 1, self::TITLE_MAX);
        }
        if ($v->has('content')) {
            $changes['content'] = $v->string('content', 1, self::CONTENT_MAX);
        }
        $symbolProvided = $v->has('company_symbol');
        $symbol = $symbolProvided ? $v->string('company_symbol', 1, 32, false) : null;
        if ($changes === [] && !$symbolProvided) {
            $v->addError('body', 'Provide at least one of title, content, company_symbol');
        }
        $v->assertValid();

        if ($symbolProvided) {
            // null / "" detaches the note from its company.
            $changes['company_id'] = $symbol === null ? null : $this->resolveCompany($symbol, 'company_symbol');
        }
        $this->repo->update($userId, $id, $changes);
        return JsonResponse::ok($this->findOr404($userId, $id));
    }

    public function destroy(int $userId, int $id): JsonResponse
    {
        if (!$this->repo->delete($userId, $id)) {
            throw new HttpException(404, 'NOT_FOUND', 'Research note not found');
        }
        return JsonResponse::noContent();
    }

    private function resolveCompany(string $symbol, string $field): int
    {
        $symbol = strtoupper(trim($symbol));
        if (!preg_match(self::SYMBOL_PATTERN, $symbol)) {
            throw new HttpException(422, 'VALIDATION_FAILED', 'One or more fields are invalid', [$field => 'Invalid company symbol']);
        }
        return $this->repo->companyIdForSymbol($symbol)
            ?? throw new HttpException(422, 'VALIDATION_FAILED', 'One or more fields are invalid', [$field => 'Unknown company']);
    }

    private function intParam(mixed $raw, int $default, int $min, int $max, string $name): int
    {
        if ($raw === null || $raw === '') {
            return $default;
        }
        if (!is_string($raw) || !preg_match('/^\d{1,6}$/', $raw) || (int) $raw < $min || (int) $raw > $max) {
            throw new HttpException(422, 'VALIDATION_FAILED', "Invalid {$name}", [$name => "Must be an integer between {$min} and {$max}"]);
        }
        return (int) $raw;
    }

    /** @return array<string,mixed> */
    private function findOr404(int $userId, int $id): array
    {
        return $this->repo->find($userId, $id) ?? throw new HttpException(404, 'NOT_FOUND', 'Research note not found');
    }
}
