/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { defaultLanguage } from 'i18n/const';
import { lang } from '@@/js/config.js';

export const versatileLang = lang;

let _dateTimeFormat: Intl.DateTimeFormat;
try {
	_dateTimeFormat = new Intl.DateTimeFormat(versatileLang, {
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric',
	});
} catch (err) {
	console.warn(err);
	if (_DEV_) console.log(`[Intl] Fallback to ${defaultLanguage}`);

	_dateTimeFormat = new Intl.DateTimeFormat(defaultLanguage, {
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric',
	});
}
export const dateTimeFormat = _dateTimeFormat;

export const timeZone = dateTimeFormat.resolvedOptions().timeZone;

export const hemisphere = /^(australia|pacific|antarctica|indian)\//i.test(timeZone) ? 'S' : 'N';

let _numberFormat: Intl.NumberFormat;
try {
	_numberFormat = new Intl.NumberFormat(versatileLang);
} catch (err) {
	console.warn(err);
	if (_DEV_) console.log(`[Intl] Fallback to ${defaultLanguage}`);

	_numberFormat = new Intl.NumberFormat(defaultLanguage);
}
export const numberFormat = _numberFormat;
