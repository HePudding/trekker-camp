<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="enabled">
	<MkCaptcha v-if="instance.enableHcaptcha" :key="revision" v-model="tokens['hcaptcha-response']" provider="hcaptcha" :sitekey="instance.hcaptchaSiteKey"/>
	<MkCaptcha v-if="instance.enableMcaptcha" :key="revision" v-model="tokens['m-captcha-response']" provider="mcaptcha" :sitekey="instance.mcaptchaSiteKey" :instanceUrl="instance.mcaptchaInstanceUrl"/>
	<MkCaptcha v-if="instance.enableRecaptcha" :key="revision" v-model="tokens['g-recaptcha-response']" provider="recaptcha" :sitekey="instance.recaptchaSiteKey"/>
	<MkCaptcha v-if="instance.enableTurnstile" :key="revision" v-model="tokens['turnstile-response']" provider="turnstile" :sitekey="instance.turnstileSiteKey"/>
	<MkCaptcha v-if="instance.enableCap" :key="revision" v-model="tokens['cap-token']" provider="cap" :sitekey="null"/>
	<MkCaptcha v-if="instance.enableTestcaptcha" :key="revision" v-model="tokens['testcaptcha-response']" provider="testcaptcha" :sitekey="null"/>
</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type * as Misskey from 'misskey-js';
import MkCaptcha from '@/components/MkCaptcha.vue';
import { instance } from '@/instance.js';

const tokens = ref<Pick<Misskey.entities.SignupRequest, 'hcaptcha-response' | 'm-captcha-response' | 'g-recaptcha-response' | 'turnstile-response' | 'testcaptcha-response' | 'cap-token'>>({});
const revision = ref(0);
const enabled = computed(() => instance.enableHcaptcha || instance.enableMcaptcha || instance.enableRecaptcha || instance.enableTurnstile || instance.enableTestcaptcha || instance.enableCap);
const ready = computed(() => (!instance.enableHcaptcha || tokens.value['hcaptcha-response'])
	&& (!instance.enableMcaptcha || tokens.value['m-captcha-response'])
	&& (!instance.enableRecaptcha || tokens.value['g-recaptcha-response'])
	&& (!instance.enableTurnstile || tokens.value['turnstile-response'])
	&& (!instance.enableCap || tokens.value['cap-token'])
	&& (!instance.enableTestcaptcha || tokens.value['testcaptcha-response']));

function reset() {
	tokens.value = {};
	revision.value++;
}

defineExpose({ tokens, ready, reset });
</script>

