#!/usr/bin/env bash
# SPDX-FileCopyrightText: syuilo and misskey-project
# SPDX-License-Identifier: AGPL-3.0-only

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
shellcheck -x scripts/deploy.sh scripts/backup.sh scripts/check-deploy.sh
python3 scripts/deploy.test.py -v
python3 scripts/backup.test.py -v
