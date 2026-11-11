<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div>
	<div :class="$style.banner">
		<i class="ti ti-user-edit"></i>
	</div>
	<div class="_spacer" style="--MI_SPACER-min: 16px; --MI_SPACER-max: 24px;">
		<form class="_gaps" autocomplete="new-password" @submit.prevent="onSubmit">
			<MkInput v-if="instance.disableRegistration" v-model="invitationCode" type="text" :spellcheck="false" required data-testid="signup-invitation-code">
				<template #label>{{ i18n.ts.invitationCode }}</template>
				<template #prefix><i class="ti ti-key"></i></template>
			</MkInput>
			<MkInput v-model="username" type="text" pattern="^[a-zA-Z0-9_]{1,20}$" :spellcheck="false" autocomplete="username" required data-testid="signup-username" @update:modelValue="onChangeUsername">
				<template #label>{{ i18n.ts.username }} <div v-tooltip:dialog="i18n.ts.usernameInfo" class="_button _help"><i class="ti ti-help-circle"></i></div></template>
				<template #prefix>@</template>
				<template #suffix>@{{ host }}</template>
				<template #caption>
					<div><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.cannotBeChangedLater }}</div>
					<span v-if="usernameState === 'wait'" style="color:#999"><MkLoading :em="true"/> {{ i18n.ts.checking }}</span>
					<span v-else-if="usernameState === 'ok'" style="color: var(--MI_THEME-success)"><i class="ti ti-check ti-fw"></i> {{ i18n.ts.available }}</span>
					<span v-else-if="usernameState === 'unavailable'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.unavailable }}</span>
					<span v-else-if="usernameState === 'error'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.error }}</span>
					<span v-else-if="usernameState === 'invalid-format'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.usernameInvalidFormat }}</span>
					<span v-else-if="usernameState === 'min-range'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.tooShort }}</span>
					<span v-else-if="usernameState === 'max-range'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.tooLong }}</span>
				</template>
			</MkInput>
			<MkInfo v-if="!instance.phoneVerificationAvailable" warn>{{ i18n.ts._phoneAuth.unavailable }}</MkInfo>
			<MkInput v-model="phone" type="tel" autocomplete="tel-national" required data-testid="signup-phone">
				<template #label>{{ i18n.ts._phoneAuth.phone }}</template>
				<template #caption>{{ i18n.ts._phoneAuth.signupHint }}</template>
			</MkInput>
			<MkVerificationCode v-model="phoneProof" channel="sms" purpose="signup" :address="phone" :invitationCode="invitationCode" :disabled="!phone || !instance.phoneVerificationAvailable"/>

			<MkInput v-model="password" type="password" autocomplete="new-password" required data-testid="signup-password" @update:modelValue="onChangePassword">
				<template #label>{{ i18n.ts.password }}</template>
				<template #prefix><i class="ti ti-lock"></i></template>
				<template #caption>
					<span v-if="passwordStrength == 'low'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.weakPassword }}</span>
					<span v-if="passwordStrength == 'medium'" style="color: var(--MI_THEME-warn)"><i class="ti ti-check ti-fw"></i> {{ i18n.ts.normalPassword }}</span>
					<span v-if="passwordStrength == 'high'" style="color: var(--MI_THEME-success)"><i class="ti ti-check ti-fw"></i> {{ i18n.ts.strongPassword }}</span>
				</template>
			</MkInput>
			<MkInput v-model="retypedPassword" type="password" autocomplete="new-password" required data-testid="signup-password-retype" @update:modelValue="onChangePasswordRetype">
				<template #label>{{ i18n.ts.password }} ({{ i18n.ts.retype }})</template>
				<template #prefix><i class="ti ti-lock"></i></template>
				<template #caption>
					<span v-if="passwordRetypeState == 'match'" style="color: var(--MI_THEME-success)"><i class="ti ti-check ti-fw"></i> {{ i18n.ts.passwordMatched }}</span>
					<span v-if="passwordRetypeState == 'not-match'" style="color: var(--MI_THEME-error)"><i class="ti ti-alert-triangle ti-fw"></i> {{ i18n.ts.passwordNotMatched }}</span>
				</template>
			</MkInput>
			<MkButton type="submit" :disabled="shouldDisableSubmitting" large gradate rounded data-testid="signup-submit" style="margin: 0 auto;">
				<template v-if="submitting">
					<MkLoading :em="true" :colored="false"/>
				</template>
				<template v-else>{{ i18n.ts.start }}</template>
			</MkButton>
		</form>
	</div>
