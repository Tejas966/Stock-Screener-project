<?php
declare(strict_types=1);

namespace FundamentalX\Controllers;

use FundamentalX\Http\HttpException;
use FundamentalX\Http\JsonResponse;
use FundamentalX\Http\Request;
use FundamentalX\Repositories\SavedScreenRepository;
use FundamentalX\Validation\ScreenCriteria;
use FundamentalX\Validation\Validator;

final class SavedScreenController
{
    public const MAX_SCREENS_PER_USER = 50;

    public function __construct(private readonly SavedScreenRepository $repo)
    {
    }

    public function index(int $userId): JsonResponse
    {
        return JsonResponse::ok(['items' => $this->repo->listForUser($userId)]);
    }

    public function show(int $userId, int $id): JsonResponse
    {
        return JsonResponse::ok($this->findOr404($userId, $id));
    }

    public function store(int $userId, Request $request): JsonResponse
    {
        $v = new Validator($request->json());
        $v->rejectUnknown(['name', 'description', 'criteria']);
        $name = $v->string('name', 1, 80);
        $description = $v->string('description', 0, 300, false);
        $criteria = $v->has('criteria') ? ScreenCriteria::validate($v->raw('criteria'), $v) : null;
        if (!$v->has('criteria')) {
            $v->addError('criteria', 'This field is required');
        }
        $v->assertValid();

        if (count($this->repo->listForUser($userId)) >= self::MAX_SCREENS_PER_USER) {
            throw new HttpException(409, 'LIMIT_REACHED', 'You can save at most ' . self::MAX_SCREENS_PER_USER . ' screens');
        }
        if ($this->repo->nameTaken($userId, (string) $name)) {
            throw new HttpException(409, 'DUPLICATE_NAME', 'You already have a saved screen with this name', ['name' => 'Name already used']);
        }
        $id = $this->repo->create($userId, (string) $name, $description, (array) $criteria);
        return JsonResponse::ok($this->findOr404($userId, $id), 201);
    }

    public function update(int $userId, int $id, Request $request): JsonResponse
    {
        $this->findOr404($userId, $id);
        $v = new Validator($request->json());
        $v->rejectUnknown(['name', 'description', 'criteria']);
        $changes = [];
        if ($v->has('name')) {
            $changes['name'] = $v->string('name', 1, 80);
        }
        if ($v->has('description')) {
            $changes['description'] = $v->string('description', 0, 300, false);
        }
        if ($v->has('criteria')) {
            $changes['criteria'] = ScreenCriteria::validate($v->raw('criteria'), $v);
        }
        if ($changes === []) {
            $v->addError('body', 'Provide at least one of name, description, criteria');
        }
        $v->assertValid();

        if (isset($changes['name']) && $this->repo->nameTaken($userId, $changes['name'], $id)) {
            throw new HttpException(409, 'DUPLICATE_NAME', 'You already have a saved screen with this name', ['name' => 'Name already used']);
        }
        $this->repo->update($userId, $id, $changes);
        return JsonResponse::ok($this->findOr404($userId, $id));
    }

    public function destroy(int $userId, int $id): JsonResponse
    {
        if (!$this->repo->delete($userId, $id)) {
            throw new HttpException(404, 'NOT_FOUND', 'Saved screen not found');
        }
        return JsonResponse::noContent();
    }

    /** @return array<string,mixed> */
    private function findOr404(int $userId, int $id): array
    {
        // 404 (not 403) for other users' rows, so ids cannot be probed.
        return $this->repo->find($userId, $id) ?? throw new HttpException(404, 'NOT_FOUND', 'Saved screen not found');
    }
}
