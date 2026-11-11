/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createHash, randomInt, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import type { Locator, Page } from 'playwright';

export const ADMIN_SETUP_PASSWORD = 'example_password_please_change_this_or_you_will_get_hacked';
export const DEFAULT_INVITATION_CODE = 'test-invitation-code';

async function signupProof(invitationCode: string = randomUUID()) {
	const { loadConfig } = await import(new URL('../../../backend/built/config.js', import.meta.url).href);
	const config = loadConfig();
	if (config.db.db !== 'test-misskey') throw new Error('Phone fixtures require the isolated test database');
	const requireBackend = createRequire(new URL('../../../backend/package.json', import.meta.url));
	const { Client } = requireBackend('pg');
	const db = new Client({ ...config.db, database: config.db.db, password: config.db.pass });
	await db.connect();
	try {
		await db.query('INSERT INTO registration_ticket (id, code) VALUES ($1, $2)', [randomUUID().replaceAll('-', ''), invitationCode]);
	} finally {
		await db.end();
	}
	const { Redis } = requireBackend('ioredis');
	const redis = new Redis(config.redis);
	const phone = `139${randomInt(0, 100000000).toString().padStart(8, '0')}`;
	const challengeId = randomUUID();
	const code = '123456';
	const verifiedHash = createHash('sha256').update(`${challengeId}:${code}`).digest('hex');
	const addressHash = createHash('sha256').update(phone).digest('hex');
	try {
		await redis.multi()
			.set(`verification:code:${challengeId}`, JSON.stringify({ purpose: 'signup', address: phone, channel: 'sms', userId: null, schemeName: 'test', attempts: 0, maxAttempts: 5, verifiedHash }), 'EX', 300)
			.set(`verification:current:sms:signup:${addressHash}`, challengeId, 'EX', 300)
			.exec();
	} finally {
		await redis.quit();
	}
	return { phone, challengeId, code, invitationCode };
}

export async function fillSignupPhone(page: Page): Promise<void> {
	const proof = await signupProof(await locateMkInput(page, 'signup-invitation-code').inputValue());
	await page.route('**/api/auth/send-code', async route => {
		await route.fulfill({ json: { challengeId: proof.challengeId, retryAfter: 60 } });
	});
	await locateMkInput(page, 'signup-phone').fill(proof.phone);
	const sent = page.waitForResponse(response => response.url().endsWith('/api/auth/send-code'));
	await page.getByRole('button', { name: '获取验证码', exact: true }).click();
	await sent;
	await page.getByRole('status').waitFor({ state: 'visible' });
	await page.locator('input[autocomplete="one-time-code"]').fill(proof.code);
}

export interface RegisteredUser {
	id: string;
	token: string;
}

export function assertOk(status: number, route: string): void {
	if (status < 200 || status >= 300) {
		throw new Error(`${route} failed: status=${status}`);
	}
}

export async function api(baseUrl: string, endpoint: string, body: Record<string, unknown>) {
	const response = await fetch(`${baseUrl}/api/${endpoint}`, {
		method: 'POST',
		body: JSON.stringify(body),
		headers: {
			'Content-Type': 'application/json',
		},
	});
	assertOk(response.status, `/api/${endpoint}`);
	if (response.status === 204) return null;
	return await response.json();
}

export async function resetState(baseUrl: string): Promise<void> {
	await api(baseUrl, 'reset-db', {});
}

export async function registerUser(
	baseUrl: string,
	username: string,
	password: string,
	isAdmin = false,
): Promise<RegisteredUser> {
	const route = isAdmin ? 'admin/accounts/create' : 'signup';
	const proof = isAdmin ? null : await signupProof();
	const result = await api(baseUrl, route, {
		username,
		password,
		...(isAdmin ? { setupPassword: ADMIN_SETUP_PASSWORD } : {}),
		...(proof ? { invitationCode: proof.invitationCode, phoneChallengeId: proof.challengeId, phoneCode: proof.code } : {}),
	});
	if (isAdmin) {
		await api(baseUrl, 'admin/update-verification-settings', {
			i: result.token,
			enablePhoneVerification: true,
			accessKeyId: 'test-pnvs-id',
			accessKeySecret: 'test-pnvs-secret',
			signName: 'test',
		});
	}
	return result as RegisteredUser;
}

