/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { IsNull, Raw } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { RegistrationTicketsRepository, UserProfilesRepository, UsersRepository } from '@/models/_.js';
import { MetaService } from '@/core/MetaService.js';
import { VerificationCodeService, VerificationError, normalizePhone, normalizeEmail } from '@/core/VerificationCodeService.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { verificationErrors, handleVerificationError } from '@/server/api/verification-errors.js';

export const meta = {
	tags: ['account'],
	requireCredential: false,
	errors: verificationErrors,
	res: {
		type: 'object', optional: false, nullable: false,
		properties: {
			challengeId: { type: 'string', optional: false, nullable: false },
			retryAfter: { type: 'integer', optional: false, nullable: false },
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		channel: { type: 'string', enum: ['sms', 'email'] },
		purpose: { type: 'string', enum: ['signup', 'phone-old', 'phone-new', 'password-reset'] },
		address: { type: 'string', maxLength: 128, default: '' },
		username: { type: 'string', maxLength: 128 },
		invitationCode: { type: 'string', maxLength: 1024 },
		'hcaptcha-response': { type: 'string', nullable: true },
		'm-captcha-response': { type: 'string', nullable: true },
		'g-recaptcha-response': { type: 'string', nullable: true },
		'turnstile-response': { type: 'string', nullable: true },
		'testcaptcha-response': { type: 'string', nullable: true },
	},
	required: ['channel', 'purpose'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.userProfilesRepository) private profiles: UserProfilesRepository,
		@Inject(DI.usersRepository) private users: UsersRepository,
		@Inject(DI.registrationTicketsRepository) private tickets: RegistrationTicketsRepository,
		private metaService: MetaService,
		private codes: VerificationCodeService,
	) {
		super(meta, paramDef, async (ps, me, _token, _file, _cleanup, ip) => {
			try {
				if (_token !== null) throw new VerificationError('AUTHENTICATION_FAILED');
				if (ps.channel === 'sms') await this.codes.ensureSmsEnabled();
				if (ps.channel === 'sms' || ps.purpose === 'signup') await this.codes.verifyCaptcha(ps);
				if (ps.channel === 'email' && ps.purpose !== 'signup' && (ps.purpose !== 'password-reset' || !ps.username)) throw new VerificationError('INVALID_EMAIL');
				const changing = ps.purpose === 'phone-old' || ps.purpose === 'phone-new';
				if (changing && !me) throw new VerificationError('AUTHENTICATION_FAILED');
				const current = changing ? await this.profiles.findOneByOrFail({ userId: me!.id }) : null;
				const address = ps.purpose === 'phone-old'
					? current?.phoneNumber ?? ''
					: ps.channel === 'sms' ? normalizePhone(ps.address) : normalizeEmail(ps.address);
				if (!address) throw new VerificationError('INVALID_PHONE');
				if (ps.purpose === 'signup') await this.codes.validateSignup(ps.channel, address);
				if (ps.channel === 'sms' || ps.purpose === 'signup') await this.codes.limit(address, ip ?? 'unknown', me?.id, ps.channel);
				const instance = await this.metaService.fetch();
				const settings = await this.codes.settings();
				if (ps.channel === 'sms' ? !settings.accessKeyId || !settings.accessKeySecret || !settings.signName : !instance.enableEmail) {
					throw new VerificationError('VERIFICATION_UNAVAILABLE');
				}
				if (ps.purpose === 'signup' && instance.disableRegistration) {
					const ticket = ps.invitationCode ? await this.tickets.findOneBy({ code: ps.invitationCode }) : null;
					if (!ticket || ticket.usedAt || ticket.usedById || (ticket.expiresAt && ticket.expiresAt <= new Date())) throw new VerificationError('REGISTRATION_CLOSED');
				}
				let userId: string | null = changing ? me!.id : null;
				let deliver = true;
				if (ps.purpose === 'password-reset') {
					const matches = await this.profiles.find({
						where: ps.channel === 'sms' ? { phoneNumber: address } : {
							email: Raw(alias => `LOWER(${alias}) = :email`, { email: address }), emailVerified: true,
						},
						take: 2,
					});
					const user = matches.length === 1 ? await this.users.findOneBy({
						id: matches[0].userId, host: IsNull(), isSuspended: false,
						...(ps.channel === 'email' ? { usernameLower: ps.username!.trim().toLowerCase() } : {}),
					}) : null;
					userId = user?.id ?? null;
					deliver = user != null;
				} else if (ps.channel === 'sms' && (ps.purpose === 'signup' || ps.purpose === 'phone-new')) {
					deliver = !await this.profiles.existsBy({ phoneNumber: address });
				}
				// Uniform responses for unbound, suspended and already registered destinations.
				if (!deliver) return { challengeId: randomUUID(), retryAfter: ps.channel === 'sms' ? settings.interval : 0 };
				return await this.codes.send(ps.channel, ps.purpose, address, userId, Boolean(current?.phoneNumber));
			} catch (err) {
				handleVerificationError(err);
			}
		});
	}
}

