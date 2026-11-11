/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import type { App } from 'vue';
import MkCaptchaGate from '@/components/MkCaptchaGate.vue';
import MkVerificationCode from '@/components/MkVerificationCode.vue';
import EmailSettings from '@/pages/settings/email.vue';
import MkForgotPassword from '@/components/MkForgotPassword.vue';
import MkSignupForm from '@/components/MkSignupDialog.form.vue';
import EmailVerificationBanner from '@/ui/_common_/email-verification-banner.vue';
import { formatVerificationWait, verificationErrorMessage, verificationRetryAfter } from '@/utility/verification-error.js';

const state = vi.hoisted(() => ({
	instance: { enableMcaptcha: true, mcaptchaSiteKey: 'site', mcaptchaInstanceUrl: 'https://captcha.example', enableEmail: true, phoneVerificationAvailable: true, enablePhoneVerification: true, allowEmailSignup: false, restrictSignupEmailDomains: false, requireNumericQqEmail: false },
	user: { phoneNumber: '138****8000', email: 'alice@example.com', emailVerified: false, receiveAnnouncementEmail: false, emailNotificationTypes: [] },
	fetchInstance: vi.fn(), send: vi.fn(), alert: vi.fn(), authenticate: vi.fn(), updateEmail: vi.fn(), close: vi.fn(), mounts: 0,
}));
vi.mock('@/instance.js', async () => {
	const { reactive } = await import('vue');
	state.instance = reactive(state.instance);
	return { instance: state.instance, fetchInstance: state.fetchInstance };
});
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: state.send }));
vi.mock('@/os.js', () => ({ alert: state.alert, authenticateDialog: state.authenticate, apiWithDialog: state.updateEmail }));
vi.mock('@/i.js', async () => {
	const { reactive } = await import('vue');
	state.user = reactive(state.user);
	return { $i: state.user, ensureSignin: () => state.user };
});
vi.mock('@/accounts.js', () => ({ login: vi.fn() }));
vi.mock('@/page.js', () => ({ definePage: vi.fn() }));
vi.mock('@/i18n.js', () => ({ i18n: {
	ts: { _registration: { bindEmailBanner: '请绑定并验证邮箱', bindEmail: '绑定邮箱', emailDomainNotAllowed: '请使用 QQ 或 Gmail', qqEmailMustBeNumeric: '请使用数字 QQ 邮箱', phoneSignup: '手机注册', emailSignup: '邮箱注册', signupMethod: '注册方式' }, _phoneAuth: { sendCode: '获取验证码', resend: '重新获取', code: '验证码', sent: '请查收验证码', invalidCode: '验证码错误', tooFrequent: '操作频繁，请稍后重试', useSmsRecovery: '通过手机找回', emailReset: '通过邮箱找回' }, _notification: { _types: {} }, _forgotPassword: {} },
	tsx: { _phoneAuth: {
		resendAfter: ({ time }: { time: string }) => `${time}后重试`,
		tooFrequentWithWait: ({ time }: { time: string }) => `操作频繁，请在${time}后重试`,
		smsDailyLimit: ({ time }: { time: string }) => `今日短信发送次数已达上限，请在${time}后重试`,
		waitSeconds: ({ seconds }: { seconds: number }) => `${seconds}秒`,
		waitMinutes: ({ minutes, seconds }: { minutes: number; seconds: number }) => `${minutes}分${seconds}秒`,
		waitHours: ({ hours, minutes }: { hours: number; minutes: number }) => `${hours}小时${minutes}分`,
	} },
} }));
vi.mock('@/components/MkCaptcha.vue', async () => {
	const { defineComponent, h, onMounted } = await import('vue');
	return { default: defineComponent({
		emits: ['update:modelValue'],
		setup(_props, { emit }) {
			onMounted(() => { state.mounts++; });
			return () => h('button', { type: 'button', 'data-captcha': '', onClick: () => emit('update:modelValue', 'captcha-token') }, 'Captcha');
		},
	}) };
});
vi.mock('@/components/MkButton.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({
		props: ['disabled'], emits: ['click'],
		setup(props, { emit, slots }) { return () => h('button', { type: 'button', disabled: props.disabled, 'data-send': '', onClick: () => emit('click') }, slots.default?.()); },
	}) };
});
vi.mock('@/components/MkInput.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({
		props: ['modelValue', 'type'], emits: ['update:modelValue'],
		setup(props, { emit }) { return () => h('input', { type: props.type ?? 'text', value: props.modelValue, onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value) }); },
	}) };
});
vi.mock('@/components/MkSelect.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({
		props: ['modelValue', 'items'], emits: ['update:modelValue'],
		setup(props, { emit }) { return () => h('select', { value: props.modelValue, onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLSelectElement).value) }, props.items.map((item: { value: string }) => h('option', { value: item.value }, item.value))); },
	}) };
});
vi.mock('@/components/MkModalWindow.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({ setup(_props, { slots, expose }) { expose({ close: state.close }); return () => h('div', slots.default?.()); } }) };
});
vi.mock('@/components/form/section.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({ setup(_props, { slots }) { return () => h('section', slots.default?.()); } }) };
});
vi.mock('@/components/MkDisableSection.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({ setup(_props, { slots }) { return () => h('div', slots.default?.()); } }) };
});
vi.mock('@/components/MkInfo.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkSwitch.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkRadios.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({
		props: ['modelValue', 'options'], emits: ['update:modelValue'],
		setup(props, { emit, slots }) { return () => h('label', [slots.label?.(), h('select', { 'data-method': '', value: props.modelValue, onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLSelectElement).value) }, props.options.map((item: { value: string; label: string }) => h('option', { value: item.value }, item.label)))]); },
	}) };
});