</div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { toUnicode } from 'punycode.js';
import * as Misskey from 'misskey-js';
import * as config from '@@/js/config.js';
import MkButton from './MkButton.vue';
import MkInput from './MkInput.vue';
import MkVerificationCode from '@/components/MkVerificationCode.vue';
import MkInfo from '@/components/MkInfo.vue';
import { verificationErrorMessage } from '@/utility/verification-error.js';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { instance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { login } from '@/accounts.js';

const props = withDefaults(defineProps<{
	autoSet?: boolean;
}>(), {
	autoSet: false,
});

const emit = defineEmits<{
	(ev: 'signup', user: Misskey.entities.SignupResponse): void;
	(ev: 'signupEmailPending'): void;
}>();

const host = toUnicode(config.host);

const username = ref<string>('');
const password = ref<string>('');
const retypedPassword = ref<string>('');
const invitationCode = ref<string>('');
const phone = ref('');
const phoneProof = ref({ challengeId: '', code: '' });
const usernameState = ref<null | 'wait' | 'ok' | 'unavailable' | 'error' | 'invalid-format' | 'min-range' | 'max-range'>(null);
const passwordStrength = ref<'' | 'low' | 'medium' | 'high'>('');
const passwordRetypeState = ref<null | 'match' | 'not-match'>(null);
const submitting = ref<boolean>(false);
const usernameAbortController = ref<null | AbortController>(null);

const shouldDisableSubmitting = computed((): boolean => {
	return submitting.value ||
		!instance.phoneVerificationAvailable || !phoneProof.value.challengeId || !/^[0-9]{6}$/.test(phoneProof.value.code) ||
		instance.disableRegistration && invitationCode.value === '' ||
		usernameState.value !== 'ok' ||
		passwordRetypeState.value !== 'match';
});

function getPasswordStrength(source: string): number {
	let strength = 0;
	let power = 0.018;

	// 英数字
	if (/[a-zA-Z]/.test(source) && /[0-9]/.test(source)) {
		power += 0.020;
	}

	// 大文字と小文字が混ざってたら
	if (/[a-z]/.test(source) && /[A-Z]/.test(source)) {
		power += 0.015;
	}

	// 記号が混ざってたら
	if (/[!\x22\#$%&@'()*+,-./_]/.test(source)) {
		power += 0.02;
	}

	strength = power * source.length;

	return Math.max(0, Math.min(1, strength));
}

function onChangeUsername(): void {
	if (username.value === '') {
		usernameState.value = null;
		return;
	}

	{
		const err =
			!username.value.match(/^[a-zA-Z0-9_]+$/) ? 'invalid-format' :
			username.value.length < 1 ? 'min-range' :
			username.value.length > 20 ? 'max-range' :
			null;

		if (err) {
			usernameState.value = err;
			return;
		}
	}

	if (usernameAbortController.value != null) {
		usernameAbortController.value.abort();
	}
	usernameState.value = 'wait';
	usernameAbortController.value = new AbortController();

	misskeyApi('username/available', {
		username: username.value,
	}, undefined, usernameAbortController.value.signal).then(result => {
		usernameState.value = result.available ? 'ok' : 'unavailable';
	}).catch((err) => {
		if (err.name !== 'AbortError') {
			usernameState.value = 'error';
		}
	});
}

function onChangePassword(): void {
	if (password.value === '') {
		passwordStrength.value = '';
		return;
	}

	const strength = getPasswordStrength(password.value);
	passwordStrength.value = strength > 0.7 ? 'high' : strength > 0.3 ? 'medium' : 'low';
}

function onChangePasswordRetype(): void {
	if (retypedPassword.value === '') {
		passwordRetypeState.value = null;
		return;
	}

	passwordRetypeState.value = password.value === retypedPassword.value ? 'match' : 'not-match';
}

async function onSubmit(): Promise<void> {
	if (submitting.value) return;
	submitting.value = true;

	const signupPayload: Misskey.entities.SignupRequest = {
		username: username.value,
		password: password.value,
		phoneChallengeId: phoneProof.value.challengeId,
		phoneCode: phoneProof.value.code,
		invitationCode: invitationCode.value,
	};

	const res = await window.fetch(`${config.apiUrl}/signup`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(signupPayload),
	}).catch(() => {
		onSignupApiError();
		return null;
	});

	if (res && res.ok) {
		const resJson = (await res.json()) as Misskey.entities.SignupResponse;
		emit('signup', resJson);
		if (props.autoSet) await login(resJson.token);
	} else if (res) {
		const data = await res.json().catch(() => null);
		onSignupApiError(data?.error);
	}

	submitting.value = false;
}

function onSignupApiError(error?: unknown) {
	submitting.value = false;
	os.alert({ type: 'error', text: error ? verificationErrorMessage(error) : i18n.ts.somethingHappened });
}

</script>

<style lang="scss" module>
.banner {
	padding: 12px;
	text-align: center;
	font-size: 26px;
	background-color: var(--MI_THEME-accentedBg);
	color: var(--MI_THEME-accent);
}

</style>
