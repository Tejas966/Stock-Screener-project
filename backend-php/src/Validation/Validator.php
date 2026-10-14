<?php
declare(strict_types=1);

namespace FundamentalX\Validation;

use FundamentalX\Http\HttpException;

/**
 * Collects field errors, then throws a single 422 with all of them so the
 * client can show every problem at once.
 */
final class Validator
{
    /** @var array<string,string> */
    private array $errors = [];

    /** @param array<string,mixed> $data */
    public function __construct(private readonly array $data)
    {
    }

    /** Required/optional trimmed string with length limits (counted in characters). */
    public function string(string $field, int $min, int $max, bool $required = true): ?string
    {
        $value = $this->data[$field] ?? null;
        if ($value === null || $value === '') {
            if ($required) {
                $this->errors[$field] = 'This field is required';
            }
            return null;
        }
        if (!is_string($value)) {
            $this->errors[$field] = 'Must be a string';
            return null;
        }
        $value = trim($value);
        // Reject ASCII control characters except tab/newline/carriage return.
        if (preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $value)) {
            $this->errors[$field] = 'Contains invalid control characters';
            return null;
        }
        $len = mb_strlen($value, 'UTF-8');
        if ($len < $min || $len > $max) {
            $this->errors[$field] = "Must be between {$min} and {$max} characters";
            return null;
        }
        return $value;
    }

    public function addError(string $field, string $message): void
    {
        $this->errors[$field] = $message;
    }

    public function has(string $field): bool
    {
        return array_key_exists($field, $this->data);
    }

    /** @return mixed */
    public function raw(string $field)
    {
        return $this->data[$field] ?? null;
    }

    /** @param list<string> $allowed */
    public function rejectUnknown(array $allowed): void
    {
        foreach (array_keys($this->data) as $key) {
            if (!in_array($key, $allowed, true)) {
                $this->errors[(string) $key] = 'Unknown field';
            }
        }
    }

    public function assertValid(): void
    {
        if ($this->errors !== []) {
            throw new HttpException(422, 'VALIDATION_FAILED', 'One or more fields are invalid', $this->errors);
        }
    }
}
