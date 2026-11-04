/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { TimelineAchievementTracker } from '@/utility/achievement-timeline.js';

const start = Date.parse('2026-11-04T00:00:00Z');
const note = (id: number, createdAt = start) => ({ id: String(id), createdAt: new Date(createdAt).toISOString() });

describe('timeline speed achievement', () => {
	test('requires twenty distinct live arrivals within sixty seconds', () => {
		const tracker = new TimelineAchievementTracker();
		for (let i = 0; i < 19; i++) {
			expect(tracker.record(note(i, start + i * 1000), start + i * 1000)).toBe(false);
		}
		expect(tracker.record(note(19, start + 60_000), start + 60_000)).toBe(true);
	});

	test('expires arrivals older than sixty seconds in a rolling window', () => {
		const tracker = new TimelineAchievementTracker();
		for (let i = 0; i < 19; i++) tracker.record(note(i, start + i * 1000), start + i * 1000);
		expect(tracker.record(note(19, start + 60_001), start + 60_001)).toBe(false);
		expect(tracker.record(note(20, start + 60_002), start + 60_002)).toBe(true);
	});

	test('duplicate deliveries do not add notes or extend their arrival time', () => {
		const tracker = new TimelineAchievementTracker();
		for (let i = 0; i < 19; i++) tracker.record(note(i, start + i * 1000), start + i * 1000);
		for (let i = 0; i < 30; i++) expect(tracker.record(note(0), start + 30_000)).toBe(false);
		expect(tracker.record(note(19, start + 60_001), start + 60_001)).toBe(false);
		expect(tracker.record(note(20, start + 60_002), start + 60_002)).toBe(true);
	});

	test('old replayed notes do not count even when first received now', () => {
		const tracker = new TimelineAchievementTracker();
		for (let i = 0; i < 30; i++) expect(tracker.record(note(i, start - 60_001), start)).toBe(false);
		for (let i = 30; i < 49; i++) expect(tracker.record(note(i), start)).toBe(false);
		expect(tracker.record(note(49), start)).toBe(true);
	});

	test('reset discards activity from a hidden or disconnected timeline', () => {
		const tracker = new TimelineAchievementTracker();
		for (let i = 0; i < 19; i++) tracker.record(note(i), start);
		tracker.reset();
		for (let i = 19; i < 38; i++) expect(tracker.record(note(i), start)).toBe(false);
		expect(tracker.record(note(38), start)).toBe(true);
	});
});
