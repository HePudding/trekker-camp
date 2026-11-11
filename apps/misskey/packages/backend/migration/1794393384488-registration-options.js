/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class RegistrationOptions1794393384488 {
    name = 'RegistrationOptions1794393384488'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" ADD "enablePhoneVerification" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "meta" ADD "allowEmailSignup" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "meta" ADD "restrictSignupEmailDomains" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "meta" ADD "requireNumericQqEmail" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`UPDATE "meta" SET "enablePhoneVerification" = true WHERE COALESCE("verificationSettings"->>'accessKeyId', '') <> '' AND COALESCE("verificationSettings"->>'accessKeySecret', '') <> '' AND COALESCE("verificationSettings"->>'signName', '') <> ''`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "requireNumericQqEmail"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "restrictSignupEmailDomains"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "allowEmailSignup"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "enablePhoneVerification"`);
    }
}