export function locateMkInput(page: Page, testId: string): Locator {
	return page.locator(`[data-testid="${testId}"] input`);
}

export function locateMkTextarea(page: Page, testId: string): Locator {
	return page.locator(`[data-testid="${testId}"] textarea`);
}

export function locateMkSwitch(page: Page, testId: string): Locator {
	return page.locator(`[data-testid="${testId}"] [data-testid="switch-toggle"]`);
}

export async function visitHome(page: Page, baseUrl: string): Promise<void> {
	await page.goto(`${baseUrl}/`);
	await page.locator('button').first().waitFor({ state: 'visible', timeout: 30_000 });
}

export async function waitApiResponse(page: Page, path: string, timeout = 30_000): Promise<void> {
	await page.waitForResponse((response) => {
		return response.url().endsWith(path) && response.request().method() === 'POST';
	}, { timeout });
}

export async function signIn(page: Page, baseUrl: string, username: string, password: string): Promise<void> {
	await visitHome(page, baseUrl);
	await page.getByTestId('signin').click();
	await page.getByTestId('signin-page-input').waitFor({ state: 'visible', timeout: 10_000 });
	await locateMkInput(page, 'signin-username').fill(username);
	await page.keyboard.press('Enter');
	await page.getByTestId('signin-page-password').waitFor({ state: 'visible', timeout: 10_000 });
	await locateMkInput(page, 'signin-password').fill(password);
	const signinResponse = waitApiResponse(page, '/api/signin-flow');
	await page.keyboard.press('Enter');
	await signinResponse;
}

export async function acceptSignupRules(page: Page): Promise<void> {
	await page.getByTestId('signup-rules-continue').waitFor({ state: 'visible' });
	await locateMkSwitch(page, 'signup-rules-notes-agree').click();
	await page.getByTestId('modal-dialog-ok').click();
	await page.getByTestId('signup-rules-continue').click();
}

export async function signupThroughUi(
	page: Page,
	options: {
		username: string;
		password: string;
		invitationCode?: string;
	},
): Promise<void> {
	await page.getByTestId('signup').click();
	await acceptSignupRules(page);

	await locateMkInput(page, 'signup-username').fill(options.username);
	await locateMkInput(page, 'signup-password').fill(options.password);
	await locateMkInput(page, 'signup-password-retype').fill(options.password);
	await locateMkInput(page, 'signup-invitation-code').fill(options.invitationCode ?? DEFAULT_INVITATION_CODE);
	// Diagnostics also run this scenario against the base revision's registration form.
	if (await page.getByTestId('signup-phone').count() > 0) await fillSignupPhone(page);

	const signupResponse = waitApiResponse(page, '/api/signup');
	await page.getByTestId('signup-submit').click();
	await signupResponse;
}

// 表示に時間がかかるのでPlaywrightのデフォルトのタイムアウトだと間に合わない
export async function closeUserSetupDialog(page: Page, timeout = 30_000): Promise<void> {
	await page.locator('[data-testid="user-setup-dialog"] [data-testid="modal-window-close"]').click({ timeout });
	await page.getByTestId('modal-dialog-ok').click();
}

export async function closeUserSetupDialogIfVisible(page: Page): Promise<void> {
	if (await page.getByTestId('user-setup-dialog').isVisible()) {
		await closeUserSetupDialog(page);
	}
}

export async function postNote(page: Page, noteText: string, timeout = 15_000): Promise<void> {
	await page.getByTestId('open-post-form').waitFor({ state: 'visible' });
	await page.getByTestId('open-post-form').click();
	await page.getByTestId('post-form-text').fill(noteText);
	await page.getByTestId('post-form-submit').click();
	await page.getByText(noteText).waitFor({ timeout });
}
