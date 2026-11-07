/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Config } from '@/config.js';

type CampEmoji = {
	name: string;
	file: string;
	category: string;
	aliases: string[];
	license: string;
};

/** Read separately distributed artwork only at runtime, before registering any emoji. */
export async function readCampEmojis(config: Pick<Config, 'rootDir' | 'url'>) {
	const directory = join(config.rootDir, 'packages/frontend/assets/camp/emojis/stella-sora');
	let json: string;
	try {
		json = await readFile(join(directory, 'manifest.json'), 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw error;
	}

	const manifest: unknown = JSON.parse(json);
	if (!Array.isArray(manifest)) throw new Error('Invalid camp emoji manifest');
	const names = new Set<string>();
	const emojis: CampEmoji[] = [];
	for (const entry of manifest) {
		if (entry == null || typeof entry !== 'object'
			|| typeof entry.name !== 'string' || !/^stella_sora_\d+$/.test(entry.name)
			|| names.has(entry.name)
			|| (entry.file !== `${entry.name}.png` && entry.file !== `${entry.name}.gif`)
			|| typeof entry.category !== 'string' || entry.category.length > 128
			|| !Array.isArray(entry.aliases) || !entry.aliases.every((alias: unknown) => typeof alias === 'string' && alias.length <= 128)
			|| typeof entry.license !== 'string' || entry.license.length > 1024) {
			throw new Error('Invalid camp emoji manifest entry');
		}
		const file = await stat(join(directory, entry.file));
		if (!file.isFile() || file.size === 0) throw new Error(`Missing camp emoji image: ${entry.file}`);
		names.add(entry.name);
		emojis.push(entry);
	}

	return emojis.map(emoji => {
		const url = new URL(`/client-assets/camp/emojis/stella-sora/${emoji.file}`, config.url).href;
		return {
			name: emoji.name,
			category: emoji.category,
			aliases: emoji.aliases,
			license: emoji.license,
			originalUrl: url,
			publicUrl: url,
			type: emoji.file.endsWith('.gif') ? 'image/gif' : 'image/png',
			host: null,
			localOnly: true,
			isSensitive: false,
			roleIdsThatCanBeUsedThisEmojiAsReaction: [],
		};
	});
}
