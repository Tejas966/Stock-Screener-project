<?php
declare(strict_types=1);

namespace FundamentalX\Tests;

final class ResearchNotesTest extends ServiceTestCase
{
    public function testFullCrudLifecycle(): void
    {
        $created = $this->call('POST', '/internal/research-notes', $this->alice, [
            'title' => '  TCS margin thoughts ', 'content' => 'Operating margin stable across years.', 'company_symbol' => 'tcs.ns',
        ]);
        self::assertSame(201, $created->status);
        $note = $created->body['data'];
        self::assertSame('TCS margin thoughts', $note['title']);
        self::assertSame('TCS.NS', $note['company_symbol']);

        // persisted in MySQL
        $count = $this->db->query('SELECT COUNT(*) FROM research_notes')->fetchColumn();
        self::assertSame(1, (int) $count);

        $list = $this->call('GET', '/internal/research-notes', $this->alice);
        self::assertSame(1, $list->body['data']['total']);

        $updated = $this->call('PUT', "/internal/research-notes/{$note['id']}", $this->alice, ['content' => 'Revised view.', 'company_symbol' => null]);
        self::assertSame(200, $updated->status);
        self::assertSame('Revised view.', $updated->body['data']['content']);
        self::assertNull($updated->body['data']['company_symbol']);

        self::assertSame(204, $this->call('DELETE', "/internal/research-notes/{$note['id']}", $this->alice)->status);
        self::assertSame(404, $this->call('GET', "/internal/research-notes/{$note['id']}", $this->alice)->status);
        self::assertSame(0, (int) $this->db->query('SELECT COUNT(*) FROM research_notes')->fetchColumn());
    }

    public function testOwnershipIsEnforced(): void
    {
        $id = $this->call('POST', '/internal/research-notes', $this->alice, ['title' => 'Private', 'content' => 'Alice only'])->body['data']['id'];
        self::assertSame(404, $this->call('GET', "/internal/research-notes/{$id}", $this->bob)->status);
        self::assertSame(404, $this->call('PUT', "/internal/research-notes/{$id}", $this->bob, ['title' => 'Hacked'])->status);
        self::assertSame(404, $this->call('DELETE', "/internal/research-notes/{$id}", $this->bob)->status);
        self::assertSame(0, $this->call('GET', '/internal/research-notes', $this->bob)->body['data']['total']);
        $title = $this->db->query("SELECT title FROM research_notes WHERE id = {$id}")->fetchColumn();
        self::assertSame('Private', $title);
    }

    public function testValidationErrors(): void
    {
        $res = $this->call('POST', '/internal/research-notes', $this->alice, ['title' => '', 'content' => str_repeat('a', 10001)]);
        self::assertSame(422, $res->status);
        self::assertArrayHasKey('title', $res->body['error']['details']);
        self::assertArrayHasKey('content', $res->body['error']['details']);

        $res = $this->call('POST', '/internal/research-notes', $this->alice, ['title' => 'x', 'content' => 'y', 'company_symbol' => 'NOPE.NS']);
        self::assertSame(422, $res->status);
        self::assertSame('Unknown company', $res->body['error']['details']['company_symbol']);

        $res = $this->call('POST', '/internal/research-notes', $this->alice, ['title' => 'x', 'content' => 'y', 'user_id' => $this->bob]);
        self::assertSame(422, $res->status, 'user_id in body must be rejected, never trusted');

        $res = $this->call('POST', '/internal/research-notes', $this->alice, ['title' => ['array'], 'content' => 'y']);
        self::assertSame(422, $res->status);
    }

    public function testSqlInjectionAttemptIsStoredAsPlainText(): void
    {
        $payload = "'); DROP TABLE research_notes; --";
        $res = $this->call('POST', '/internal/research-notes', $this->alice, ['title' => $payload, 'content' => 'test']);
        self::assertSame(201, $res->status);
        self::assertSame($payload, $res->body['data']['title']);
        self::assertSame(1, (int) $this->db->query('SELECT COUNT(*) FROM research_notes')->fetchColumn());
    }

    public function testFilterByCompanyAndPagination(): void
    {
        foreach (['INFY.NS', 'INFY.NS', 'TCS.NS'] as $i => $sym) {
            $this->call('POST', '/internal/research-notes', $this->alice, ['title' => "Note {$i}", 'content' => 'c', 'company_symbol' => $sym]);
        }
        $infy = $this->call('GET', '/internal/research-notes', $this->alice, null, ['company' => 'INFY.NS']);
        self::assertSame(2, $infy->body['data']['total']);
        $page = $this->call('GET', '/internal/research-notes', $this->alice, null, ['limit' => '1', 'offset' => '1']);
        self::assertCount(1, $page->body['data']['items']);
        self::assertSame(3, $page->body['data']['total']);
        self::assertSame(422, $this->call('GET', '/internal/research-notes', $this->alice, null, ['limit' => '500'])->status);
    }
}
