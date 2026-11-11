/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ref } from 'vue';
import type { StoryObj } from '@storybook/vue3';
import MkVerificationCode from './MkVerificationCode.vue';

export const Default = {
	render(args) {
		return {
			components: { MkVerificationCode },
			setup() {
				const proof = ref({ challengeId: '', code: '' });
				return { args, proof };
			},
			template: '<div style="width: 360px"><MkVerificationCode v-bind="args" v-model="proof"/></div>',
		};
	},
	args: { "modelValue": { "challengeId": "", "code": "" }, "channel": "sms", "purpose": "signup", "address": "13800138000" },
	parameters: { layout: 'centered' },
} satisfies StoryObj<typeof MkVerificationCode>;

