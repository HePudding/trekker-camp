<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="$i && !$i.emailVerified && ($i.phoneNumber || instance.enablePhoneVerification)" :class="$style.root" role="status">
	<i class="ti ti-mail" aria-hidden="true"></i>
	<span>{{ i18n.ts._registration.bindEmailBanner }}</span>
	<MkA to="/settings/email" class="_link">{{ i18n.ts._registration.bindEmail }}</MkA>
</div>
</template>

<script setup lang="ts">
import { $i } from '@/i.js';
import { instance } from '@/instance.js';
import { i18n } from '@/i18n.js';
</script>

<style lang="scss" module>
.root {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	flex-shrink: 0;
	gap: var(--MI-marginHalf);
	padding: var(--MI-marginHalf) var(--MI-margin);
	background: var(--MI_THEME-infoWarnBg);
	color: var(--MI_THEME-infoWarnFg);
	font-size: 0.9em;
}
</style>
