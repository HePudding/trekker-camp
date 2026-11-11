/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ref } from 'vue';
import type { StoryObj } from '@storybook/vue3';
import MkCaptchaGate from './MkCaptchaGate.vue';

export const Default = {
	render(args) {
		return {
			components: { MkCaptchaGate },
			setup() {
				const proof = ref({ challengeId: '', code: '' });
				return { args, proof };
			},
			template: '<div style="width: 360px"><MkCaptchaGate v-bind="args"/></div>',
		};
	},
	args: {},
	parameters: { layout: 'centered' },
} satisfies StoryObj<typeof MkCaptchaGate>;

