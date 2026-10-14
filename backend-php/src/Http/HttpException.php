<?php
declare(strict_types=1);

namespace FundamentalX\Http;

/** An error that maps directly to a JSON error response. */
final class HttpException extends \RuntimeException
{
    /** @param array<string,string> $details field => message */
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly array $details = []
    ) {
        parent::__construct($message);
    }
}
