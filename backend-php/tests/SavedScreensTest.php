<?php
declare(strict_types=1);

namespace FundamentalX\Tests;

final class SavedScreensTest extends ServiceTestCase
{
    private function criteria(): array
    {
        return [
            'filters' => ['pe_ratio' => ['min' => null, 'max' => 30], 'roe' => ['min' => 15, 'max' => null]],
            'sector' => 'information-technology',
            'sort' => ['field' => 'roe', 'direction' => 'desc'],
        ];
    }

    public function testCreateReadUpdateDelete(): void
    {
        $res = $this->call('POST', '/internal/saved-screens', $this->alice, ['name' => 'Quality IT', 'criteria' => $this->criteria()]);
        self::assertSame(201, $res->status);
        $screen = $res->body['data'];
        self::assertSame(30, $screen['criteria']['filters']['pe_ratio']['max']);
        self::assertSame('roe', $screen['criteria']['sort']['field']);

        $row = $this->db->query("SELECT name, JSON_EXTRACT(criteria, '$.filters.roe.min') AS roe_min FROM saved_screens")->fetch();
        self::assertSame('Quality IT', $row['name']);
        self::assertSame('15', (string) $row['roe_min']);

        $renamed = $this->call('PUT', "/internal/saved-screens/{$screen['id']}", $this->alice, ['name' => 'Quality IT v2']);
        self::assertSame('Quality IT v2', $renamed->body['data']['name']);
        self::assertSame(30, $renamed->body['data']['criteria']['filters']['pe_ratio']['max'], 'criteria untouched by rename');

        $newCriteria = $this->criteria();
        $newCriteria['filters'] = ['debt_to_equity' => ['min' => 0, 'max' => 0.5]];
        $upd = $this->call('PUT', "/internal/saved-screens/{$screen['id']}", $this->alice, ['criteria' => $newCriteria]);
        self::assertSame(['debt_to_equity'], array_keys($upd->body['data']['criteria']['filters']));

        self::assertCount(1, $this->call('GET', '/internal/saved-screens', $this->alice)->body['data']['items']);
        self::assertSame(204, $this->call('DELETE', "/internal/saved-screens/{$screen['id']}", $this->alice)->status);
        self::assertSame(404, $this->call('DELETE', "/internal/saved-screens/{$screen['id']}", $this->alice)->status);
    }

    public function testOtherUserCannotAccess(): void
    {
        $id = $this->call('POST', '/internal/saved-screens', $this->alice, ['name' => 'Mine', 'criteria' => $this->criteria()])->body['data']['id'];
        self::assertSame(404, $this->call('GET', "/internal/saved-screens/{$id}", $this->bob)->status);
        self::assertSame(404, $this->call('PUT', "/internal/saved-screens/{$id}", $this->bob, ['name' => 'Stolen'])->status);
        self::assertSame(404, $this->call('DELETE', "/internal/saved-screens/{$id}", $this->bob)->status);
        self::assertSame([], $this->call('GET', '/internal/saved-screens', $this->bob)->body['data']['items']);
    }

    public function testDuplicateNamePerUser(): void
    {
        $this->call('POST', '/internal/saved-screens', $this->alice, ['name' => 'Dup', 'criteria' => $this->criteria()]);
        self::assertSame(409, $this->call('POST', '/internal/saved-screens', $this->alice, ['name' => 'Dup', 'criteria' => $this->criteria()])->status);
        // Same name for a different user is fine.
        self::assertSame(201, $this->call('POST', '/internal/saved-screens', $this->bob, ['name' => 'Dup', 'criteria' => $this->criteria()])->status);
    }

    public function testRejectsMalformedCriteria(): void
    {
        $cases = [
            ['filters' => ['made_up_metric' => ['min' => 1]]],
            ['filters' => ['pe_ratio' => ['min' => 50, 'max' => 10]]],
            ['filters' => ['pe_ratio' => ['min' => '10']]],
            ['filters' => ['pe_ratio' => []]],
            ['filters' => ['pe_ratio' => ['min' => 1e12]]],
            ['filters' => [], 'sort' => ['field' => 'DROP TABLE', 'direction' => 'asc']],
            ['filters' => [], 'sector' => '../etc'],
            ['filters' => [], 'extra' => true],
        ];
        foreach ($cases as $i => $criteria) {
            $res = $this->call('POST', '/internal/saved-screens', $this->alice, ['name' => "Bad {$i}", 'criteria' => $criteria]);
            self::assertSame(422, $res->status, "case {$i} should be rejected");
        }
        self::assertSame(422, $this->call('POST', '/internal/saved-screens', $this->alice, ['name' => 'No criteria'])->status);
        self::assertSame(422, $this->call('POST', '/internal/saved-screens', $this->alice, ['name' => str_repeat('n', 81), 'criteria' => $this->criteria()])->status);
        self::assertSame(0, (int) $this->db->query('SELECT COUNT(*) FROM saved_screens')->fetchColumn());
    }
}
