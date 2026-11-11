/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import type * as Misskey from 'misskey-js';
import type { DataSource } from 'typeorm';
import { api, initTestDb, signup, signupParameters } from '../utils.js';
import { verificationCode } from '../misc/verification-code.js';
import { MiUser, MiUserProfile } from '@/models/_.js';

describe('Registration options', () => {
	let db: DataSource;
	let admin: Misskey.entities.SignupResponse;
	let member: Misskey.entities.SignupResponse;

	async function settings(values: Misskey.entities.AdminUpdateMetaRequest) {
		expect((await api('admin/update-meta', values, admin)).status).toBe(204);
		const { enablePhoneVerification, allowEmailSignup, restrictSignupEmailDomains, requireNumericQqEmail } = values;
		const expected = Object.fromEntries(Object.entries({ enablePhoneVerification, allowEmailSignup, restrictSignupEmailDomains, requireNumericQqEmail }).filter(([, value]) => value !== undefined));
		await expect.poll(async () => (await api('meta', {})).body).toMatchObject(expected);
	}

	async function emailRequest(username: string, address: string) {
		const proof = await verificationCode('signup', address, null, 'email');
		return signupParameters({ username, phoneChallengeId: undefined, phoneCode: undefined, emailChallengeId: proof.challengeId, emailCode: proof.code });
	}

	beforeAll(async () => {
		db = await initTestDb(true);
		admin = await signup({ username: 'registration_admin' });
		member = await signup({ username: 'registration_member' });
	});
	beforeEach(async () => {
		await settings({ enablePhoneVerification: false, allowEmailSignup: false, enableEmail: true, disableRegistration: false, restrictSignupEmailDomains: false, requireNumericQqEmail: false });
	});
	afterAll(async () => { await db.destroy(); });

	test('creates an account only after email verification and consumes the proof once', async () => {
		const request = await emailRequest('verified_email', 'verified@gmail.com');
		for (const emailCode of [undefined, '000000']) {
			const result = await api('signup', { ...request, emailCode });
			expect(result.status).toBe(400);
			expect(await db.getRepository(MiUser).existsBy({ username: request.username })).toBe(false);
		}
		const result = await api('signup', request);
		expect(result.status).toBe(200);
		expect(result.body).toMatchObject({ email: 'verified@gmail.com', emailVerified: true, phoneNumber: null });
		expect(await db.getRepository(MiUserProfile).findOneByOrFail({ userId: result.body.id })).toMatchObject({ email: 'verified@gmail.com', emailVerified: true, phoneNumber: null });
		expect((await api('signup', { ...request, username: 'replayed_email' })).status).toBe(400);
		expect(await db.getRepository(MiUser).existsBy({ username: 'replayed_email' })).toBe(false);
	});

	test('rejects a recovery proof, a duplicate email and a missing invitation', async () => {
		const request = await emailRequest('invalid_email_proof', 'invalid@gmail.com');
		const recovery = await verificationCode('password-reset', 'invalid@gmail.com', member.id, 'email');
		expect((await api('signup', { ...request, emailChallengeId: recovery.challengeId, emailCode: recovery.code })).status).toBe(400);
		await db.getRepository(MiUserProfile).update(member.id, { email: 'used@gmail.com', emailVerified: true });
		const duplicate = await api('signup', await emailRequest('duplicate_email', 'used@gmail.com'));
		expect(duplicate.body).toMatchObject({ error: { code: 'EMAIL_UNAVAILABLE' } });
		await settings({ disableRegistration: true });
		expect((await api('signup', { ...request, invitationCode: undefined })).body).toMatchObject({ error: { code: 'REGISTRATION_CLOSED' } });
		expect((await api('signup', request)).status).toBe(200);
	});

	test('allows email alongside phone signup only when enabled', async () => {
		await settings({ enablePhoneVerification: true });
		const request = await emailRequest('dual_email', 'dual@gmail.com');
		expect((await api('signup', request)).body).toMatchObject({ error: { code: 'VERIFICATION_UNAVAILABLE' } });
		expect((await api('auth/send-code', { channel: 'email', purpose: 'signup', address: 'dual@gmail.com' })).body).toMatchObject({ error: { code: 'VERIFICATION_UNAVAILABLE' } });
		await settings({ allowEmailSignup: true });
		expect((await api('signup', request)).status).toBe(200);
		expect((await signup({ username: 'dual_phone' })).phoneNumber).toBeTruthy();
		const pending = await emailRequest('disabled_email', 'disabled@gmail.com');
		await settings({ allowEmailSignup: false });
		expect((await api('signup', pending)).body).toMatchObject({ error: { code: 'VERIFICATION_UNAVAILABLE' } });
	});

	test('hot switches despite phone-only users and blocks outstanding SMS proofs on every entrypoint', async () => {
		await settings({ enablePhoneVerification: true });
		const request = await signupParameters({ username: 'pending_sms' });
		const profile = await db.getRepository(MiUserProfile).findOneByOrFail({ userId: admin.id });
		expect(profile.email).toBeNull();
		const recovery = await verificationCode('password-reset', profile.phoneNumber!, admin.id);
		const binding = await verificationCode('phone-new', '13800138999', member.id);
		await settings({ enablePhoneVerification: false });
		expect((await api('meta', {})).body).toMatchObject({ phoneVerificationAvailable: false, emailRequiredForSignup: true });
		expect((await api('signup', request)).body).toMatchObject({ error: { code: 'VERIFICATION_UNAVAILABLE' } });
		expect((await api('auth/send-code', { channel: 'sms', purpose: 'signup', address: '13800138999' })).body).toMatchObject({ error: { code: 'VERIFICATION_UNAVAILABLE' } });
		expect((await api('reset-password', { ...recovery, password: 'new-password' })).body).toMatchObject({ error: { code: 'VERIFICATION_UNAVAILABLE' } });
		expect((await api('i/update-phone', { password: 'test', newChallengeId: binding.challengeId, newCode: binding.code }, member)).body).toMatchObject({ error: { code: 'VERIFICATION_UNAVAILABLE' } });
		expect((await api('admin/send-sms', { to: '13800138999' }, admin)).body).toMatchObject({ error: { code: 'VERIFICATION_UNAVAILABLE' } });
		await settings({ enablePhoneVerification: true });
		expect((await api('signup', request)).status).toBe(200);
	});

	test.each([
		['qq_alias', 'alias@qq.com', 'QQ_EMAIL_MUST_BE_NUMERIC'],
		['other_domain', 'alice@example.org', 'EMAIL_DOMAIN_NOT_ALLOWED'],
		['fake_qq', '123@qq.com.example.org', 'EMAIL_DOMAIN_NOT_ALLOWED'],
	])('enforces restrictions at both send and submit for %s', async (username, address, code) => {
		const request = await emailRequest(username, address);
		await settings({ restrictSignupEmailDomains: true, requireNumericQqEmail: true });
		expect((await api('auth/send-code', { channel: 'email', purpose: 'signup', address })).body).toMatchObject({ error: { code } });
		expect((await api('signup', request)).body).toMatchObject({ error: { code } });
		expect(await db.getRepository(MiUser).existsBy({ username })).toBe(false);
	});

	test('permits numeric QQ and Gmail and applies restored policies without a restart', async () => {
		await settings({ restrictSignupEmailDomains: true, requireNumericQqEmail: true });
		expect((await api('signup', await emailRequest('numeric_qq', '123456789@qq.com'))).status).toBe(200);
		expect((await api('signup', await emailRequest('allowed_gmail', 'allowed@gmail.com'))).status).toBe(200);
		await settings({ requireNumericQqEmail: false });
		expect((await api('signup', await emailRequest('allowed_alias', 'allowed@qq.com'))).status).toBe(200);
		await settings({ restrictSignupEmailDomains: false });
		expect((await api('signup', await emailRequest('allowed_other', 'allowed@example.org'))).status).toBe(200);
	});

	test('requires admin access to SMS configuration and tests', async () => {
		const anonymous = await api('admin/send-sms', { to: '13800138999' });
		expect(anonymous.status).toBe(400);
		expect(anonymous.body).toMatchObject({ error: { code: 'ACCESS_DENIED' } });
		expect((await api('admin/send-sms', { to: '13800138999' }, member)).status).toBe(403);
		expect((await api('admin/update-verification-settings', { enablePhoneVerification: true }, member)).status).toBe(403);
		expect((await api('admin/update-verification-settings', { enablePhoneVerification: true, allowEmailSignup: true }, admin)).status).toBe(204);
		expect((await api('admin/verification-settings', {}, admin)).body).toMatchObject({ enablePhoneVerification: true, allowEmailSignup: true });
	});
});
