/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createHash, createHmac, randomInt, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { MetaService } from '@/core/MetaService.js';
import { CaptchaService } from '@/core/CaptchaService.js';
import { EmailService } from '@/core/EmailService.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import Logger from '@/logger.js';

const logger = new Logger('verification-code');

export const verificationDefaults = {
	accessKeyId: '', accessKeySecret: '', signName: '', templateCode: '100001', schemeName: 'camp',
	changePhoneTemplateCode: '100002', resetPasswordTemplateCode: '100003', bindPhoneTemplateCode: '100004', verifyPhoneTemplateCode: '100005',
	interval: 60, validTime: 300, perAddressHourly: 5, perAddressDaily: 10,
	ipHourly: 20, ipDaily: 100, accountHourly: 10, accountDaily: 20, globalDaily: 100, attempts: 5,
};
export type VerificationSettings = typeof verificationDefaults;
export type CodePurpose = 'signup' | 'phone-old' | 'phone-new' | 'password-reset';
export type CodeChannel = 'sms' | 'email';
export type CaptchaTokens = Partial<Record<'hcaptcha-response' | 'm-captcha-response' | 'g-recaptcha-response' | 'turnstile-response' | 'testcaptcha-response', string | null>>;
export type CodeChallenge = {
	channel: CodeChannel;
	purpose: CodePurpose;
	address: string;
	userId: string | null;
	schemeName: string;
	attempts: number;
	maxAttempts: number;
	emailHash?: string;
	verifiedHash?: string;
};

export class VerificationError extends Error {
	constructor(public readonly code: 'INVALID_CODE' | 'CAPTCHA_FAILED' | 'RATE_LIMIT_EXCEEDED' | 'SMS_DAILY_LIMIT_EXCEEDED' | 'VERIFICATION_UNAVAILABLE' | 'INVALID_PHONE' | 'INVALID_EMAIL' | 'PHONE_UNAVAILABLE' | 'AUTHENTICATION_FAILED' | 'REGISTRATION_CLOSED', public readonly retryAfter?: number) {
		super(code);
	}
}

const digest = (value: string): string => createHash('sha256').update(value).digest('hex');
const encode = (value: string): string => encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** Alibaba Cloud RPC v1 signing. All parameters, including the signature, are sent in the POST body. */
export function signAliyunRpc(parameters: Record<string, string>, secret: string): string {
	const canonical = Object.keys(parameters).sort().map(key => `${encode(key)}=${encode(parameters[key])}`).join('&');
	const signature = createHmac('sha1', `${secret}&`).update(`POST&%2F&${encode(canonical)}`).digest('base64');
	return `${canonical}&Signature=${encode(signature)}`;
}

export function normalizePhone(value: string): string {
	const phone = value.trim().replace(/^\+86/, '');
	if (!/^1[3-9]\d{9}$/.test(phone)) throw new VerificationError('INVALID_PHONE');
	return phone;
}

