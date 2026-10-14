<?php
declare(strict_types=1);

namespace FundamentalX\Tests;

use FundamentalX\Http\Request;

final class SecurityTest extends ServiceTestCase
{
    public function testHealthNeedsNoAuth(): void
    {
        self::assertSame(200, $this->call('GET', '/health', null, null, [], null)->status);
    }

    public function testMissingSecretIsRejected(): void
    {
        $res = $this->call('GET', '/internal/research-notes', $this->alice, null, [], null);
        self::assertSame(401, $res->status);
        self::assertSame('UNAUTHORIZED_SERVICE', $res->body['error']['code']);
    }

    public function testWrongSecretIsRejected(): void
    {
        self::assertSame(401, $this->call('GET', '/internal/saved-screens', $this->alice, null, [], 'wrong-secret-xxxxxxxx')->status);
    }

    public function testInvalidOrUnknownUserIdIsRejected(): void
    {
        self::assertSame(401, $this->call('GET', '/internal/saved-screens', null)->status);
        self::assertSame(401, $this->call('GET', '/internal/saved-screens', 999999)->status);
        $res = $this->app->handle(new Request('GET', '/internal/saved-screens', ['x-internal-secret' => self::SECRET, 'x-user-id' => '1 OR 1=1']));
        self::assertSame(401, $res->status);
    }

    public function testUnknownRouteAndMethod(): void
    {
        self::assertSame(404, $this->call('GET', '/internal/nope', $this->alice)->status);
        self::assertSame(405, $this->call('PATCH', '/internal/saved-screens', $this->alice)->status);
    }

    public function testMalformedJsonAndWrongContentType(): void
    {
        $res = $this->app->handle(new Request('POST', '/internal/research-notes',
            ['x-internal-secret' => self::SECRET, 'x-user-id' => (string) $this->alice, 'content-type' => 'application/json'], [], '{bad json'));
        self::assertSame(400, $res->status);
        $res = $this->app->handle(new Request('POST', '/internal/research-notes',
            ['x-internal-secret' => self::SECRET, 'x-user-id' => (string) $this->alice, 'content-type' => 'text/plain'], [], '{}'));
        self::assertSame(415, $res->status);
    }

    public function testShortSecretConfigurationRefused(): void
    {
        $this->expectException(\RuntimeException::class);
        new \FundamentalX\App($this->db, 'short');
    }
}
