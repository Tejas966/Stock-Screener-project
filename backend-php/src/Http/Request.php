<?php
declare(strict_types=1);

namespace FundamentalX\Http;

/** Immutable HTTP request value object (constructed from globals or by tests). */
final class Request
{
    public const MAX_BODY_BYTES = 64 * 1024;

    /**
     * @param array<string,string> $headers lower-cased header names
     * @param array<string,string> $query
     */
    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $headers = [],
        public readonly array $query = [],
        public readonly string $rawBody = ''
    ) {
    }

    public static function fromGlobals(): self
    {
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $headers[strtolower(str_replace('_', '-', substr($key, 5)))] = (string) $value;
            }
        }
        if (isset($_SERVER['CONTENT_TYPE'])) {
            $headers['content-type'] = (string) $_SERVER['CONTENT_TYPE'];
        }
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $body = file_get_contents('php://input', false, null, 0, self::MAX_BODY_BYTES + 1) ?: '';
        return new self(strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'), $path, $headers, $_GET, $body);
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }

    /** @return array<string,mixed> */
    public function json(): array
    {
        if (strlen($this->rawBody) > self::MAX_BODY_BYTES) {
            throw new HttpException(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
        }
        $type = $this->header('content-type') ?? '';
        if (!str_contains(strtolower($type), 'application/json')) {
            throw new HttpException(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
        }
        try {
            $data = json_decode($this->rawBody, true, 16, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new HttpException(400, 'INVALID_JSON', 'Request body is not valid JSON');
        }
        if (!is_array($data) || array_is_list($data) && $data !== []) {
            throw new HttpException(400, 'INVALID_JSON', 'Request body must be a JSON object');
        }
        return $data;
    }
}