export function normalizeEmail(value: string): string {
	const email = value.trim().toLowerCase();
	if (email.length > 128 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new VerificationError('INVALID_EMAIL');
	return email;
}

@Injectable()
export class VerificationCodeService {
	constructor(
		@Inject(DI.redis) private redis: Redis.Redis,
		private metaService: MetaService,
		private captchaService: CaptchaService,
		private emailService: EmailService,
		private httpRequestService: HttpRequestService,
	) {}

	@bindThis
	public async settings(): Promise<VerificationSettings> {
		const saved = (await this.metaService.fetch()).verificationSettings;
		return Object.fromEntries(Object.entries(verificationDefaults).map(([key, fallback]) => {
			const value = saved?.[key as keyof VerificationSettings] ?? fallback;
			return [key, typeof value === 'string' ? value.trim() : value];
		})) as VerificationSettings;
	}

	@bindThis
	private async reserveDailySms(limit: number): Promise<void> {
		const now = Date.now();
		const beijingTime = now + 8 * 3600000;
		const nextDay = (Math.floor(beijingTime / 86400000) + 1) * 86400000 - 8 * 3600000;
		const seconds = Math.max(1, Math.ceil((nextDay - now) / 1000));
		const key = `verification:sms:daily:${new Date(beijingTime).toISOString().slice(0, 10)}`;
		// Count attempts before contacting the provider, including failures with uncertain delivery.
		const wait = await this.redis.eval(`
			if tonumber(redis.call('GET', KEYS[1]) or '0') >= tonumber(ARGV[1]) then
				return math.max(redis.call('TTL', KEYS[1]), 1)
			end
			if redis.call('INCR', KEYS[1]) == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
			return 0`, 1, key, limit, seconds) as number;
		if (wait > 0) throw new VerificationError('SMS_DAILY_LIMIT_EXCEEDED', wait);
	}

	@bindThis
	public async verifyCaptcha(tokens: CaptchaTokens): Promise<void> {
		const settings = await this.captchaService.get();
		try {
			switch (settings.provider) {
				case 'none': return;
				case 'testcaptcha': return await this.captchaService.verifyTestcaptcha(tokens['testcaptcha-response']);
				case 'hcaptcha':
					if (!settings.hcaptcha.secretKey) throw new Error();
					return await this.captchaService.verifyHcaptcha(settings.hcaptcha.secretKey, tokens['hcaptcha-response']);
				case 'recaptcha':
					if (!settings.recaptcha.secretKey) throw new Error();
					return await this.captchaService.verifyRecaptcha(settings.recaptcha.secretKey, tokens['g-recaptcha-response']);
				case 'turnstile':
					if (!settings.turnstile.secretKey) throw new Error();
					return await this.captchaService.verifyTurnstile(settings.turnstile.secretKey, tokens['turnstile-response']);
				case 'mcaptcha':
					if (!settings.mcaptcha.secretKey || !settings.mcaptcha.siteKey || !settings.mcaptcha.instanceUrl) throw new Error();
					return await this.captchaService.verifyMcaptcha(settings.mcaptcha.secretKey, settings.mcaptcha.siteKey, settings.mcaptcha.instanceUrl, tokens['m-captcha-response']);
			}
		} catch {
			throw new VerificationError('CAPTCHA_FAILED');
		}
	}

	@bindThis
	public async limit(address: string, ip: string, userId?: string): Promise<void> {
		const s = await this.settings();
		const buckets: [string, number, number][] = [
			[`address:${digest(address)}:interval`, s.interval, 1],
			[`address:${digest(address)}:hour`, 3600, s.perAddressHourly],
			[`address:${digest(address)}:day`, 86400, s.perAddressDaily],
			[`ip:${digest(ip)}:hour`, 3600, s.ipHourly],
			[`ip:${digest(ip)}:day`, 86400, s.ipDaily],
		];
		if (userId) buckets.push([`user:${userId}:hour`, 3600, s.accountHourly], [`user:${userId}:day`, 86400, s.accountDaily]);
		// Reserve all budgets atomically, across workers and purposes. Failed deliveries still cost a reservation.
		const retryAfterMs = await this.redis.eval(`
			local wait = 0
			for i, key in ipairs(KEYS) do
				if tonumber(redis.call('GET', key) or '0') >= tonumber(ARGV[i * 2]) then
					wait = math.max(wait, redis.call('PTTL', key), 1)
				end
			end
			if wait > 0 then return wait end
			for i, key in ipairs(KEYS) do
				if redis.call('INCR', key) == 1 then redis.call('EXPIRE', key, ARGV[i * 2 - 1]) end
			end
			return 0`, buckets.length, ...buckets.map(b => `verification:limit:${b[0]}`), ...buckets.flatMap(b => [b[1], b[2]])) as number;
		if (retryAfterMs > 0) throw new VerificationError('RATE_LIMIT_EXCEEDED', Math.ceil(retryAfterMs / 1000));
	}

	@bindThis
	private async rpc(action: string, parameters: Record<string, string>): Promise<{ Model?: { VerifyResult?: string; OutId?: string } }> {
		const settings = await this.settings();
		if (!settings.accessKeyId || !settings.accessKeySecret) {
			throw new VerificationError('VERIFICATION_UNAVAILABLE');
		}
		try {
			const body = signAliyunRpc({
				Action: action, Version: '2017-05-25', Format: 'JSON', AccessKeyId: settings.accessKeyId,
				SignatureMethod: 'HMAC-SHA1', SignatureVersion: '1.0', SignatureNonce: randomUUID(),
				Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), ...parameters,
			}, settings.accessKeySecret);
			const response = await this.httpRequestService.send('https://dypnsapi.aliyuncs.com/', {
				method: 'POST', body, timeout: 10000, size: 64 * 1024,
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			}, { throwErrorWhenResponseNotOk: false });
			const result = await response.json() as { Code?: string; RequestId?: string; Success?: boolean; Model?: { VerifyResult?: string; OutId?: string } };
			if (!response.ok || result.Code !== 'OK' || result.Success !== true) {
				logger.warn('Aliyun verification request failed', {
					action, status: response.status,
					code: typeof result.Code === 'string' && /^[a-zA-Z0-9_.-]{1,128}$/.test(result.Code) ? result.Code : 'UNKNOWN',
					requestId: typeof result.RequestId === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(result.RequestId) ? result.RequestId : undefined,
				});
			}
			if (['BUSINESS_LIMIT_CONTROL', 'FREQUENCY_FAIL'].includes(result.Code ?? '')) throw new VerificationError('RATE_LIMIT_EXCEEDED');
			if (!response.ok || result.Code !== 'OK' || result.Success !== true) throw new VerificationError('VERIFICATION_UNAVAILABLE');
			return result;
		} catch (err) {
			if (err instanceof VerificationError) throw err;
			// Request bodies and provider messages may contain credentials; log only safe diagnostics.
			logger.warn('Aliyun verification transport or response parsing failed');
			throw new VerificationError('VERIFICATION_UNAVAILABLE');
		}
	}

	@bindThis
	private currentKey(challenge: Pick<CodeChallenge, 'channel' | 'purpose' | 'address'>): string {
		return `verification:current:${challenge.channel}:${challenge.purpose}:${digest(challenge.address)}`;
	}

	@bindThis
	public async send(channel: CodeChannel, purpose: CodePurpose, address: string, userId: string | null, replacingPhone = false): Promise<{ challengeId: string; retryAfter: number }> {
		const s = channel === 'sms' ? await this.settings() : verificationDefaults;
		const challengeId = randomUUID();
		const code = randomInt(0, 1000000).toString().padStart(6, '0');
		const suffix = { signup: 'su', 'phone-old': 'old', 'phone-new': 'new', 'password-reset': 'pw' }[purpose];
		const challenge: CodeChallenge = { channel, purpose, address, userId, schemeName: `${s.schemeName}-${suffix}`, attempts: 0, maxAttempts: s.attempts };
		if (channel === 'sms') {
			const templateCode = {
				signup: s.templateCode,
				'phone-old': s.verifyPhoneTemplateCode,
				'phone-new': replacingPhone ? s.changePhoneTemplateCode : s.bindPhoneTemplateCode,
				'password-reset': s.resetPasswordTemplateCode,
			}[purpose];
			if (!s.accessKeyId || !s.accessKeySecret || !s.signName || !templateCode) throw new VerificationError('VERIFICATION_UNAVAILABLE');
			await this.reserveDailySms(s.globalDaily);
			await this.rpc('SendSmsVerifyCode', {
				CountryCode: '86', PhoneNumber: address, SchemeName: challenge.schemeName, OutId: challengeId,
				SignName: s.signName, TemplateCode: templateCode,
				TemplateParam: JSON.stringify({ code: '##code##', min: String(s.validTime / 60) }),
				CodeLength: '6', CodeType: '1', ValidTime: String(s.validTime), Interval: String(s.interval),
				DuplicatePolicy: '1', ReturnVerifyCode: 'false', AutoRetry: '0',
			});
		} else {
			if (purpose !== 'password-reset') throw new VerificationError('INVALID_EMAIL');
			if (!(await this.metaService.fetch()).enableEmail) throw new VerificationError('VERIFICATION_UNAVAILABLE');
			challenge.emailHash = digest(`${challengeId}:${code}`);
			try {
				await this.emailService.sendEmail(address, '旅人营地重置密码验证码',
					`<p>重置密码验证码： <b>${code}</b>，${s.validTime / 60} 分钟内有效。</p><p>请勿泄露。非本人操作请忽略。</p>`,
					`重置密码验证码： ${code}，${s.validTime / 60} 分钟内有效。请勿泄露。非本人操作请忽略。`);
			} catch {
				throw new VerificationError('VERIFICATION_UNAVAILABLE');
			}
		}
		await this.redis.multi()
			.set(`verification:code:${challengeId}`, JSON.stringify(challenge), 'EX', s.validTime)
			.set(this.currentKey(challenge), challengeId, 'EX', s.validTime)
			.exec();
		return { challengeId, retryAfter: channel === 'sms' ? s.interval : 0 };
	}

	@bindThis
	public async verify(challengeId: string, code: string, purpose: CodePurpose, userId?: string): Promise<CodeChallenge> {
		if (!/^[\da-f-]{36}$/.test(challengeId) || !/^\d{6}$/.test(code)) throw new VerificationError('INVALID_CODE');
		const key = `verification:code:${challengeId}`;
		const lock = `${key}:lock`;
		if (!await this.redis.set(lock, '1', 'EX', 30, 'NX')) throw new VerificationError('INVALID_CODE');
		try {
			const data = await this.redis.get(key);
			if (!data) throw new VerificationError('INVALID_CODE');
			const challenge = JSON.parse(data) as CodeChallenge;
			if (challenge.purpose !== purpose || (userId !== undefined && challenge.userId !== userId)
				|| await this.redis.get(this.currentKey(challenge)) !== challengeId) throw new VerificationError('INVALID_CODE');
			const hash = digest(`${challengeId}:${code}`);
			if (challenge.verifiedHash === hash) return challenge;
			if (challenge.attempts >= challenge.maxAttempts) throw new VerificationError('INVALID_CODE');
			challenge.attempts++;
			await this.redis.set(key, JSON.stringify(challenge), 'KEEPTTL', 'XX');
			if (challenge.channel === 'sms') {
				const result = await this.rpc('CheckSmsVerifyCode', {
					CountryCode: '86', PhoneNumber: challenge.address, SchemeName: challenge.schemeName,
					OutId: challengeId, VerifyCode: code, CaseAuthPolicy: '2',
				});
				if (result.Model?.VerifyResult !== 'PASS' || (result.Model.OutId && result.Model.OutId !== challengeId)) throw new VerificationError('INVALID_CODE');
			} else if (challenge.emailHash !== hash) {
				throw new VerificationError('INVALID_CODE');
			}
			challenge.verifiedHash = hash;
			if (!await this.redis.set(key, JSON.stringify(challenge), 'KEEPTTL', 'XX')) throw new VerificationError('INVALID_CODE');
			return challenge;
		} finally {
			await this.redis.del(lock);
		}
	}

	@bindThis
	public async consume(ids: string[]): Promise<void> {
		const consumed = await this.redis.eval(`
			for _, key in ipairs(KEYS) do
				local value = redis.call('GET', key)
				if not value or not cjson.decode(value).verifiedHash then return 0 end
			end
			for _, key in ipairs(KEYS) do redis.call('DEL', key) end
			return 1`, ids.length, ...ids.map(id => `verification:code:${id}`));
		if (consumed !== 1) throw new VerificationError('INVALID_CODE');
	}
}
