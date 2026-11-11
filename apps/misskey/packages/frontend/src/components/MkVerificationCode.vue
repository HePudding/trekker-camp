<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root">
	<MkCaptchaGate v-if="(channel === 'sms' || purpose === 'signup')" ref="captcha"/>
	<div :class="$style.row">
		<MkInput v-model="model.code" :class="$style.code" :placeholder="i18n.ts._phoneAuth.codePlaceholder" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{6}" required>
			<template #label>{{ i18n.ts._phoneAuth.code }}</template>
		</MkInput>
		<MkButton type="button" :class="$style.send" :disabled="sending || remaining > 0 || ((channel === 'sms' || purpose === 'signup') && !captcha?.ready) || disabled" @click="send">
			{{ remaining > 0 ? i18n.tsx._phoneAuth.resendAfter({ time: formatVerificationWait(remaining) }) : sending ? i18n.ts._phoneAuth.sending : sent ? i18n.ts._phoneAuth.resend : i18n.ts._phoneAuth.sendCode }}
		</MkButton>
	</div>
	<div v-if="rateLimited && remaining > 0" :class="$style.hint" role="status">{{ verificationErrorMessage({ code: errorCode, info: { retryAfter: remaining } }) }}</div>
	<div v-else-if="sent" :class="$style.hint" role="status">{{ i18n.ts._phoneAuth.sent }}</div>
</div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, useTemplateRef, watch } from 'vue';
import MkCaptchaGate from '@/components/MkCaptchaGate.vue';
import MkInput from '@/components/MkInput.vue';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { formatVerificationWait, verificationErrorMessage, verificationRetryAfter } from '@/utility/verification-error.js';
import * as os from '@/os.js';

const props = defineProps<{
	channel: 'sms' | 'email';
	purpose: 'signup' | 'phone-old' | 'phone-new' | 'password-reset';
	address?: string;
	username?: string;
	invitationCode?: string;
	disabled?: boolean;
}>();
const model = defineModel<{ challengeId: string; code: string }>({ required: true });
const sending = ref(false);
const sent = ref(false);
const rateLimited = ref(false);
const errorCode = ref('RATE_LIMIT_EXCEEDED');
const remaining = ref(0);
let nextSendAt = 0;
let revision = 0;
const clock = window.setInterval(() => { remaining.value = Math.max(0, Math.ceil((nextSendAt - Date.now()) / 1000)); }, 1000);
onBeforeUnmount(() => { window.clearInterval(clock); revision++; });
const captcha = useTemplateRef('captcha');

watch(() => [props.channel, props.purpose, props.address, props.invitationCode, props.username], () => {
	revision++;
	model.value = { challengeId: '', code: '' };
	sent.value = false;
	nextSendAt = 0;
	remaining.value = 0;
	rateLimited.value = false;
});

async function send() {
	if (sending.value || remaining.value > 0 || ((props.channel === 'sms' || props.purpose === 'signup') && !captcha.value?.ready) || props.disabled) return;
	sending.value = true;
	const currentRevision = revision;
	try {
		const result = await misskeyApi('auth/send-code', {
			channel: props.channel, purpose: props.purpose, address: props.address ?? '', invitationCode: props.invitationCode,
			username: props.username,
			...captcha.value?.tokens,
		});
		if (currentRevision !== revision) return;
		nextSendAt = Date.now() + result.retryAfter * 1000;
		remaining.value = result.retryAfter;
		rateLimited.value = false;
		model.value = { challengeId: result.challengeId, code: '' };
		sent.value = true;
	} catch (err) {
		if (currentRevision !== revision) return;
		const retryAfter = verificationRetryAfter(err);
		if (retryAfter > 0) {
			errorCode.value = (err as { code?: string }).code ?? 'RATE_LIMIT_EXCEEDED';
			nextSendAt = Date.now() + retryAfter * 1000;
			remaining.value = retryAfter;
			rateLimited.value = true;
		} else {
			await os.alert({ type: 'error', text: verificationErrorMessage(err) });
		}
	} finally {
		captcha.value?.reset();
		sending.value = false;
	}
}
</script>

<style lang="scss" module>
.root {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.row {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	align-items: end;
	gap: 8px;
}

.code {
	min-width: 0;
}

.send {
	height: 36px;
	white-space: nowrap;
}

.hint {
	font-size: 0.85em;
	color: color-mix(in srgb, var(--MI_THEME-fg) 75%, transparent);
	line-height: 1.5;
}
</style>

