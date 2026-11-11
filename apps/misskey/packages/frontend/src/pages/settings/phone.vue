<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_spacer" style="--MI_SPACER-w: 600px;">
	<MkInfo v-if="!instance.enablePhoneVerification">{{ i18n.ts._registration.phoneDisabled }}</MkInfo>
	<form v-else class="_gaps_m" :inert="saving" @submit.prevent="save">
		<MkInfo>{{ i18n.ts._phoneAuth.changeHint }}</MkInfo>
		<div>{{ i18n.ts._phoneAuth.currentPhone }}: {{ $i.phoneNumber ?? i18n.ts.notSet }}</div>
		<template v-if="$i.phoneNumber">
			<MkVerificationCode v-model="oldProof" channel="sms" purpose="phone-old"/>
		</template>
		<MkInput v-model="phone" type="tel" autocomplete="tel-national" required>
			<template #label>{{ i18n.ts._phoneAuth.newPhone }}</template>
			<template #caption>{{ i18n.ts._phoneAuth.phoneHint }}</template>
		</MkInput>
		<MkVerificationCode v-model="newProof" channel="sms" purpose="phone-new" :address="phone" :disabled="!phone"/>
		<MkButton type="submit" primary :disabled="!newProof.challengeId || !newProof.code || (!!$i.phoneNumber && (!oldProof.challengeId || !oldProof.code))">{{ i18n.ts.save }}</MkButton>
	</form>
</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { instance, fetchInstance } from '@/instance.js';
import MkInfo from '@/components/MkInfo.vue';
import MkInput from '@/components/MkInput.vue';
import MkButton from '@/components/MkButton.vue';
import MkVerificationCode from '@/components/MkVerificationCode.vue';
import { ensureSignin } from '@/i.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { verificationErrorMessage } from '@/utility/verification-error.js';
import * as os from '@/os.js';

const $i = ensureSignin();
const phone = ref('');
const oldProof = ref({ challengeId: '', code: '' });
const newProof = ref({ challengeId: '', code: '' });
const saving = ref(false);
onMounted(() => fetchInstance(true));

async function save() {
	if (saving.value) return;
	const auth = await os.authenticateDialog();
	if (auth.canceled) return;
	saving.value = true;
	try {
		const result = await misskeyApi('i/update-phone', {
			password: auth.result.password, token: auth.result.token,
			oldChallengeId: oldProof.value.challengeId || undefined, oldCode: oldProof.value.code || undefined,
			newChallengeId: newProof.value.challengeId, newCode: newProof.value.code,
		});
		$i.phoneNumber = result.phoneNumber;
		phone.value = '';
		oldProof.value = { challengeId: '', code: '' };
		newProof.value = { challengeId: '', code: '' };
		os.success();
	} catch (err) {
		await os.alert({ type: 'error', text: verificationErrorMessage(err) });
	} finally {
		saving.value = false;
	}
}

definePage(() => ({ title: i18n.ts._phoneAuth.phone, icon: 'ti ti-device-mobile' }));
</script>

