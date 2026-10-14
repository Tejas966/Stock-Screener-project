<?php
declare(strict_types=1);

namespace FundamentalX\Validation;

/**
 * Validates and canonicalises saved-screen criteria:
 *   {
 *     "filters": { "<field>": { "min": number|null, "max": number|null }, ... },
 *     "sector":  "<sector-slug>" | null,
 *     "sort":    { "field": "<field>|company_name", "direction": "asc"|"desc" }
 *   }
 * Allowed fields come from shared/screener-fields.json (also used by Node).
 */
final class ScreenCriteria
{
    /** @var array{fields: list<string>, sortable: list<string>, maxAbs: float}|null */
    private static ?array $spec = null;

    /** @return array{fields: list<string>, sortable: list<string>, maxAbs: float} */
    public static function spec(): array
    {
        if (self::$spec === null) {
            $path = dirname(__DIR__, 3) . '/shared/screener-fields.json';
            $json = json_decode((string) file_get_contents($path), true, 8, JSON_THROW_ON_ERROR);
            $fields = array_map(static fn(array $f): string => $f['key'], $json['fields']);
            self::$spec = [
                'fields' => $fields,
                'sortable' => array_merge($fields, $json['sortable_extra']),
                'maxAbs' => (float) $json['limits']['max_abs_value'],
            ];
        }
        return self::$spec;
    }

    /**
     * @param mixed $criteria
     * @return array<string,mixed>|null canonical criteria, or null if invalid (errors added to $v)
     */
    public static function validate($criteria, Validator $v): ?array
    {
        $spec = self::spec();
        if (!is_array($criteria) || ($criteria !== [] && array_is_list($criteria))) {
            $v->addError('criteria', 'Must be an object');
            return null;
        }
        foreach (array_keys($criteria) as $key) {
            if (!in_array($key, ['filters', 'sector', 'sort'], true)) {
                $v->addError("criteria.{$key}", 'Unknown field');
            }
        }

        $filters = $criteria['filters'] ?? [];
        $canonicalFilters = [];
        if (!is_array($filters) || ($filters !== [] && array_is_list($filters))) {
            $v->addError('criteria.filters', 'Must be an object');
        } else {
            if (count($filters) > count($spec['fields'])) {
                $v->addError('criteria.filters', 'Too many filters');
            }
            foreach ($filters as $field => $range) {
                $path = "criteria.filters.{$field}";
                if (!in_array($field, $spec['fields'], true)) {
                    $v->addError($path, 'Unsupported filter field');
                    continue;
                }
                if (!is_array($range)) {
                    $v->addError($path, 'Must be an object with min and/or max');
                    continue;
                }
                $bounds = [];
                foreach (['min', 'max'] as $b) {
                    $value = $range[$b] ?? null;
                    if ($value === null) {
                        $bounds[$b] = null;
                        continue;
                    }
                    if (!is_int($value) && !is_float($value)) {
                        $v->addError("{$path}.{$b}", 'Must be a number or null');
                        continue 2;
                    }
                    if (abs((float) $value) > $spec['maxAbs']) {
                        $v->addError("{$path}.{$b}", 'Value is out of range');
                        continue 2;
                    }
                    $bounds[$b] = $value;
                }
                foreach (array_keys($range) as $extra) {
                    if (!in_array($extra, ['min', 'max'], true)) {
                        $v->addError("{$path}.{$extra}", 'Unknown field');
                    }
                }
                if ($bounds['min'] === null && $bounds['max'] === null) {
                    $v->addError($path, 'Provide at least one of min or max');
                    continue;
                }
                if ($bounds['min'] !== null && $bounds['max'] !== null && $bounds['min'] > $bounds['max']) {
                    $v->addError($path, 'min must not exceed max');
                    continue;
                }
                $canonicalFilters[$field] = $bounds;
            }
        }

        $sector = $criteria['sector'] ?? null;
        if ($sector !== null && (!is_string($sector) || !preg_match('/^[a-z0-9-]{1,80}$/', $sector))) {
            $v->addError('criteria.sector', 'Must be a sector slug or null');
        }

        $sort = $criteria['sort'] ?? ['field' => 'company_name', 'direction' => 'asc'];
        if (!is_array($sort)
            || !in_array($sort['field'] ?? null, $spec['sortable'], true)
            || !in_array($sort['direction'] ?? null, ['asc', 'desc'], true)) {
            $v->addError('criteria.sort', 'Must be {field: supported field, direction: asc|desc}');
        }

        return [
            'filters' => (object) $canonicalFilters,
            'sector' => $sector,
            'sort' => is_array($sort) ? ['field' => $sort['field'] ?? null, 'direction' => $sort['direction'] ?? null] : null,
        ];
    }
}
