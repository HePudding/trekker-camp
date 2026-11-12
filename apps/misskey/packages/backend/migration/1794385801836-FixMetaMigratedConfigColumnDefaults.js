/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 既存レコードの値は変更せず、カラムの DEFAULT をエンティティに揃える。
 * 旅人营地の既存マイグレーションでも DEFAULT はすべて true なので、down でもその値を維持する。
 */
export class FixMetaMigratedConfigColumnDefaults1794385801836 {
    name = 'FixMetaMigratedConfigColumnDefaults1794385801836'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" ALTER COLUMN "proxyRemoteFiles" SET DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "meta" ALTER COLUMN "signToActivityPubGet" SET DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "meta" ALTER COLUMN "allowExternalApRedirect" SET DEFAULT true`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" ALTER COLUMN "allowExternalApRedirect" SET DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "meta" ALTER COLUMN "signToActivityPubGet" SET DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "meta" ALTER COLUMN "proxyRemoteFiles" SET DEFAULT true`);
    }
}
