/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { randomInt } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import * as OTPAuth from 'otpauth';
import type * as Misskey from 'misskey-js';
import type { DataSource } from 'typeorm';
import { api, castAsError, initTestDb, signup, signupParameters, relativeFetch, sendEnvUpdateRequest } from '../utils.js';
import { verificationCode } from '../misc/verification-code.js';
import { MiUserProfile, MiMeta, MiUser, MiPasswordResetRequest } from '@/models/_.js';

describe('Phone registration and password recovery API', () => {
	let db: DataSource;
	let alice: Misskey.entities.SignupResponse;
	let bob: Misskey.entities.SignupResponse;
	let alicePhone: string;
	const anonymousPhone = `138${randomInt(0, 100000000).toString().padStart(8, '0')}`;
	beforeAll(async () => {
		db = await initTestDb(true);
		alice = await signup({ username: 'phone_alice' });
		bob = await signup({ username: 'phone_bob' });
		alicePhone = (await db.getRepository(MiUserProfile).findOneByOrFail({ userId: alice.id })).phoneNumber!;
	});
	afterAll(async () => { await db.destroy(); });

	test('requires a phone even with email registration enabled and rejects the old email completion route', async () => {
		const body = await signupParameters({ username: 'no_phone', phoneChallengeId: '', phoneCode: '' });
		const result = await api('signup', body);
		expect(result.status).toBe(400);
		expect(castAsError(result.body).error.code).toBe('INVALID_CODE');
		const legacy = await api('signup-pending', { code: 'legacy-email-link' });
		expect(legacy.status).toBe(410);
	});

	test('stores exactly one phone and returns only its masked form to the owner', async () => {
		expect(alice.phoneNumber).toBe(alicePhone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2'));
		const publicUser = await api('users/show', { userId: alice.id });
		expect(publicUser.body).not.toHaveProperty('phoneNumber');
		const request = await signupParameters({ username: 'duplicate_phone' });
		const proof = await verificationCode('signup', alicePhone);
		const result = await api('signup', { ...request, phoneChallengeId: proof.challengeId, phoneCode: proof.code });
		expect(result.status).toBe(400);
		expect(castAsError(result.body).error.code).toBe('PHONE_UNAVAILABLE');
	});

	test('allows anonymous CAPTCHA-gated sends and keeps admin credentials out of settings responses', async () => {
		const configured = await api('admin/update-verification-settings', { accessKeyId: 'test-id', accessKeySecret: 'test-secret', signName: '测试', templateCode: '100001', interval: 90, ipHourly: 1000 }, alice);
		expect(configured.status).toBe(204);
		const stored = (await db.getRepository(MiMeta).findOneByOrFail({ id: 'x' })).verificationSettings;
		expect(stored).not.toHaveProperty('i');
		expect(stored.interval).toBe(90);
		const settings = await api('admin/verification-settings', {}, alice);
		expect(settings.body).not.toHaveProperty('accessKeySecret');
		expect(settings.body).not.toHaveProperty('i');
		expect(settings.body.hasAccessKeySecret).toBe(true);
		expect(settings.body).toMatchObject({ changePhoneTemplateCode: '100002', resetPasswordTemplateCode: '100003', bindPhoneTemplateCode: '100004', verifyPhoneTemplateCode: '100005' });
		expect((await api('admin/update-verification-settings', { resetPasswordTemplateCode: '' }, alice)).status).toBe(400);
		expect((await api('admin/verification-settings', {}, bob)).status).toBe(403);
		await api('admin/update-meta', { enableTestcaptcha: true }, alice);
		await expect.poll(async () => (await api('meta', {})).body.enableTestcaptcha).toBe(true);

		const blocked = await api('auth/send-code', { channel: 'sms', purpose: 'password-reset', address: '13800138000' });
		expect(blocked.body).toMatchObject({ error: { code: 'CAPTCHA_FAILED' } });
		const allowed = await api('auth/send-code', { channel: 'sms', purpose: 'password-reset', address: anonymousPhone, 'testcaptcha-response': 'testcaptcha-passed' });
		expect(allowed.status).toBe(200);
		expect(allowed.body).toEqual({ challengeId: expect.any(String), retryAfter: 90 });
		const limited = await api('auth/send-code', { channel: 'sms', purpose: 'password-reset', address: `+86${anonymousPhone}`, 'testcaptcha-response': 'testcaptcha-passed' });
		expect(limited.status).toBe(429);
		expect(limited.body).toMatchObject({ error: { code: 'RATE_LIMIT_EXCEEDED', info: { retryAfter: expect.any(Number), resetMs: expect.any(Number) } } });
		const rateLimit = castAsError(limited.body).error.info as { retryAfter: number; resetMs: number };
		expect(rateLimit.retryAfter).toBeGreaterThan(0);
		expect(rateLimit.retryAfter).toBeLessThanOrEqual(90);
		expect(rateLimit.resetMs).toBeGreaterThan(Date.now());
		const invalidSetting = await api('admin/update-verification-settings', { interval: 0 }, alice);
		expect(invalidSetting.status).toBe(400);
	});

	test('requires a password and removes both code-login and passwordless entrypoints', async () => {
		for (const endpoint of ['signin-code', 'signin-with-passkey', 'i/2fa/password-less']) {
			const response = await relativeFetch(`api/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
			expect(response.status).toBe(404);
		}
		for (const channel of ['sms', 'email']) {
			const response = await relativeFetch('api/auth/send-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel, purpose: 'signin', address: anonymousPhone }) });
			expect(response.status).toBe(400);
		}
		expect((await api('signin-flow', { username: alice.username, password: 'wrong-password' })).status).toBe(403);
		expect((await api('signin-flow', { username: alice.username, password: 'test', 'testcaptcha-response': 'testcaptcha-passed' })).body).toMatchObject({ finished: true, id: alice.id });
	});

	test('keeps password and 2FA mandatory even for an old passwordless account', async () => {
		const secret = 'JBSWY3DPEHPK3PXP';
		await db.getRepository(MiUserProfile).update(alice.id, { twoFactorEnabled: true, twoFactorSecret: secret, usePasswordLessLogin: true });
		const parameters = { username: alice.username, password: 'test' };
		await sendEnvUpdateRequest({ key: 'MISSKEY_TEST_CHECK_DUPLICATED_TOTP', value: '1' });
		expect((await api('signin-flow', parameters)).body).toMatchObject({ finished: false, next: 'totp' });
		expect((await api('signin-flow', { ...parameters, token: 'wrong-code' })).status).toBe(403);
		expect((await api('signin-flow', { ...parameters, password: 'wrong-password', credential: { id: 'key', rawId: 'key', type: 'public-key', response: { clientDataJSON: '', authenticatorData: '', signature: '' }, clientExtensionResults: {} } })).status).toBe(403);
		const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30 });
		expect((await api('signin-flow', { ...parameters, token: totp.generate() })).body).toMatchObject({ finished: true, id: alice.id });
		await db.getRepository(MiUserProfile).update(alice.id, { twoFactorEnabled: false, twoFactorSecret: null, usePasswordLessLogin: false });
		await sendEnvUpdateRequest({ key: 'MISSKEY_TEST_CHECK_DUPLICATED_TOTP', value: '' });
	});

	test('reports verified-email preference without creating a server waiting session', async () => {
		await api('admin/update-meta', { enableEmail: true }, alice);
		await expect.poll(async () => (await api('meta', {})).body.enableEmail).toBe(true);
		try {
			await db.getRepository(MiUserProfile).update(alice.id, { email: null, emailVerified: false });
			expect((await api('auth/begin-password-reset', { username: alice.username })).body).toEqual({ preferEmail: false });
			await db.getRepository(MiUserProfile).update(alice.id, { email: 'recovery-choice@example.com', emailVerified: false });
			expect((await api('auth/begin-password-reset', { username: alice.username })).body).toEqual({ preferEmail: false });
			await db.getRepository(MiUserProfile).update(alice.id, { emailVerified: true });
			expect((await api('auth/begin-password-reset', { username: alice.username })).body).toEqual({ preferEmail: true });
			expect((await api('auth/begin-password-reset', { username: 'unknown_account' })).body).toEqual({ preferEmail: false });
		} finally {
			await api('admin/update-meta', { enableEmail: false }, alice);
			await expect.poll(async () => (await api('meta', {})).body.enableEmail).toBe(false);
		}
	});

	test('accepts email reset codes only while their verified address remains bound', async () => {
		const user = await signup({ username: 'email_recovery' });
		await db.getRepository(MiUserProfile).update(user.id, { email: 'recovery@example.com', emailVerified: false });
		const proof = await verificationCode('password-reset', 'recovery@example.com', user.id, 'email');
		const parameters = { ...proof, password: 'new-email-password' };
		expect((await api('reset-password', parameters)).status).toBe(400);
		await db.getRepository(MiUserProfile).update(user.id, { emailVerified: true });
		expect((await api('reset-password', parameters)).status).toBe(204);
		expect((await api('reset-password', parameters)).status).toBe(400);
		expect((await api('signin-flow', { username: user.username, password: 'test' })).status).toBe(403);
		expect((await api('signin-flow', { username: user.username, password: parameters.password, 'testcaptcha-response': 'testcaptcha-passed' })).body).toMatchObject({ finished: true });
		const stale = await verificationCode('password-reset', 'recovery@example.com', user.id, 'email');
		await db.getRepository(MiUserProfile).update(user.id, { email: 'changed@example.com' });
		expect((await api('reset-password', { ...stale, password: 'different-password' })).status).toBe(400);
	});

	test('verifies both phones on a change and invalidates old-phone recovery proofs', async () => {
		const nextPhone = '13800138111';
		const next = await verificationCode('phone-new', nextPhone, alice.id);
		const old = await verificationCode('phone-old', alicePhone, alice.id);
		const parameters = { password: 'test', newChallengeId: next.challengeId, newCode: next.code, oldChallengeId: old.challengeId, oldCode: old.code };
		expect((await api('i/update-phone', parameters, bob)).status).toBe(400);
		expect((await api('i/update-phone', { ...parameters, oldChallengeId: undefined, oldCode: undefined }, alice)).status).toBe(400);
		const stale = await verificationCode('password-reset', alicePhone, alice.id);
		const changed = await api('i/update-phone', parameters, alice);
		expect(changed.status).toBe(200);
		expect(changed.body.phoneNumber).toBe('138****8111');
		expect((await api('reset-password', { ...stale, password: 'changed' })).status).toBe(400);
	});

	test('prevents two pending email bindings from verifying the same address', async () => {
		await db.getRepository(MiUserProfile).update(alice.id, { email: 'Shared@example.com', emailVerifyCode: 'alice-email', emailVerified: false });
		await db.getRepository(MiUserProfile).update(bob.id, { email: 'shared@example.com', emailVerifyCode: 'bob-email', emailVerified: false });
		const results = await Promise.all([api('verify-email', { code: 'alice-email' }), api('verify-email', { code: 'bob-email' })]);
		expect(results.map(result => result.status).sort()).toEqual([204, 400]);
	});

	test('resets a password with a single-use phone proof and preserves 2FA', async () => {
		const user = await signup({ username: 'phone_reset' });
		const profile = await db.getRepository(MiUserProfile).findOneByOrFail({ userId: user.id });
		await db.getRepository(MiUserProfile).update(user.id, { twoFactorEnabled: true, twoFactorSecret: 'JBSWY3DPEHPK3PXP' });
		const signupProof = await verificationCode('signup', profile.phoneNumber!, user.id);
		expect((await api('reset-password', { ...signupProof, password: 'new-password' })).status).toBe(400);
		const proof = await verificationCode('password-reset', profile.phoneNumber!, user.id);
		const parameters = { ...proof, password: 'new-password' };
		expect((await api('reset-password', { ...parameters, password: '' })).status).toBe(400);
		expect((await api('reset-password', parameters)).status).toBe(204);
		expect((await api('reset-password', parameters)).status).toBe(400);
		expect((await api('signin-flow', { username: user.username, password: 'test' })).status).toBe(403);
		expect((await api('signin-flow', { username: user.username, password: 'new-password' })).body).toMatchObject({ finished: false, next: 'totp' });
		expect((await db.getRepository(MiUserProfile).findOneByOrFail({ userId: user.id })).twoFactorEnabled).toBe(true);
	});

	test('rejects recovery of suspended users and keeps existing email reset links working', async () => {
		const user = await signup({ username: 'recovery_suspended' });
		const profile = await db.getRepository(MiUserProfile).findOneByOrFail({ userId: user.id });
		await db.getRepository(MiUser).update(user.id, { isSuspended: true });
		const proof = await verificationCode('password-reset', profile.phoneNumber!, user.id);
		expect((await api('reset-password', { ...proof, password: 'new-password' })).status).toBe(400);
		await db.getRepository(MiUser).update(user.id, { isSuspended: false });
		await db.getRepository(MiPasswordResetRequest).insert({ id: user.id, userId: user.id, token: 'email-reset-fixture' });
		expect((await api('reset-password', { token: 'email-reset-fixture', password: 'email-new-password' })).status).toBe(204);
	});

	test('email recovery needs no CAPTCHA or SMS credentials and does not expose missing accounts', async () => {
		await api('admin/update-meta', { enableEmail: true }, alice);
		await expect.poll(async () => (await api('meta', {})).body.enableEmail).toBe(true);
		for (let attempt = 0; attempt < 2; attempt++) {
			const result = await api('auth/send-code', { channel: 'email', purpose: 'password-reset', username: 'missing', address: 'unbound@example.com' });
			expect(result.status).toBe(200);
			expect(result.body).toEqual({ challengeId: expect.any(String), retryAfter: 0 });
		}
	});
});
