/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { entities } from 'misskey-js';

const WINDOW_MS = 60_000;
const NOTES_THRESHOLD = 20;

/** Records live arrivals only; pagination and restored history must not call this tracker. */
export class TimelineAchievementTracker {
	private arrivals = new Map<string, number>();

	record(note: Pick<entities.Note, 'id' | 'createdAt'>, now = Date.now()): boolean {
		const cutoff = now - WINDOW_MS;
		for (const [id, receivedAt] of this.arrivals) {
			if (receivedAt < cutoff) this.arrivals.delete(id);
		}

		// Ignore old notes replayed by a stream, as well as duplicate deliveries.
		const createdAt = Date.parse(note.createdAt);
		if (!Number.isFinite(createdAt) || createdAt < cutoff || this.arrivals.has(note.id)) return false;

		this.arrivals.set(note.id, now);
		return this.arrivals.size >= NOTES_THRESHOLD;
	}

	reset(): void {
		this.arrivals.clear();
	}
}
