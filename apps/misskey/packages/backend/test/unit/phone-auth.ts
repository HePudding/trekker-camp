/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createHash, randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { Response } from 'node-fetch';
import bcrypt from 'bcryptjs';
import type { MetaService } from '@/core/MetaService.js';
import type { CaptchaService, CaptchaSetting } from '@/core/CaptchaService.js';
import type { EmailService } from '@/core/EmailService.js';
import type { HttpRequestService } from '@/core/HttpRequestService.js';
import type { UserAuthService } from '@/core/UserAuthService.js';
import type { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { GlobalEventService } from '@/core/GlobalEventService.js';
import type { MiMeta, MiUserProfile, UsersRepository, UserProfilesRepository, RegistrationTicketsRepository } from '@/models/_.js';
import type { MiLocalUser } from '@/models/User.js';
import { loadConfig } from '@/config.js';
import { VerificationCodeService, verificationDefaults, normalizePhone } from '@/core/VerificationCodeService.js';
import SendCode from '@/server/api/endpoints/auth/send-code.js';
import BeginPasswordReset from '@/server/api/endpoints/auth/begin-password-reset.js';
import UpdateEmail from '@/server/api/endpoints/i/update-email.js';
import UpdateVerificationSettings from '@/server/api/endpoints/admin/update-verification-settings.js';
import Logger from '@/logger.js';

describe('Phone and email verification', () => {
	let redis: Redis;
	const meta = mock<MetaService>();
	const captcha = mock<CaptchaService>();
	const email = mock<EmailService>();
	const http = mock<HttpRequestService>();
	const profiles = mock<UserProfilesRepository>();
	const users = mock<UsersRepository>();
	const tickets = mock<RegistrationTicketsRepository>();
	let codes: VerificationCodeService;
	let settings: MiMeta;
	let send: SendCode;

	beforeEach(() => {
		vi.resetAllMocks();
		redis = new Redis({ ...loadConfig().redis, keyPrefix: `phone-auth-test:${randomUUID()}:` });
		settings = { verificationSettings: { ...verificationDefaults, accessKeyId: 'test-id', accessKeySecret: 'test-secret', signName: '测试', templateCode: '100001' }, enableEmail: true, disableRegistration: false } as MiMeta;
		meta.fetch.mockResolvedValue(settings);
		captcha.get.mockResolvedValue({ provider: 'none' } as unknown as CaptchaSetting);
		http.send.mockImplementation(async () => new Response(JSON.stringify({ Code: 'OK', Success: true, Model: { VerifyResult: 'PASS' } })));
		email.sendEmail.mockResolvedValue(undefined);
		codes = new VerificationCodeService(redis, meta, captcha, email, http);
		send = new SendCode(profiles, users, tickets, meta, codes);
	});
	afterEach(async () => { vi.restoreAllMocks(); await redis.quit(); });

	test('normalizes +86 and rejects other country codes and malformed numbers', () => {
		expect(normalizePhone(' +8613800138000 ')).toBe('13800138000');
		for (const invalid of ['+14155551234', '1380013800', 'abc', '12800138000']) expect(() => normalizePhone(invalid)).toThrow('INVALID_PHONE');
	});

	test.each([
		['hcaptcha', 'hcaptcha-response', 'verifyHcaptcha'],
		['mcaptcha', 'm-captcha-response', 'verifyMcaptcha'],
		['recaptcha', 'g-recaptcha-response', 'verifyRecaptcha'],
		['turnstile', 'turnstile-response', 'verifyTurnstile'],
		['testcaptcha', 'testcaptcha-response', 'verifyTestcaptcha'],
	] as const)('checks enabled %s before sending', async (provider, tokenKey, method) => {
		captcha.get.mockResolvedValue({
			provider,
			[provider]: { secretKey: 'secret', siteKey: 'site', instanceUrl: 'https://captcha.example' },
		} as unknown as CaptchaSetting);
		captcha[method].mockRejectedValueOnce(new Error('failed'));
		await expect(send.exec({ channel: 'sms', purpose: 'signup', address: '13800138000', [tokenKey]: 'answer' }, null, null, undefined, '192.0.2.1')).rejects.toMatchObject({ code: 'CAPTCHA_FAILED' });
		expect(captcha[method]).toHaveBeenCalled();
		expect(http.send).not.toHaveBeenCalled();
	});

	test('enabled CAPTCHA without its secret fails closed', async () => {
		captcha.get.mockResolvedValue({ provider: 'turnstile', turnstile: { secretKey: null } } as unknown as CaptchaSetting);
		await expect(codes.verifyCaptcha({ 'turnstile-response': 'answer' })).rejects.toThrow('CAPTCHA_FAILED');
	});

	test('signs a POST and asks Aliyun to generate the code without returning it', async () => {
		const result = await codes.send('sms', 'signup', '13800138000', null);
		const [url, options] = http.send.mock.calls[0];
		const params = new URLSearchParams(options?.body as string);
		expect(url).toBe('https://dypnsapi.aliyuncs.com/');
		expect(options?.method).toBe('POST');
		expect(params.get('TemplateParam')).toBe('{"code":"##code##","min":"5"}');
		expect(params.get('ReturnVerifyCode')).toBe('false');
		expect(params.get('DuplicatePolicy')).toBe('1');
		expect(params.get('SchemeName')).toBe('camp-su');
		expect(params.get('Signature')).toBeTruthy();
		expect(result).toEqual({ challengeId: expect.any(String), retryAfter: 60 });
		await codes.verify(result.challengeId, '123456', 'signup');
		const verify = new URLSearchParams(http.send.mock.calls[1][1]?.body as string);
		expect(verify.get('Action')).toBe('CheckSmsVerifyCode');
		expect(verify.get('SchemeName')).toBe(params.get('SchemeName'));
		expect(verify.get('OutId')).toBe(params.get('OutId'));
	});

	test('removes copied tabs and spaces from existing settings before signing and sending', async () => {
		Object.assign(settings.verificationSettings, { templateCode: '\t100001', signName: ' 测试\n', accessKeyId: '\ttest-id ', accessKeySecret: ' test-secret\n' });
		await codes.send('sms', 'signup', '13800138000', null);
		const parameters = new URLSearchParams(http.send.mock.calls[0][1]?.body as string);
		expect(parameters.get('TemplateCode')).toBe('100001');
		expect(parameters.get('SignName')).toBe('测试');
		expect(parameters.get('AccessKeyId')).toBe('test-id');
		expect(await codes.settings()).toMatchObject({ accessKeySecret: 'test-secret' });
	});

	test('saves trimmed template settings without accepting unrelated request fields', async () => {
		const update = new UpdateVerificationSettings(codes, meta);
		await update.exec({ templateCode: '\t100001', bindPhoneTemplateCode: ' 100004\n', accessKeySecret: ' secret\t', i: 'private-token' }, { id: 'admin' } as MiLocalUser, null);
		const saved = meta.update.mock.calls[0][0].verificationSettings;
		expect(saved).toMatchObject({ templateCode: '100001', bindPhoneTemplateCode: '100004', accessKeySecret: 'secret' });
		expect(saved).not.toHaveProperty('i');
	});

	test('logs provider error codes and request IDs without sensitive messages or request bodies', async () => {
		const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
		try {
			http.send.mockResolvedValue(new Response(JSON.stringify({ Code: 'isv.SMS_TEMPLATE_ILLEGAL', RequestId: 'request-123', Message: 'test-secret 13800138000', AccessKeyId: 'test-id' }), { status: 400 }));
			await expect(codes.send('sms', 'signup', '13800138000', null)).rejects.toThrow('VERIFICATION_UNAVAILABLE');
			expect(warn).toHaveBeenCalledWith('Aliyun verification request failed', { action: 'SendSmsVerifyCode', status: 400, code: 'isv.SMS_TEMPLATE_ILLEGAL', requestId: 'request-123' });
			const output = JSON.stringify(warn.mock.calls);
			for (const sensitive of ['test-secret', 'test-id', '13800138000']) expect(output).not.toContain(sensitive);
		} finally {
			warn.mockRestore();
		}
	});

	test('requires PASS, not just a successful API response', async () => {
		const { challengeId } = await codes.send('sms', 'signup', '13800138000', null);
		http.send.mockResolvedValue(new Response(JSON.stringify({ Code: 'OK', Success: true, Model: { VerifyResult: 'UNKNOWN' } })));
		await expect(codes.verify(challengeId, '123456', 'signup')).rejects.toThrow('INVALID_CODE');
		await expect(codes.consume([challengeId])).rejects.toThrow('INVALID_CODE');
	});

	test.each([
		['signup', false, '100001'],
		['phone-old', false, '100005'],
		['phone-new', false, '100004'],
		['phone-new', true, '100002'],
		['password-reset', false, '100003'],
	] as const)('uses the matching SMS template for %s (replacing=%s)', async (purpose, replacing, template) => {
		await codes.send('sms', purpose, '13800138000', 'alice', replacing);
		const parameters = new URLSearchParams(http.send.mock.calls[0][1]?.body as string);
		expect(parameters.get('TemplateCode')).toBe(template);
	});

	test('uses configured templates while keeping the saved login template', async () => {
		settings.verificationSettings = { accessKeyId: 'test-id', accessKeySecret: 'test-secret', signName: '测试', templateCode: 'login-custom', resetPasswordTemplateCode: 'reset-custom' };
		expect(await codes.settings()).toMatchObject({ templateCode: 'login-custom', bindPhoneTemplateCode: '100004', verifyPhoneTemplateCode: '100005' });
		await codes.send('sms', 'password-reset', '13800138000', 'alice');
		expect(new URLSearchParams(http.send.mock.calls[0][1]?.body as string).get('TemplateCode')).toBe('reset-custom');
	});

	test.each([['13800138009', '100002'], [null, '100004']])('selects the binding template from the account’s current phone (%s)', async (phoneNumber, template) => {
		profiles.findOneByOrFail.mockResolvedValue({ phoneNumber } as MiUserProfile);
		profiles.existsBy.mockResolvedValue(false);
		await send.exec({ channel: 'sms', purpose: 'phone-new', address: '13800138000' }, { id: 'alice' } as MiLocalUser, null, undefined, '192.0.2.1');
		expect(new URLSearchParams(http.send.mock.calls[0][1]?.body as string).get('TemplateCode')).toBe(template);
	});

	test('password reset sends require CAPTCHA and an existing local account', async () => {
		captcha.get.mockResolvedValueOnce({ provider: 'testcaptcha' } as unknown as CaptchaSetting);
		captcha.verifyTestcaptcha.mockRejectedValueOnce(new Error('failed'));
		await expect(send.exec({ channel: 'sms', purpose: 'password-reset', address: '13800138000' }, null, null)).rejects.toMatchObject({ code: 'CAPTCHA_FAILED' });
		expect(http.send).not.toHaveBeenCalled();
		profiles.find.mockResolvedValue([]);
		await send.exec({ channel: 'sms', purpose: 'password-reset', address: '13800138000' }, null, null);
		expect(http.send).not.toHaveBeenCalled();
		profiles.find.mockResolvedValue([{ userId: 'alice' }] as MiUserProfile[]);
		users.findOneBy.mockResolvedValue({ id: 'alice', host: null, isSuspended: false } as MiLocalUser);
		await send.exec({ channel: 'sms', purpose: 'password-reset', address: '13800138001' }, null, null);
		expect(new URLSearchParams(http.send.mock.calls[0][1]?.body as string).get('TemplateCode')).toBe('100003');
	});

	test('binds challenges to purpose and account and consumes once across concurrent callers', async () => {
		const { challengeId } = await codes.send('sms', 'phone-new', '13800138000', 'alice');
		await expect(codes.verify(challengeId, '123456', 'signup')).rejects.toThrow('INVALID_CODE');
		await expect(codes.verify(challengeId, '123456', 'phone-new', 'bob')).rejects.toThrow('INVALID_CODE');
		await codes.verify(challengeId, '123456', 'phone-new', 'alice');
		const results = await Promise.allSettled([codes.consume([challengeId]), codes.consume([challengeId])]);
		expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
		await expect(codes.verify(challengeId, '123456', 'phone-new', 'alice')).rejects.toThrow('INVALID_CODE');
	});

	test('rejects expired and replaced challenges', async () => {
		const old = await codes.send('sms', 'signup', '13800138000', null);
		const next = await codes.send('sms', 'signup', '13800138000', null);
		await expect(codes.verify(old.challengeId, '123456', 'signup')).rejects.toThrow('INVALID_CODE');
		await redis.expire(`verification:code:${next.challengeId}`, 0);
		await expect(codes.verify(next.challengeId, '123456', 'signup')).rejects.toThrow('INVALID_CODE');
	});

	test('bounds incorrect guesses even when the provider continues accepting requests', async () => {
		settings.verificationSettings.attempts = 2;
		const { challengeId } = await codes.send('sms', 'password-reset', '13800138000', 'alice');
		http.send.mockResolvedValue(new Response(JSON.stringify({ Code: 'OK', Success: true, Model: { VerifyResult: 'UNKNOWN' } })));
		await expect(codes.verify(challengeId, '000000', 'password-reset')).rejects.toThrow('INVALID_CODE');
		// Response bodies are read once, so return a fresh provider response.
		http.send.mockImplementation(async () => new Response(JSON.stringify({ Code: 'OK', Success: true, Model: { VerifyResult: 'UNKNOWN' } })));
		await expect(codes.verify(challengeId, '000001', 'password-reset')).rejects.toThrow('INVALID_CODE');
		await expect(codes.verify(challengeId, '000002', 'password-reset')).rejects.toThrow('INVALID_CODE');
		expect(http.send).toHaveBeenCalledTimes(3);
	});

	test('redacts provider errors and does not retry a billable send', async () => {
		http.send.mockRejectedValue(new Error('test-secret signed request'));
		await expect(codes.send('sms', 'signup', '13800138000', null)).rejects.toThrow(/^VERIFICATION_UNAVAILABLE$/);
		expect(http.send).toHaveBeenCalledTimes(1);
	});

	test('shares destination cooldown across purposes and workers', async () => {
		const results = await Promise.allSettled(Array.from({ length: 5 }, () => codes.limit('13800138000', '192.0.2.1')));
		expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
	});

	test('returns the remaining cooldown in API errors', async () => {
		const request = { channel: 'sms', purpose: 'signup', address: '13800138000' } as const;
		await send.exec(request, null, null, undefined, '192.0.2.1');
		const error = await send.exec(request, null, null, undefined, '192.0.2.1').catch((err: unknown) => err);
		expect(error).toMatchObject({ code: 'RATE_LIMIT_EXCEEDED', httpStatusCode: 429, info: { retryAfter: 60, resetMs: expect.any(Number) } });
		expect(http.send).toHaveBeenCalledTimes(1);
	});

	test('waits for the last exhausted budget to reset without extending it', async () => {
		settings.verificationSettings.perAddressHourly = 1;
		settings.verificationSettings.ipDaily = 1;
		settings.verificationSettings.accountDaily = 1;
		await codes.limit('13800138000', '192.0.2.1', 'alice');
		const addressHash = createHash('sha256').update('13800138000').digest('hex');
		const ipHash = createHash('sha256').update('192.0.2.1').digest('hex');
		await redis.pexpire(`verification:limit:address:${addressHash}:interval`, 1500);
		await redis.pexpire(`verification:limit:address:${addressHash}:hour`, 12500);
		await redis.pexpire(`verification:limit:ip:${ipHash}:day`, 63000);
		await redis.pexpire('verification:limit:user:alice:day', 125000);
		await expect(codes.limit('13800138000', '192.0.2.1', 'alice')).rejects.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED', retryAfter: 125 });
		expect(await redis.pttl('verification:limit:user:alice:day')).toBeLessThanOrEqual(125000);
		expect(await redis.get('verification:limit:user:alice:day')).toBe('1');
	});

	test('enforces independently configured IP and account budgets', async () => {
		settings.verificationSettings.ipHourly = 1;
		await codes.limit('13800138000', '192.0.2.1');
		await expect(codes.limit('13800138001', '192.0.2.1')).rejects.toThrow('RATE_LIMIT_EXCEEDED');
		settings.verificationSettings.accountHourly = 1;
		await codes.limit('13800138002', '192.0.2.2', 'alice');
		await expect(codes.limit('13800138003', '192.0.2.3', 'alice')).rejects.toThrow('RATE_LIMIT_EXCEEDED');
	});

	test('only sends password reset email to one verified local account', async () => {
		profiles.find.mockResolvedValue([]);
		const result = await send.exec({ channel: 'email', purpose: 'password-reset', username: 'alice', address: 'missing@example.com' }, null, null, undefined, '192.0.2.1');
		expect(result.challengeId).toBeTruthy();
		expect(profiles.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ emailVerified: true }) }));
		expect(email.sendEmail).not.toHaveBeenCalled();
		profiles.find.mockResolvedValue([{ userId: 'alice' }] as MiUserProfile[]);
		users.findOneBy.mockResolvedValue({ id: 'alice', host: null, isSuspended: false } as MiLocalUser);
		await send.exec({ channel: 'email', purpose: 'password-reset', username: 'alice', address: 'alice@example.com' }, null, null, undefined, '192.0.2.1');
		expect(email.sendEmail).toHaveBeenCalledTimes(1);
		const text = email.sendEmail.mock.calls[0][3];
		const code = text.match(/\d{6}/)![0];
		const keys = await redis.keys(`${redis.options.keyPrefix}verification:code:*`);
		const id = keys[0].split(':').at(-1)!;
		await expect(codes.verify(id, code, 'password-reset')).resolves.toMatchObject({ userId: 'alice' });
	});

	test('closed registration rejects a send without an invitation', async () => {
		settings.disableRegistration = true;
		await expect(send.exec({ channel: 'sms', purpose: 'signup', address: '13800138000' }, null, null, undefined, '192.0.2.1')).rejects.toMatchObject({ code: 'REGISTRATION_CLOSED' });
		expect(http.send).not.toHaveBeenCalled();
	});

	test('email recovery works without CAPTCHA, SMS credentials or an available SMS budget', async () => {
		settings.verificationSettings.ipHourly = 1;
		settings.verificationSettings.attempts = 1;
		settings.verificationSettings.validTime = 60;
		await codes.limit('13800138000', '192.0.2.1');
		settings.verificationSettings.accessKeyId = '';
		settings.verificationSettings.accessKeySecret = '';
		captcha.get.mockResolvedValue({ provider: 'turnstile', turnstile: { secretKey: 'secret' } } as unknown as CaptchaSetting);
		captcha.verifyTurnstile.mockRejectedValue(new Error('failed'));
		profiles.find.mockResolvedValue([{ userId: 'alice' }] as MiUserProfile[]);
		users.findOneBy.mockResolvedValue({ id: 'alice', host: null, isSuspended: false } as MiLocalUser);
		const result = await send.exec({ channel: 'email', purpose: 'password-reset', username: 'alice', address: 'alice@example.com' }, null, null, undefined, '192.0.2.1');
		expect(result.retryAfter).toBe(0);
		expect(email.sendEmail).toHaveBeenCalledTimes(1);
		expect(captcha.get).not.toHaveBeenCalled();
		expect(JSON.parse((await redis.get(`verification:code:${result.challengeId}`))!).maxAttempts).toBe(5);
		expect(await redis.ttl(`verification:code:${result.challengeId}`)).toBeGreaterThan(290);
	});

	test('concurrent email changes cannot attach an older verification link to the newer address', async () => {
		const stored = { userId: 'alice', password: bcrypt.hashSync('password', 4), email: null, emailVerifyCode: null } as MiUserProfile;
		profiles.findOneByOrFail.mockResolvedValue(stored);
		profiles.update.mockImplementation(async (_id, patch) => {
			Object.assign(stored, patch);
			return { affected: 1, raw: [], generatedMaps: [] };
		});
		email.validateEmailForAccount.mockResolvedValue({ available: true, reason: null });
		const packed = Promise.withResolvers<void>();
		const resume = Promise.withResolvers<void>();
		const entity = mock<UserEntityService>();
		entity.pack.mockImplementationOnce(async () => {
			packed.resolve();
			await resume.promise;
			return {} as never;
		}).mockResolvedValue({} as never);
		const update = new UpdateEmail(loadConfig(), settings, profiles, entity, email, mock<UserAuthService>(), mock<GlobalEventService>());
		const alice = { id: 'alice' } as MiLocalUser;
		const first = update.exec({ password: 'password', email: 'FIRST@example.com' }, alice, null, undefined, '192.0.2.1');
		await packed.promise;
		await update.exec({ password: 'password', email: 'second@example.com' }, alice, null, undefined, '192.0.2.1');
		resume.resolve();
		await first;
		const firstMail = email.sendEmail.mock.calls.find(([address]) => address === 'first@example.com')!;
		const secondMail = email.sendEmail.mock.calls.find(([address]) => address === 'second@example.com')!;
		expect(stored.email).toBe('second@example.com');
		expect(stored.emailVerified).toBe(false);
		expect(secondMail[3]).toContain(`/verify-email/${stored.emailVerifyCode}`);
		expect(firstMail[3]).not.toContain(`/verify-email/${stored.emailVerifyCode}`);
	});

	test('email binding sends the existing verification link without CAPTCHA', async () => {
		profiles.findOneByOrFail.mockResolvedValue({ password: bcrypt.hashSync('password', 4) } as MiUserProfile);
		email.validateEmailForAccount.mockResolvedValue({ available: true, reason: null });
		captcha.get.mockResolvedValue({ provider: 'turnstile', turnstile: { secretKey: 'secret' } } as unknown as CaptchaSetting);
		captcha.verifyTurnstile.mockRejectedValue(new Error('failed'));
		const update = new UpdateEmail(loadConfig(), settings, profiles, mock<UserEntityService>(), email, mock<UserAuthService>(), mock<GlobalEventService>());
		await update.exec({ password: 'password', email: 'alice@example.com' }, { id: 'alice' } as MiLocalUser, null);
		expect(profiles.update).toHaveBeenCalled();
		expect(email.sendEmail).toHaveBeenCalledWith('alice@example.com', '旅人营地邮箱验证', expect.stringContaining('/verify-email/'), expect.stringContaining('/verify-email/'));
		expect(captcha.get).not.toHaveBeenCalled();
	});

	test('reports a failed email delivery instead of accepting the binding request', async () => {
		profiles.findOneByOrFail.mockResolvedValue({ password: bcrypt.hashSync('password', 4) } as MiUserProfile);
		email.validateEmailForAccount.mockResolvedValue({ available: true, reason: null });
		email.sendEmail.mockRejectedValue(new Error('SMTP unavailable'));
		const update = new UpdateEmail(loadConfig(), settings, profiles, mock<UserEntityService>(), email, mock<UserAuthService>(), mock<GlobalEventService>());
		await expect(update.exec({ password: 'password', email: 'alice@example.com' }, { id: 'alice' } as MiLocalUser, null)).rejects.toMatchObject({ code: 'VERIFICATION_UNAVAILABLE', httpStatusCode: 503 });
	});

	test.each([
		[null, false, true, false],
		['alice@example.com', false, true, false],
		['alice@example.com', true, true, true],
		['alice@example.com', true, false, false],
	] as const)('selects recovery preference from the verified email and mail service', async (address, verified, enabled, preferred) => {
		settings.enableEmail = enabled;
		users.findOneBy.mockResolvedValue({ id: 'alice' } as MiLocalUser);
		profiles.findOneBy.mockResolvedValue({ userId: 'alice', email: address, emailVerified: verified } as MiUserProfile);
		const begin = new BeginPasswordReset(users, profiles, meta);
		await expect(begin.exec({ username: 'Alice' }, null, null)).resolves.toEqual({ preferEmail: preferred });
		expect(users.findOneBy).toHaveBeenCalledWith(expect.objectContaining({ usernameLower: 'alice', isSuspended: false }));
		expect(http.send).not.toHaveBeenCalled();
	});

	test('SMS recovery needs no server waiting session even for a verified-email account', async () => {
		profiles.find.mockResolvedValue([{ userId: 'alice', email: 'alice@example.com', emailVerified: true }] as MiUserProfile[]);
		users.findOneBy.mockResolvedValue({ id: 'alice', host: null, isSuspended: false } as MiLocalUser);
		await expect(send.exec({ channel: 'sms', purpose: 'password-reset', address: '13800138000' }, null, null)).resolves.toHaveProperty('challengeId');
		expect(http.send).toHaveBeenCalledTimes(1);
	});

	test('atomically caps all SMS purposes, accounts and source IPs together', async () => {
		settings.verificationSettings.globalDaily = 3;
		const results = await Promise.allSettled(Array.from({ length: 12 }, async (_, index) => {
			const phone = `138001380${index.toString().padStart(2, '0')}`;
			await codes.limit(phone, `192.0.2.${index + 1}`, `user-${index}`);
			return codes.send('sms', index % 2 ? 'signup' : 'phone-new', phone, `user-${index}`);
		}));
		expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(3);
		for (const result of results) if (result.status === 'rejected') expect(result.reason).toMatchObject({ code: 'SMS_DAILY_LIMIT_EXCEEDED', retryAfter: expect.any(Number) });
		expect(http.send).toHaveBeenCalledTimes(3);
	});

	test('resets the site budget at Beijing midnight and counts failed provider sends', async () => {
		settings.verificationSettings.globalDaily = 1;
		const now = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-10T15:59:50Z'));
		http.send.mockRejectedValueOnce(new Error('transport failed'));
		await expect(codes.send('sms', 'signup', '13800138000', null)).rejects.toThrow('VERIFICATION_UNAVAILABLE');
		await expect(codes.send('sms', 'phone-new', '13800138001', 'alice')).rejects.toMatchObject({ code: 'SMS_DAILY_LIMIT_EXCEEDED', retryAfter: 10 });
		expect(http.send).toHaveBeenCalledTimes(1);
		now.mockReturnValue(Date.parse('2026-11-10T16:00:01Z'));
		await expect(codes.send('sms', 'signup', '13800138002', null)).resolves.toHaveProperty('challengeId');
		expect(http.send).toHaveBeenCalledTimes(2);
	});

	test('uses a Chinese recovery email and refuses a mismatched username', async () => {
		profiles.find.mockResolvedValue([{ userId: 'alice' }] as MiUserProfile[]);
		users.findOneBy.mockResolvedValue(null);
		await send.exec({ channel: 'email', purpose: 'password-reset', username: 'other', address: 'alice@example.com' }, null, null);
		expect(users.findOneBy).toHaveBeenCalledWith(expect.objectContaining({ usernameLower: 'other' }));
		expect(email.sendEmail).not.toHaveBeenCalled();
		users.findOneBy.mockResolvedValue({ id: 'alice' } as MiLocalUser);
		await send.exec({ channel: 'email', purpose: 'password-reset', username: 'alice', address: 'alice@example.com' }, null, null);
		expect(email.sendEmail.mock.calls[0][1]).toBe('旅人营地重置密码验证码');
		expect(email.sendEmail.mock.calls[0][3]).toContain('5 分钟内有效');
		expect(http.send).not.toHaveBeenCalled();
	});
});
