/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as mfm from 'mfm-js';

const visualEffects = new Set([
	'x2', 'x3', 'x4', 'scale', 'position',
	'tada', 'jelly', 'twitch', 'shake', 'spin', 'jump', 'bounce', 'rainbow', 'sparkle',
]);

export function hasVisualEffects(text: string): boolean {
	return mfm.extract(mfm.parse(text), node => node.type === 'fn' && visualEffects.has(node.props.name)).length > 0;
}
