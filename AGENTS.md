# 旅人营地 (trekker-camp) – AI Agent Guide

本仓库是 [misskey-dev/misskey](https://github.com/misskey-dev/misskey) 的 fork，面向 **星塔旅人（Arknights: Endfield）简中第三方社区**。默认开发分支是 **`master`**。

本文件给 AI 编码助手 (Claude Code / OpenAI Codex / GitHub Copilot / 小筑 等) 用：硬规矩 + 最低检查。读取路径与上游相同：

- **Claude Code**: 根目录 `CLAUDE.md` → `@AGENTS.md`；细节在 `.claude/skills/`
- **OpenAI Codex**: 直接读本文件；`.agents/skills/` 指向 `.claude/skills/`
- **GitHub Copilot**: `.github/copilot-instructions.md`

人类向导见 [CONTRIBUTING.md](CONTRIBUTING.md)（上游流程）和 [SETUP.zh-CN.md](SETUP.zh-CN.md)（本仓搭环境）。

## 旅人营地覆盖规则（优先于下文上游条文）

1. **产品文案源语言是简体中文 `locales/zh-CN.yml`**
   - AI / 开发者可以、也应当编辑 `locales/zh-CN.yml`
   - 仍禁止手改其它 locale YAML（`en-US.yml`、`ja-JP.yml`、`zh-TW.yml` 等），避免和上游/Crowdin 同步互相覆盖
   - 若需从上游合入文案：先合 `ja-JP.yml`（上游源），再把旅人营地需要的键落到 `zh-CN.yml`
   - frontend i18n 新增键：写入 `zh-CN.yml`，并保证运行时默认语言走简中（实例配置 / 默认 locale）
2. **Federation / ActivityPub / 联邦相关默认不做**
   - 除非主人明确要求，不要改 AP payload、federation 测试、远程互动相关代码
   - 上游 CONTRIBUTING 里 ActivityPub 扩展章节对本仓非目标
3. **不要主动扩大产品范围**
   - 只做主人点名的功能与「营地 / 旅人」向 UX、文案、主题改动
4. **破坏性操作需确认**
   - 不部署生产、不 force-push 共享分支、不删数据、不关 Issue/不代发评论，除非主人明确说
5. **出货分支**
   - PR / 直接推送默认对着 `master`（本仓不以 `develop` 为日常开发主线）

下文保留上游 Misskey 的通用禁止项与检查清单；与本节冲突时，**以本节为准**。

---

## 絶対にやってはいけない事

違反すると CI 失敗 / 本番事故 / 共有環境破壊 になる。順守すること。

### コード・データ関連

1. **SPDX ヘッダー欠落のまま AGPL 管轄ディレクトリへ新規ファイルを追加しない**
   - 対象: 新規 `.ts` / `.js` / `.cjs` / `.mjs` / `.vue` / `.scss` / `.html` ファイル
   - 対象と判定は [scripts/check-spdx.mjs](scripts/check-spdx.mjs) が一元管理する
   - `node scripts/check-spdx.mjs` を 1 回実行し、欠落は `--fix` で補う。
     `SPDX: OK` なら追加の目視確認はしない
   - `packages/misskey-js` は MIT ライセンスのサブパッケージなので、この AGPL ヘッダーを一律に付けない (サブパッケージ固有の `package.json` / `LICENSE` / 既存ファイルのヘッダーに従う)

2. **`locales/zh-CN.yml` と（上游同期用の）`locales/ja-JP.yml` 以外の locale YAML を手動編集しない**
   - 旅人营地: 产品文案のソースは **`zh-CN.yml`**。AI はこれを編集してよい
   - `ja-JP.yml` は上游 Misskey 同期の入口として残す。Crowdin 運用は本 fork では既定オフ想定
   - それ以外 (`en-US.yml` / `zh-TW.yml` など) は手編集禁止（同期や差分ノイズの原因）
   - 根拠（上游）: [locales/README.md](locales/README.md)・[crowdin.yml](crowdin.yml)。本仓覆盖见上方「旅人营地覆盖规则」

3. **マージ済 migration ファイルを編集しない**
   - 対象: `packages/backend/migration/{unixMs}-{name}.js` のうち、既に `develop` / `master` にマージされたもの
   - 本番環境で履歴改変が起きると深刻なデータ不整合を引き起こす
   - スキーマ変更が必要な場合は **新しいタイムスタンプで新規ファイル** を作成する (`node -e "console.log(Date.now())"` でタイムスタンプ取得)
   - 新規 migration は `up()` と `down()` の両方を実装し、`pnpm --filter backend check-migrations` を通すこと (TypeORM schema builder で pending DDL を検出)

### Git / リポジトリ操作

4. **`git push --force` / `--force-with-lease` を `main` / `develop` / `master` にしない** (他人の作業を消す可能性)
5. **`git commit --no-verify` で hook をスキップしない**
6. **マージ済 / プッシュ済コミットを `git commit --amend` で書き換えない** (履歴の整合性が壊れる)
7. **他人のブランチを `git reset --hard` / `git branch -D` で破壊しない**
8. **`git config` をユーザーに無断で書き換えない** (特に `user.name` / `user.email` / `commit.gpgsign`)

### Issue / PR / 外部送信

9. **ユーザーの明示指示なしに PR を merge / close / force-push しない**
10. **ユーザーの明示指示なしに external service (GitHub comments / Slack / メール 等) へ送信しない**
11. **secrets / 認証情報をリポジトリにコミットしない** (`.config/*.yml` の本番値、`.env` ファイル、API token、private key 等)
12. **脆弱性報告を通常の Issue / PR 経由で行わない** (脆弱性報告を行う場合のルールは `creating-issues-and-prs` スキルを参照すること)

### スキル呼び出し

上流スキルの実行・事前知識・memory の内容に関わらず免除されない。

13. **`working-on-backend` スキルを参照せずに `packages/backend/` 配下のファイルを編集・追加しない**
14. **`working-on-frontend` スキルを参照せずに `packages/frontend/` 配下のファイルを編集・追加しない**
    - スキル本文が「`ja-JP.yml` のみ編集可」と書いていても、**本仓では `zh-CN.yml` をソースとする**（本节覆盖规则优先）
15. **`shipping-misskey-change` スキルを参照せずに commit / PR 作成 / 作業をユーザーに返さない**
16. **`creating-issues-and-prs` スキルを参照せずに Issue / PR を起票しない** (脆弱性報告のルールも含む)

---

## 変更を出す前の最低チェック

各エージェントは [shipping-misskey-change スキル](.claude/skills/shipping-misskey-change/SKILL.md) を参照すること。スキルが利用できない環境でも、以下のチェックは必ず実施すること:

1. **lint / test**: ESLint 対象の変更ファイルへ package root から `eslint --quiet` を最後に 1 回実行し、実装変更には最も近い test を選んで実行する。
   package / repo 全体 lint と広域 test は任意
2. **backend API 変更時**: `pnpm build-misskey-js-with-types` を実行し `packages/misskey-js/src/autogen/` の差分も commit に含めた
3. **entity / migration 変更時**: `pnpm --filter backend check-migrations` が pending DDL 0 件で通る / 新規 migration は `up()` と `down()` 両方実装済
4. **SPDX**: `node scripts/check-spdx.mjs` が `SPDX: OK` を返すことを確認する
5. **locale safety**: 変更集合に出てよい locale YAML は `locales/zh-CN.yml` と（上游同期時のみ）`locales/ja-JP.yml`。それ以外の locale YAML 差分が混ざっていないこと
6. **[CHANGELOG](.claude/skills/shipping-misskey-change/references/tasks/changelog-update.md)**: ユーザーが明示しない限り編集しない。
   ユーザー影響がある変更では引き継ぎに候補を 1 行だけ示す

### Validation commands

各チェックで使う pnpm コマンド一覧。状況に応じて最も近いコマンドから検証する。

| 用途 | コマンド |
| --- | --- |
| 全体 lint (任意) | `pnpm lint` |
| Backend unit test | `pnpm --filter backend test` |
| Backend e2e test | `pnpm --filter backend test:e2e` |
| Backend federation test | `pnpm --filter backend test:fed` |
| Frontend unit test | `pnpm --filter frontend test` |
| Migration 差分検査 (pending DDL) | `pnpm --filter backend check-migrations` |
| `misskey-js` 再生成 (API 変更後必須) | `pnpm build-misskey-js-with-types` |
| 全体ビルド | `pnpm build` |
| 開発サーバー (backend + frontend watch) | `pnpm dev` |

**注意:** backend テスト (`test` / `test:e2e` / `test:fed`) 実行前に `.config/test.yml` が必要 (`ncp .github/misskey/test.yml .config/test.yml` または `cp .github/misskey/test.yml .config/test.yml` で作成)。
