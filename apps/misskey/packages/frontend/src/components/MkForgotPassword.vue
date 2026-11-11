<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModalWindow ref="dialog" :width="420" :height="accountReady ? 620 : 240" @close="dialog?.close()" @closed="emit('closed')">
	<template #header>{{ i18n.ts.forgotPassword }}</template>
	<div class="_spacer _gaps" style="--MI_SPACER-min: 16px; --MI_SPACER-max: 24px;" :inert="processing">
		<MkLoading v-if="preparing"/>
		<form v-else-if="!accountReady" class="_gaps" @submit.prevent="startRecovery">
			<MkInput v-model="username" autocomplete="username" pattern="^[a-zA-Z0-9_]{1,20}$" :spellcheck="false" autofocus required>
				<template #label>{{ i18n.ts.username }}</template>
				<template #prefix>@</template>
			</MkInput>
			<MkInfo v-if="recoveryFailed" warn>{{ i18n.ts._phoneAuth.recoveryLoadFailed }}</MkInfo>
			<MkButton type="submit" primary :disabled="!username.trim()">{{ recoveryFailed ? i18n.ts.retry : i18n.ts.continue }}</MkButton>
		</form>
		<form v-else-if="method === 'email' ? emailAvailable : smsReady" class="_gaps" @submit.prevent="onSubmit">
			<template v-if="method === 'email'">
				<MkInput v-model="username" autocomplete="username" :spellcheck="false" readonly>
					<template #label>{{ i18n.ts.username }}</template>
					<template #prefix>@</template>
				</MkInput>
				<MkInput v-model="email" type="email" autocomplete="email" :spellcheck="false" :placeholder="i18n.ts._phoneAuth.emailResetHint" required>
					<template #label>{{ i18n.ts.emailAddress }}</template>
				</MkInput>
			</template>
			<MkInput v-else v-model="phone" type="tel" autocomplete="tel-national" :placeholder="i18n.ts._phoneAuth.resetHint" required>
				<template #label>{{ i18n.ts._phoneAuth.phone }}</template>
				<template #caption>{{ i18n.ts._phoneAuth.phoneHint }}</template>
			</MkInput>
			<MkVerificationCode
				:key="method" v-model="proof" :channel="method" purpose="password-reset"
				:address="method === 'email' ? email : phone" :username="method === 'email' ? username : undefined"
				:disabled="method === 'email' ? !email || !username : !phone || !smsReady"
			/>
			<MkInput v-model="password" type="password" autocomplete="new-password" required>
				<template #label>{{ i18n.ts.newPassword }}</template>
			</MkInput>
			<MkInput v-model="retypedPassword" type="password" autocomplete="new-password" required>
				<template #label>{{ i18n.ts.newPassword }} ({{ i18n.ts.retype }})</template>
				<template v-if="retypedPassword && password !== retypedPassword" #caption>{{ i18n.ts.passwordNotMatched }}</template>
			</MkInput>
			<MkButton type="submit" primary :disabled="!canReset">{{ i18n.ts.resetPassword }}</MkButton>
		</form>
		<MkInfo v-else-if="!instance.phoneVerificationAvailable">{{ i18n.ts._forgotPassword.contactAdmin }}</MkInfo>
		<MkButton v-if="method === 'email' && smsReady" @click="method = 'sms'">{{ i18n.ts._phoneAuth.useSmsRecovery }}</MkButton>
		<MkButton v-else-if="method === 'sms' && emailAvailable" @click="method = 'email'">{{ i18n.ts._phoneAuth.emailReset }}</MkButton>
	</div>
</MkModalWindow>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import MkModalWindow from '@/components/MkModalWindow.vue';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkVerificationCode from '@/components/MkVerificationCode.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { verificationErrorMessage } from '@/utility/verification-error.js';
import * as os from '@/os.js';
import { instance } from '@/instance.js';
import { i18n } from '@/i18n.js';

const emit = defineEmits<{
	(ev: 'done'): void;
	(ev: 'closed'): void;
}>();

const props = defineProps<{ initialUsername?: string }>();
const dialog = useTemplateRef('dialog');
const username = ref(props.initialUsername ?? '');
const email = ref('');
const phone = ref('');
const method = ref<'sms' | 'email'>('email');
const proof = ref({ challengeId: '', code: '' });
const password = ref('');
const retypedPassword = ref('');
const processing = ref(false);
const accountReady = ref(false);
const recoveryFailed = ref(false);
const preparing = ref(false);
const emailAvailable = ref(false);
const remaining = ref(0);
const smsReady = computed(() => instance.phoneVerificationAvailable && accountReady.value && remaining.value === 0);
const canReset = computed(() => !processing.value && !!proof.value.challengeId && /^\d{6}$/.test(proof.value.code) && !!password.value && password.value === retypedPassword.value);
let timer: number | undefined;
let disposed = false;

watch(method, () => { proof.value = { challengeId: '', code: '' }; });

async function startRecovery() {
	if (!username.value.trim() || preparing.value) return;
	preparing.value = true;
	window.clearInterval(timer);
	accountReady.value = false;
	remaining.value = 0;
	emailAvailable.value = false;
	proof.value = { challengeId: '', code: '' };
	recoveryFailed.value = false;
	try {
		const result = await misskeyApi('auth/begin-password-reset', { username: username.value.trim() });
		if (disposed) return;
		username.value = username.value.trim();
		accountReady.value = true;
		emailAvailable.value = result.preferEmail;
		method.value = result.preferEmail ? 'email' : 'sms';
		remaining.value = result.preferEmail ? 15 : 0;
		const readyAt = Date.now() + remaining.value * 1000;
		if (remaining.value > 0) {
			timer = window.setInterval(() => { remaining.value = Math.max(0, Math.ceil((readyAt - Date.now()) / 1000)); }, 250);
		}
	} catch {
		if (!disposed) recoveryFailed.value = true;
	} finally {
		preparing.value = false;
	}
}

onMounted(startRecovery);
onBeforeUnmount(() => {
	disposed = true;
	window.clearInterval(timer);
	password.value = '';
	retypedPassword.value = '';
});

async function onSubmit() {
	if (!canReset.value) return;
	processing.value = true;
	try {
		await misskeyApi('reset-password', { challengeId: proof.value.challengeId, code: proof.value.code, password: password.value });
		await os.alert({ type: 'success', text: i18n.ts._phoneAuth.passwordResetDone });
		emit('done');
		dialog.value?.close();
	} catch (err) {
		await os.alert({ type: 'error', text: verificationErrorMessage(err) });
	} finally {
		processing.value = false;
	}
}
</script>
