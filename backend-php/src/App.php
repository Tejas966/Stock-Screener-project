<?php
declare(strict_types=1);

namespace FundamentalX;

use FundamentalX\Controllers\ResearchNoteController;
use FundamentalX\Controllers\SavedScreenController;
use FundamentalX\Http\HttpException;
use FundamentalX\Http\JsonResponse;
use FundamentalX\Http\Request;
use FundamentalX\Http\Router;
use FundamentalX\Repositories\ResearchNoteRepository;
use FundamentalX\Repositories\SavedScreenRepository;
use FundamentalX\Security\InternalAuth;
use PDO;

/**
 * Wires routes to controllers. `handle()` is pure (Request in, Response out),
 * which lets PHPUnit exercise the whole service without starting a server.
 */
final class App
{
    private Router $router;

    public function __construct(private readonly PDO $db, string $serviceSecret)
    {
        $auth = new InternalAuth($db, $serviceSecret);
        $screens = new SavedScreenController(new SavedScreenRepository($db));
        $notes = new ResearchNoteController(new ResearchNoteRepository($db));
        $r = new Router();

        $r->add('GET', '/health', fn() => JsonResponse::ok(['status' => 'ok', 'service' => 'fundamentalx-php']));

        $r->add('GET', '/internal/saved-screens', fn(Request $q) => $screens->index($auth->authenticate($q)));
        $r->add('POST', '/internal/saved-screens', fn(Request $q) => $screens->store($auth->authenticate($q), $q));
        $r->add('GET', '/internal/saved-screens/{id}', fn(Request $q, array $p) => $screens->show($auth->authenticate($q), (int) $p['id']));
        $r->add('PUT', '/internal/saved-screens/{id}', fn(Request $q, array $p) => $screens->update($auth->authenticate($q), (int) $p['id'], $q));
        $r->add('DELETE', '/internal/saved-screens/{id}', fn(Request $q, array $p) => $screens->destroy($auth->authenticate($q), (int) $p['id']));

        $r->add('GET', '/internal/research-notes', fn(Request $q) => $notes->index($auth->authenticate($q), $q));
        $r->add('POST', '/internal/research-notes', fn(Request $q) => $notes->store($auth->authenticate($q), $q));
        $r->add('GET', '/internal/research-notes/{id}', fn(Request $q, array $p) => $notes->show($auth->authenticate($q), (int) $p['id']));
        $r->add('PUT', '/internal/research-notes/{id}', fn(Request $q, array $p) => $notes->update($auth->authenticate($q), (int) $p['id'], $q));
        $r->add('DELETE', '/internal/research-notes/{id}', fn(Request $q, array $p) => $notes->destroy($auth->authenticate($q), (int) $p['id']));

        $this->router = $r;
    }

    public function handle(Request $request): JsonResponse
    {
        try {
            return $this->router->dispatch($request);
        } catch (HttpException $e) {
            return JsonResponse::error($e);
        } catch (\PDOException $e) {
            // Never leak SQL or driver messages to the caller.
            error_log('[fundamentalx-php] database error: ' . $e->getCode());
            if (($e->errorInfo[1] ?? null) === 1062) {
                return JsonResponse::error(new HttpException(409, 'CONFLICT', 'A record with these values already exists'));
            }
            return JsonResponse::error(new HttpException(503, 'DATABASE_UNAVAILABLE', 'Database operation failed'));
        } catch (\Throwable $e) {
            error_log('[fundamentalx-php] unexpected error: ' . get_class($e));
            return JsonResponse::error(new HttpException(500, 'INTERNAL_ERROR', 'Unexpected server error'));
        }
    }
}
