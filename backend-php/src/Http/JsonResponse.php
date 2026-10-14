<?php
declare(strict_types=1);

namespace FundamentalX\Http;

final class JsonResponse
{
    /** @param array<string,mixed>|null $body */
    public function __construct(public readonly int $status, public readonly ?array $body)
    {
    }

    /** @param array<string,mixed> $data */
    public static function ok(array $data, int $status = 200): self
    {
        return new self($status, ['data' => $data]);
    }

    public static function noContent(): self
    {
        return new self(204, null);
    }

    public static function error(HttpException $e): self
    {
        $error = ['code' => $e->errorCode, 'message' => $e->getMessage()];
        if ($e->details !== []) {
            $error['details'] = $e->details;
        }
        return new self($e->status, ['error' => $error]);
    }

    public function send(): void
    {
        http_response_code($this->status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: no-store');
        if ($this->body !== null) {
            echo json_encode($this->body, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        }
    }
}