describe('Verification forms', () => {
	let app: App;
	let host: HTMLDivElement;
	beforeEach(() => {
		vi.useFakeTimers();
		state.send.mockReset();
		state.fetchInstance.mockReset().mockResolvedValue(state.instance);
		Object.assign(state.instance, { enablePhoneVerification: true, phoneVerificationAvailable: true, allowEmailSignup: false, restrictSignupEmailDomains: false, requireNumericQqEmail: false });
		state.user.emailVerified = false;
		state.alert.mockReset();
		state.authenticate.mockReset();
		state.updateEmail.mockReset();
		state.close.mockReset();
		state.mounts = 0;
		state.instance.enableMcaptcha = true;
		state.instance.enableEmail = true;
		host = document.createElement('div');
		document.body.append(host);
	});
	afterEach(() => { app.unmount(); host.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });

	test('leaves no empty CAPTCHA container when verification is disabled', () => {
		state.instance.enableMcaptcha = false;
		app = createApp(MkCaptchaGate);
		app.mount(host);
		expect(host.childElementCount).toBe(0);
	});

	test('remounts mCaptcha after use so a new challenge can be solved', async () => {
		const gate = ref<InstanceType<typeof MkCaptchaGate>>();
		app = createApp(defineComponent({ setup: () => () => h(MkCaptchaGate, { ref: gate }) }));
		app.mount(host);
		expect(gate.value?.ready).toBeFalsy();
		host.querySelector<HTMLButtonElement>('[data-captcha]')!.click();
		await nextTick();
		expect(gate.value?.tokens['m-captcha-response']).toBe('captcha-token');
		expect(gate.value?.ready).toBeTruthy();
		gate.value?.reset();
		await nextTick();
		expect(state.mounts).toBe(2);
		expect(gate.value?.ready).toBeFalsy();
		host.querySelector<HTMLButtonElement>('[data-captcha]')!.click();
		await nextTick();
		expect(gate.value?.ready).toBeTruthy();
	});

	test('requires CAPTCHA for every send and enforces the returned cooldown', async () => {
		const proof = ref({ challengeId: '', code: '' });
		state.send.mockResolvedValue({ challengeId: 'challenge-1', retryAfter: 60 });
		app = createApp(defineComponent({ setup: () => () => h(MkVerificationCode, {
			modelValue: proof.value, 'onUpdate:modelValue': value => { proof.value = value; },
			channel: 'sms', purpose: 'signup', address: '13800138000',
		}) }));
		app.mount(host);
		await nextTick();
		const button = () => host.querySelector<HTMLButtonElement>('[data-send]')!;
		expect(button().disabled).toBe(true);
		host.querySelector<HTMLButtonElement>('[data-captcha]')!.click();
		await nextTick();
		button().click();
		await vi.advanceTimersByTimeAsync(1);
		await nextTick();
		expect(state.send).toHaveBeenCalledWith('auth/send-code', expect.objectContaining({ 'm-captcha-response': 'captcha-token' }));
		expect(proof.value.challengeId).toBe('challenge-1');
		expect(button().disabled).toBe(true);
		expect(state.mounts).toBe(2);
		await vi.advanceTimersByTimeAsync(60000);
		await nextTick();
		expect(button().disabled).toBe(true);
		host.querySelector<HTMLButtonElement>('[data-captcha]')!.click();
		await nextTick();
		expect(button().disabled).toBe(false);
	});

	test('drops a pending send response after the destination changes', async () => {
		const proof = ref({ challengeId: '', code: '' });
		const address = ref('13800138000');
		let resolve!: (value: { challengeId: string; retryAfter: number }) => void;
		state.send.mockImplementation(() => new Promise(r => { resolve = r; }));
		app = createApp(defineComponent({ setup: () => () => h(MkVerificationCode, {
			modelValue: proof.value, 'onUpdate:modelValue': value => { proof.value = value; },
			channel: 'sms', purpose: 'signup', address: address.value,
		}) }));
		app.mount(host);
		host.querySelector<HTMLButtonElement>('[data-captcha]')!.click();
		await nextTick();
		host.querySelector<HTMLButtonElement>('[data-send]')!.click();
		address.value = '13800138001';
		await nextTick();
		resolve({ challengeId: 'stale', retryAfter: 60 });
		await vi.advanceTimersByTimeAsync(1);
		expect(proof.value.challengeId).toBe('');
		expect(host.querySelector('[data-send]')?.textContent).toBe('获取验证码');
	});

	test('clears the old destination cooldown when the phone number changes', async () => {
		state.instance.enableMcaptcha = false;
		state.send.mockRejectedValueOnce({ code: 'RATE_LIMIT_EXCEEDED', info: { retryAfter: 3600 } })
			.mockResolvedValue({ challengeId: 'new-phone', retryAfter: 60 });
		const address = ref('13800138000');
		app = createApp(defineComponent({ setup: () => () => h(MkVerificationCode, { modelValue: { challengeId: '', code: '' }, channel: 'sms', purpose: 'signup', address: address.value }) }));
		app.mount(host);
		await nextTick();
		const button = () => host.querySelector<HTMLButtonElement>('[data-send]')!;
		button().click();
		await vi.advanceTimersByTimeAsync(1);
		expect(button().disabled).toBe(true);
		address.value = '13800138001';
		await nextTick();
		expect(host.querySelector('[role="status"]')).toBeNull();
		expect(button().disabled).toBe(false);
		button().click();
		await vi.advanceTimersByTimeAsync(1);
		expect(state.send).toHaveBeenLastCalledWith('auth/send-code', expect.objectContaining({ address: '13800138001' }));
	});

	test('ignores a late rate limit error for an edited phone number', async () => {
		state.instance.enableMcaptcha = false;
		let reject!: (error: unknown) => void;
		state.send.mockImplementation(() => new Promise((_resolve, fail) => { reject = fail; }));
		const address = ref('13800138000');
		app = createApp(defineComponent({ setup: () => () => h(MkVerificationCode, { modelValue: { challengeId: '', code: '' }, channel: 'sms', purpose: 'signup', address: address.value }) }));
		app.mount(host);
		await nextTick();
		const button = () => host.querySelector<HTMLButtonElement>('[data-send]')!;
		button().click();
		address.value = '13800138001';
		await nextTick();
		reject({ code: 'RATE_LIMIT_EXCEEDED', info: { retryAfter: 3600 } });
		await vi.advanceTimersByTimeAsync(1);
		expect(button().disabled).toBe(false);
		expect(host.querySelector('[role="status"]')).toBeNull();
		expect(state.alert).not.toHaveBeenCalled();
	});

	test('shows and counts down the server wait after a rejected send', async () => {
		state.send.mockRejectedValue({ code: 'RATE_LIMIT_EXCEEDED', info: { retryAfter: 65, resetMs: Date.now() + 65000 } });
		app = createApp(MkVerificationCode, { modelValue: { challengeId: '', code: '' }, channel: 'sms', purpose: 'signup', address: '13800138000' });
		app.mount(host);
		host.querySelector<HTMLButtonElement>('[data-captcha]')!.click();
		await nextTick();
		const button = () => host.querySelector<HTMLButtonElement>('[data-send]')!;
		button().click();
		await vi.advanceTimersByTimeAsync(1);
		expect(button().disabled).toBe(true);
		expect(button().textContent).toBe('1分5秒后重试');
		expect(host.querySelector('[role="status"]')?.textContent).toBe('操作频繁，请在1分5秒后重试');
		expect(state.alert).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(60000);
		expect(button().textContent).toBe('5秒后重试');
		await vi.advanceTimersByTimeAsync(5000);
		expect(host.querySelector('[role="status"]')).toBeNull();
		expect(button().disabled).toBe(true);
		host.querySelector<HTMLButtonElement>('[data-captcha]')!.click();
		await nextTick();
		expect(button().disabled).toBe(false);
	});

	test('allows binding and retrying the same email without CAPTCHA', async () => {
		state.authenticate.mockResolvedValue({ canceled: false, result: { password: 'password', token: null } });
		state.updateEmail.mockRejectedValueOnce({ code: 'VERIFICATION_UNAVAILABLE' }).mockResolvedValue({});
		app = createApp(EmailSettings);
		const shell = defineComponent({ setup(_props, { slots }) { return () => h('div', slots.default?.()); } });
		app.component('SearchMarker', shell);
		app.component('SearchLabel', shell);
		const handledError = vi.fn();
		app.config.errorHandler = handledError;
		app.mount(host);
		await nextTick();
		const button = () => host.querySelector<HTMLButtonElement>('[data-send]')!;
		expect(host.querySelector('[data-captcha]')).toBeNull();
		expect(button().disabled).toBe(false);
		button().click();
		await vi.advanceTimersByTimeAsync(1);
		await nextTick();
		expect(handledError).toHaveBeenCalled();
		expect(button().disabled).toBe(false);
		button().click();
		await vi.advanceTimersByTimeAsync(1);
		expect(state.updateEmail).toHaveBeenCalledTimes(2);
		expect(state.updateEmail).toHaveBeenLastCalledWith('i/update-email', { email: 'alice@example.com', password: 'password', token: null });
	});

	test('sends email recovery codes without a CAPTCHA widget or SMS cooldown', async () => {
		state.send.mockResolvedValue({ challengeId: 'email-code', retryAfter: 0 });
		app = createApp(MkVerificationCode, { modelValue: { challengeId: '', code: '' }, channel: 'email', purpose: 'password-reset', address: 'alice@example.com', username: 'alice' });
		app.mount(host);
		await nextTick();
		expect(host.querySelector('[data-captcha]')).toBeNull();
		const button = host.querySelector<HTMLButtonElement>('[data-send]')!;
		expect(button.disabled).toBe(false);
		button.click();
		await vi.advanceTimersByTimeAsync(1);
		expect(state.send).toHaveBeenCalledWith('auth/send-code', { channel: 'email', purpose: 'password-reset', address: 'alice@example.com', username: 'alice', invitationCode: undefined });
		expect(button.disabled).toBe(false);
	});

	const fill = async (selector: string, value: string) => {
		const element = host.querySelector<HTMLInputElement>(selector)!;
		element.value = value;
		element.dispatchEvent(new Event('input'));
		await nextTick();
	};
	const smsOption = () => Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === '通过手机找回');
	const mockRecovery = (preferEmail = true) => state.send.mockImplementation(async (endpoint: string) => {
		if (endpoint === 'auth/begin-password-reset') return { preferEmail };
		if (endpoint === 'auth/send-code') return { challengeId: 'reset-proof', retryAfter: 0 };
		return undefined;
	});

	test('defaults to email and exposes SMS only after fifteen seconds without a waiting hint on the recovery screen', async () => {
		mockRecovery();
		app = createApp(MkForgotPassword, { initialUsername: 'alice' });
		app.mount(host);
		await vi.advanceTimersByTimeAsync(1);
		expect(host.querySelector('input[type="email"]')).not.toBeNull();
		expect(host.querySelector('[data-captcha]')).toBeNull();
		expect(smsOption()).toBeUndefined();
		expect(host.querySelector('[role="status"]')).toBeNull();
		await vi.advanceTimersByTimeAsync(14000);
		expect(smsOption()).toBeUndefined();
		await vi.advanceTimersByTimeAsync(1000);
		smsOption()!.click();
		await nextTick();
		expect(host.querySelector('input[type="tel"]')).not.toBeNull();
		expect(host.querySelector('[data-captcha]')).not.toBeNull();
		await fill('input[type="tel"]', '13800138000');
		expect(host.querySelector<HTMLButtonElement>('[data-send]')!.disabled).toBe(true);
		host.querySelector<HTMLButtonElement>('[data-captcha]')!.click();
		await nextTick();
		host.querySelector<HTMLButtonElement>('[data-send]')!.click();
		await vi.advanceTimersByTimeAsync(1);
		expect(state.send).toHaveBeenLastCalledWith('auth/send-code', expect.objectContaining({ channel: 'sms', purpose: 'password-reset', 'm-captcha-response': 'captcha-token' }));
	});

	test('resets with an email code and matching passwords without a CAPTCHA or automatic login', async () => {
		mockRecovery();
		app = createApp(MkForgotPassword, { initialUsername: 'alice' });
		app.mount(host);
		await vi.advanceTimersByTimeAsync(1);
		expect(host.querySelector<HTMLInputElement>('input[autocomplete="username"]')!.readOnly).toBe(true);
		await fill('input[type="email"]', 'alice@example.com');
		expect(host.querySelector('[data-captcha]')).toBeNull();
		host.querySelector<HTMLButtonElement>('[data-send]')!.click();
		await vi.advanceTimersByTimeAsync(1);
		expect(state.send).toHaveBeenLastCalledWith('auth/send-code', expect.objectContaining({ channel: 'email', purpose: 'password-reset', username: 'alice', address: 'alice@example.com' }));
		await fill('input[autocomplete="one-time-code"]', '123456');
		await fill('input[type="password"]', 'new-password');
		const confirm = host.querySelectorAll<HTMLInputElement>('input[type="password"]')[1];
		confirm.value = 'different';
		confirm.dispatchEvent(new Event('input'));
		await nextTick();
		expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
		confirm.value = 'new-password';
		confirm.dispatchEvent(new Event('input'));
		await nextTick();
		expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
		host.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
		await vi.advanceTimersByTimeAsync(1);
		expect(state.send).toHaveBeenLastCalledWith('reset-password', { challengeId: 'reset-proof', code: '123456', password: 'new-password' });
		expect(state.close).toHaveBeenCalled();
		expect(state.send.mock.calls.some(([endpoint]) => endpoint.startsWith('signin'))).toBe(false);
	});

	test.each([true, false])('shows SMS immediately when no verified email is available (mail enabled: %s)', async (enabled) => {
		state.instance.enableEmail = enabled;
		mockRecovery(false);
		app = createApp(MkForgotPassword, { initialUsername: 'alice' });
		app.mount(host);
		await vi.advanceTimersByTimeAsync(1);
		expect(state.send).toHaveBeenCalledWith('auth/begin-password-reset', { username: 'alice' });
		expect(host.querySelector('input[type="email"]')).toBeNull();
		expect(host.querySelector('input[type="tel"]')).not.toBeNull();
		expect(host.querySelector('[data-captcha]')).not.toBeNull();
		expect(host.querySelector('[role="status"]')).toBeNull();
	});

	test('asks for the account when recovery is opened directly', async () => {
		mockRecovery();
		app = createApp(MkForgotPassword);
		app.mount(host);
		expect(state.send).not.toHaveBeenCalled();
		await fill('input[autocomplete="username"]', 'alice');
		host.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
		await vi.advanceTimersByTimeAsync(1);
		expect(state.send).toHaveBeenCalledWith('auth/begin-password-reset', { username: 'alice' });
		expect(host.querySelector('input[type="email"]')).not.toBeNull();
	});

	test('allows retrying a failed recovery preference request', async () => {
		mockRecovery();
		state.send.mockRejectedValueOnce(new Error('network unavailable'));
		app = createApp(MkForgotPassword, { initialUsername: 'alice' });
		app.mount(host);
		await vi.advanceTimersByTimeAsync(1);
		expect(host.querySelector('input[type="email"]')).toBeNull();
		host.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
		await vi.advanceTimersByTimeAsync(1);
		expect(state.send.mock.calls.filter(([endpoint]) => endpoint === 'auth/begin-password-reset')).toHaveLength(2);
		expect(host.querySelector('input[type="email"]')).not.toBeNull();
	});

	test('hides SMS recovery and its delay when phone verification is disabled', async () => {
		state.instance.enablePhoneVerification = false;
		state.instance.phoneVerificationAvailable = false;
		mockRecovery();
		app = createApp(MkForgotPassword, { initialUsername: 'alice' });
		app.mount(host);
		await vi.advanceTimersByTimeAsync(1);
		expect(host.querySelector('input[type="email"]')).not.toBeNull();
		expect(host.querySelector('input[type="tel"]')).toBeNull();
		await vi.advanceTimersByTimeAsync(16000);
		expect(smsOption()).toBeUndefined();
	});

	test('keeps the binding banner after SMS is disabled until the email is verified', async () => {
		app = createApp(EmailVerificationBanner);
		app.component('MkA', defineComponent({ props: ['to'], setup(props, { slots }) { return () => h('a', { href: props.to }, slots.default?.()); } }));
		app.mount(host);
		expect(host.querySelector('[role="status"]')).not.toBeNull();
		expect(host.querySelector('a')?.getAttribute('href')).toBe('/settings/email');
		expect(host.querySelector('button')).toBeNull();
		state.instance.enablePhoneVerification = false;
		await nextTick();
		expect(host.querySelector('[role="status"]')).not.toBeNull();
		state.user.emailVerified = true;
		await nextTick();
		expect(host.querySelector('[role="status"]')).toBeNull();
	});

	function mountSignup() {
		state.send.mockImplementation(async (endpoint: string) => endpoint === 'username/available' ? { available: true } : { challengeId: 'signup-proof', retryAfter: 60 });
		app = createApp(MkSignupForm);
		app.directive('tooltip', {});
		app.mount(host);
	}

	test('offers email-only registration and requires verification before submitting', async () => {
		state.instance.enablePhoneVerification = false;
		state.instance.enableMcaptcha = false;
		mountSignup();
		const fetch = vi.spyOn(window, 'fetch').mockResolvedValue(new Response(JSON.stringify({ token: 'registered' }), { status: 200 }));
		await fill('[data-testid="signup-username"]', 'email_user');
		await fill('[data-testid="signup-password"]', 'password123');
		await fill('[data-testid="signup-password-retype"]', 'password123');
		await fill('[data-testid="signup-email"]', 'alice@gmail.com');
		expect(host.querySelector('[data-testid="signup-phone"]')).toBeNull();
		expect(host.querySelector('[data-method]')).toBeNull();
		host.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
		expect(fetch).not.toHaveBeenCalled();
		host.querySelector<HTMLButtonElement>('[data-send]')!.click();
		await vi.advanceTimersByTimeAsync(1);
		await fill('input[autocomplete="one-time-code"]', '123456');
		host.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
		await vi.advanceTimersByTimeAsync(1);
		const payload = JSON.parse(fetch.mock.calls[0][1]!.body as string);
		expect(payload).toMatchObject({ username: 'email_user', emailChallengeId: 'signup-proof', emailCode: '123456' });
		expect(payload).not.toHaveProperty('phoneChallengeId');
	});

	test('clears proofs when switching signup methods and rejects non-numeric QQ aliases', async () => {
		Object.assign(state.instance, { allowEmailSignup: true, restrictSignupEmailDomains: true, requireNumericQqEmail: true, enableMcaptcha: false });
		mountSignup();
		await fill('[data-testid="signup-phone"]', '13800138000');
		host.querySelector<HTMLButtonElement>('[data-send]')!.click();
		await vi.advanceTimersByTimeAsync(1);
		await fill('input[autocomplete="one-time-code"]', '123456');
		const select = host.querySelector<HTMLSelectElement>('[data-method]')!;
		select.value = 'email';
		select.dispatchEvent(new Event('change'));
		await nextTick();
		expect(host.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')?.value).toBe('');
		for (const [address, disabled] of [['alias@qq.com', true], ['alice@example.com', true], ['123456@qq.com', false], ['alice@gmail.com', false]] as const) {
			await fill('[data-testid="signup-email"]', address);
			expect(host.querySelector<HTMLButtonElement>('[data-send]')!.disabled).toBe(disabled);
		}
		state.instance.allowEmailSignup = false;
		await nextTick();
		expect(host.querySelector('[data-testid="signup-email"]')).toBeNull();
		expect(host.querySelector('[data-testid="signup-phone"]')).not.toBeNull();
	});

	test('releases the signup form when refreshing settings after a server rejection fails', async () => {
		state.instance.enablePhoneVerification = false;
		state.instance.enableMcaptcha = false;
		mountSignup();
		const fetch = vi.spyOn(window, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { code: 'INVALID_CODE' } }), { status: 400 }));
		await fill('[data-testid="signup-username"]', 'retry_email');
		await fill('[data-testid="signup-password"]', 'password123');
		await fill('[data-testid="signup-password-retype"]', 'password123');
		await fill('[data-testid="signup-email"]', 'retry@gmail.com');
		host.querySelector<HTMLButtonElement>('[data-send]')!.click();
		await vi.advanceTimersByTimeAsync(1);
		await fill('input[autocomplete="one-time-code"]', '123456');
		state.fetchInstance.mockRejectedValueOnce(new Error('offline'));
		host.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
		await vi.advanceTimersByTimeAsync(1);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(state.alert).toHaveBeenCalledWith({ type: 'error', text: '验证码错误' });
		expect(host.querySelector<HTMLButtonElement>('[data-testid="signup-submit"]')?.disabled).toBe(false);
	});

	test('does not start a countdown when the recovery response arrives after closing', async () => {
		let resolve!: (value: unknown) => void;
		state.send.mockImplementation(() => new Promise(done => { resolve = done; }));
		const show = ref(true);
		app = createApp(defineComponent({ setup: () => () => show.value ? h(MkForgotPassword, { initialUsername: 'alice' }) : null }));
		app.mount(host);
		show.value = false;
		await nextTick();
		resolve({ preferEmail: true });
		await vi.advanceTimersByTimeAsync(1);
		expect(vi.getTimerCount()).toBe(0);
	});
});

test.each([
	[59, '59秒'],
	[65, '1分5秒'],
	[3599, '59分59秒'],
	[3661, '1小时2分'],
	[86400, '24小时0分'],
])('formats a %i second wait for the verification prompt', (seconds, expected) => {
	expect(formatVerificationWait(seconds)).toBe(expected);
});

test('uses the server reset time and handles errors without a known retry time', () => {
	expect(verificationRetryAfter({ code: 'RATE_LIMIT_EXCEEDED', info: { resetMs: Date.now() + 12500, retryAfter: 60 } })).toBe(13);
	expect(verificationRetryAfter({ code: 'RATE_LIMIT_EXCEEDED', info: { resetMs: Date.now() - 1000 } })).toBe(0);
	expect(verificationErrorMessage({ code: 'RATE_LIMIT_EXCEEDED', info: { retryAfter: 13 } })).toBe('操作频繁，请在13秒后重试');
	expect(verificationErrorMessage({ code: 'RATE_LIMIT_EXCEEDED' })).toBe('操作频繁，请稍后重试');
});

