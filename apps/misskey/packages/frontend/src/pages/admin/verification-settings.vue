<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader>
	<div class="_spacer" style="--MI_SPACER-w: 700px;">
		<form v-if="settings" class="_gaps_m" :inert="saving" @submit.prevent="save">
			<MkSwitch v-model="settings.enablePhoneVerification">
				{{ i18n.ts._registration.enablePhoneVerification }}
				<template #caption>{{ i18n.ts._registration.phoneSwitchHint }}</template>
			</MkSwitch>
			<template v-if="settings.enablePhoneVerification">
				<MkSwitch v-model="settings.allowEmailSignup">
					{{ i18n.ts._registration.allowEmailSignup }}
					<template #caption>{{ i18n.ts._registration.allowEmailSignupHint }}</template>
				</MkSwitch>
				<MkInfo>{{ i18n.ts._phoneAuth.adminHint }}</MkInfo>
				<MkInput v-model="settings.accessKeyId" autocomplete="off"><template #label>{{ i18n.ts._phoneAuth.accessKeyId }}</template></MkInput>
				<MkInput v-model="secret" type="password" autocomplete="new-password">
					<template #label>{{ i18n.ts._phoneAuth.accessKeySecret }}</template>
					<template #caption>{{ settings.hasAccessKeySecret ? i18n.ts._phoneAuth.secretSaved : i18n.ts._phoneAuth.secretRequired }}</template>
				</MkInput>
				<MkInput v-model="settings.signName"><template #label>{{ i18n.ts._phoneAuth.signName }}</template></MkInput>
				<MkInput v-model="settings.templateCode"><template #label>{{ i18n.ts._phoneAuth.templateCode }}</template></MkInput>
				<MkInput v-model="settings.changePhoneTemplateCode" required><template #label>{{ i18n.ts._phoneAuth.changePhoneTemplateCode }}</template></MkInput>
				<MkInput v-model="settings.resetPasswordTemplateCode" required><template #label>{{ i18n.ts._phoneAuth.resetPasswordTemplateCode }}</template></MkInput>
				<MkInput v-model="settings.bindPhoneTemplateCode" required><template #label>{{ i18n.ts._phoneAuth.bindPhoneTemplateCode }}</template></MkInput>
				<MkInput v-model="settings.verifyPhoneTemplateCode" required><template #label>{{ i18n.ts._phoneAuth.verifyPhoneTemplateCode }}</template></MkInput>
				<MkInput v-model="settings.schemeName" :maxlength="12"><template #label>{{ i18n.ts._phoneAuth.schemeName }}</template></MkInput>
				<MkInput v-model="settings.interval" type="number" :min="30" :max="3600"><template #label>{{ i18n.ts._phoneAuth.interval }}</template></MkInput>
				<MkInput v-model="settings.validTime" type="number" :min="60" :max="1800" :step="60"><template #label>{{ i18n.ts._phoneAuth.validTime }}</template></MkInput>
				<MkInput v-model="settings.perAddressHourly" type="number" :min="1" :max="100"><template #label>{{ i18n.ts._phoneAuth.perAddressHourly }}</template></MkInput>
				<MkInput v-model="settings.perAddressDaily" type="number" :min="1" :max="1000"><template #label>{{ i18n.ts._phoneAuth.perAddressDaily }}</template></MkInput>
				<MkInput v-model="settings.ipHourly" type="number" :min="1" :max="10000"><template #label>{{ i18n.ts._phoneAuth.ipHourly }}</template></MkInput>
				<MkInput v-model="settings.ipDaily" type="number" :min="1" :max="100000"><template #label>{{ i18n.ts._phoneAuth.ipDaily }}</template></MkInput>
				<MkInput v-model="settings.accountHourly" type="number" :min="1" :max="100"><template #label>{{ i18n.ts._phoneAuth.accountHourly }}</template></MkInput>
				<MkInput v-model="settings.accountDaily" type="number" :min="1" :max="1000"><template #label>{{ i18n.ts._phoneAuth.accountDaily }}</template></MkInput>
				<MkInput v-model="settings.globalDaily" type="number" :min="1" :max="100000">
					<template #label>{{ i18n.ts._phoneAuth.globalDaily }}</template>
					<template #caption>{{ i18n.ts._phoneAuth.globalDailyHint }}</template>
				</MkInput>
				<MkInput v-model="settings.attempts" type="number" :min="1" :max="10"><template #label>{{ i18n.ts._phoneAuth.attempts }}</template></MkInput>
			</template>
		</form>
		<MkLoading v-else/>
	</div>
	<template #footer>
		<div :class="$style.footer">
			<div class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 16px;">
				<div class="_buttons">
					<MkButton primary rounded :disabled="saving" @click="save"><i class="ti ti-check"></i> {{ i18n.ts.save }}</MkButton>
					<MkButton rounded :disabled="saving || !settings.enablePhoneVerification" @click="testSms"><i class="ti ti-send"></i> {{ i18n.ts._registration.testSms }}</MkButton>
				</div>
			</div>
		</div>
	</template>
</PageWithHeader>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkInput from '@/components/MkInput.vue';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { fetchInstance } from '@/instance.js';
import * as os from '@/os.js';

const settings = ref(await misskeyApi('admin/verification-settings'));
const secret = ref('');
const saving = ref(false);

async function save() {
	if (saving.value) return;
	saving.value = true;
	try {
		const { hasAccessKeySecret: _hasAccessKeySecret, ...values } = settings.value;
		await os.apiWithDialog('admin/update-verification-settings', { ...values, ...(secret.value ? { accessKeySecret: secret.value } : {}) });
		secret.value = '';
		settings.value = await misskeyApi('admin/verification-settings');
		await fetchInstance(true);
	} finally {
		saving.value = false;
	}
}

async function testSms() {
	const { canceled, result: to } = await os.inputText({
		title: i18n.ts._registration.testSms,
		type: 'text',
		text: i18n.ts._registration.testSmsHint,
		minLength: 11,
	});
	if (canceled) return;
	await save();
	await os.apiWithDialog('admin/send-sms', { to });
}

definePage(() => ({ title: i18n.ts._phoneAuth.settings, icon: 'ti ti-device-mobile' }));
</script>

<style lang="scss" module>
.footer {
	-webkit-backdrop-filter: var(--MI-blur, blur(15px));
	backdrop-filter: var(--MI-blur, blur(15px));
}
</style>
