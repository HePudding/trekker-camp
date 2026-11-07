/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { describe, test } from 'vitest';
import { host, origin, relativeFetch } from '../utils.js';

describe('.well-known', () => {
	test.each([
		'nodeinfo',
		`webfinger?resource=acct:alice@${host}`,
		'host-meta',
		'host-meta.json',
	])('rejects federation discovery at %s', async (path) => {
		const res = await relativeFetch(`.well-known/${path}`);
		assert.strictEqual(res.status, 403);
		assert.strictEqual(res.headers.get('Access-Control-Allow-Origin'), '*');
	});

	test('webfinger preflight', async () => {
		const res = await relativeFetch(`.well-known/webfinger?resource=acct:alice@${host}`, {
			method: 'options',
			headers: {
				'Access-Control-Request-Method': 'GET',
				Origin: 'http://example.com',
			},
		});
		assert.strictEqual(res.status, 204);
		assert.strictEqual(res.headers.get('Access-Control-Allow-Headers'), 'Accept');
	});

	test('oauth-authorization-server', async () => {
		const res = await relativeFetch('.well-known/oauth-authorization-server');
		assert.ok(res.ok);
		assert.strictEqual(res.headers.get('Access-Control-Allow-Origin'), '*');

		const serverInfo = await res.json() as any;
		assert.strictEqual(serverInfo.issuer, origin);
		assert.strictEqual(serverInfo.authorization_endpoint, `${origin}/oauth/authorize`);
		assert.strictEqual(serverInfo.token_endpoint, `${origin}/oauth/token`);
	});
});
