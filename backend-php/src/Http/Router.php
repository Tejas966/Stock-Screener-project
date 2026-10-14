<?php
declare(strict_types=1);

namespace FundamentalX\Http;

/** Minimal method + path router supporting {id} placeholders (digits only). */
final class Router
{
    /** @var list<array{string,string,callable}> */
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler): void
    {
        $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[0-9]{1,10})', $pattern) . '$#';
        $this->routes[] = [$method, $regex, $handler];
    }

    public function dispatch(Request $request): JsonResponse
    {
        $pathMatched = false;
        foreach ($this->routes as [$method, $regex, $handler]) {
            if (!preg_match($regex, rtrim($request->path, '/') ?: '/', $m)) {
                continue;
            }
            $pathMatched = true;
            if ($method !== $request->method) {
                continue;
            }
            $params = array_filter($m, 'is_string', ARRAY_FILTER_USE_KEY);
            return $handler($request, $params);
        }
        if ($pathMatched) {
            throw new HttpException(405, 'METHOD_NOT_ALLOWED', 'Method not allowed for this resource');
        }
        throw new HttpException(404, 'NOT_FOUND', 'Endpoint not found');
    }
}
