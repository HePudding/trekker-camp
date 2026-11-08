#!/usr/bin/env bash
# SPDX-FileCopyrightText: syuilo and misskey-project
# SPDX-License-Identifier: AGPL-3.0-only

# Loaded by deploy.sh after resolving the deployment directory and taking its lock.
# Paths and the error stage are shared with deploy.sh.
# shellcheck disable=SC2034,SC2154

r2_restic() {
	local credentials_dir=${r2_credentials_dir:-$r2_dir}
	local cache_mount=type=volume,source=trekker-camp-backup-cache,target=/cache
	if [[ $data_dir != "$camp_dir" ]]; then
		install -d -m 0700 "$data_dir/restic-cache"
		cache_mount="type=bind,source=$data_dir/restic-cache,target=/cache"
	fi
	docker run --rm \
		--env-file "$credentials_dir/repository.env" \
		--env AWS_DEFAULT_REGION=auto \
		--env RESTIC_PASSWORD_FILE=/run/secrets/backup-password \
		--env RESTIC_CACHE_DIR=/cache \
		--mount "type=bind,source=$credentials_dir/password,target=/run/secrets/backup-password,readonly" \
		--mount "type=bind,source=$r2_payload,target=/backup,readonly" \
		--mount "$cache_mount" \
		restic/restic:0.19.1 "$@"
}

r2_read() {
	local variable=$1 label=$2 secret=${3:-false}
	if [[ -z ${!variable} && -t 0 ]]; then
		if [[ $secret == true ]]; then
			read -r -s -p "$label：" "${variable?}"
			printf '\n'
		else
			read -r -p "$label：" "${variable?}"
		fi
	fi
	[[ -n ${!variable} ]] || fail "缺少 $label。"
}

write_backup_units() {
	local unit_directory=$1 unit_path=${camp_dir:?}
	# systemd quoted arguments have their own escaping rules.
	unit_path=${unit_path//\\/\\\\}
	unit_path=${unit_path//\"/\\\"}
	unit_path=${unit_path//%/%%}
	unit_path=${unit_path//\$/\$\$}
	cat > "$unit_directory/trekker-camp-backup.service" <<EOF
[Unit]
Description=Trekker Camp encrypted backup to Cloudflare R2
Wants=network-online.target
After=network-online.target docker.service
Requires=docker.service
StartLimitIntervalSec=6h
StartLimitBurst=3

[Service]
Type=oneshot
ExecStart=/usr/local/bin/camp backup --dir "$unit_path"
TimeoutStartSec=infinity
Restart=on-failure
RestartSec=15min
UMask=0077
EOF
	cat > "$unit_directory/trekker-camp-backup.timer" <<'EOF'
[Unit]
Description=Daily Trekker Camp backup at 04:00 Asia/Shanghai

[Timer]
OnCalendar=*-*-* 04:00:00 Asia/Shanghai
Persistent=true
Unit=trekker-camp-backup.service

[Install]
WantedBy=timers.target
EOF
	chmod 0644 "$unit_directory/trekker-camp-backup.service" "$unit_directory/trekker-camp-backup.timer"
}

r2_backup() (
	umask 077
	local resume_web=0 status running_web
	local credentials_dir=${r2_credentials_dir:-$r2_dir}
	[[ -s $credentials_dir/repository.env && -s $credentials_dir/password ]] || fail '请先运行 camp r2-bind 绑定 R2。'
	install -d -m 0700 "$r2_dir/runs"
	backup_dir=$(mktemp -d "$r2_dir/runs/$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
	trap '
		status=$?
		if ((resume_web)); then
			compose start --wait --wait-timeout 180 web || status=1
		fi
		if ((status)); then printf "R2 备份失败，本地副本保留：%s\n" "$backup_dir" >&2; fi
		exit "$status"
	' EXIT
	trap 'exit 130' INT
	trap 'exit 143' TERM
	stage='采集 R2 备份'
	running_web=$(compose ps --status running --status restarting --services web)
	if [[ $running_web == web ]]; then
		resume_web=1
		compose stop web
	fi
	# Uploaded files are immutable after creation. Hard links preserve deleted files
	# while keeping the capture short; the default deployment uses one filesystem.
	cp -al "$data_dir/files" "$backup_dir/files"
	cp -al "$assets_dir/public" "$backup_dir/assets"
	cp -a "$config_dir" "$backup_dir/config"
	cp "$camp_dir/compose.yml" "$camp_dir/compose.assets.yml" "$backup_dir/"
	git -C "$camp_dir" rev-parse HEAD > "$backup_dir/code-revision"
	# shellcheck disable=SC2016
	compose exec -T db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup_dir/database.dump"
	[[ -s $backup_dir/database.dump ]] || fail '数据库备份为空，停止上传。'
	stage='恢复应用'
	if ((resume_web)); then
		compose start --wait --wait-timeout 180 web
		resume_web=0
	fi
	stage='加密上传到 R2'
	r2_payload=$backup_dir
	r2_restic backup --host trekker-camp --tag daily /backup
	# Only remove this invocation's generated staging directory after remote success.
	[[ $backup_dir == "$r2_dir/runs/"* ]] || fail '备份临时目录位置异常。'
	rm -rf -- "$backup_dir"
	date -Iseconds > "$r2_dir/last-success"
	log 'R2 备份完成，上传内容已加密。'
)

r2_bind() (
	umask 077
	local r2_endpoint=${R2_ENDPOINT:-} r2_bucket=${R2_BUCKET:-}
	local r2_access_key=${R2_ACCESS_KEY_ID:-} r2_secret_key=${R2_SECRET_ACCESS_KEY:-}
	local r2_password=${R2_BACKUP_PASSWORD:-} confirmation code=0
	local candidate r2_credentials_dir
	unset R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BACKUP_PASSWORD
	if [[ ! -f /usr/share/zoneinfo/Asia/Shanghai ]]; then
		apt-get update
		DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends tzdata
	fi
	r2_read r2_endpoint 'R2 S3 Endpoint（https://账户ID.r2.cloudflarestorage.com）'
	r2_read r2_bucket 'R2 私有备份 Bucket'
	r2_read r2_access_key 'R2 Access Key ID' true
	r2_read r2_secret_key 'R2 Secret Access Key' true
	if [[ -z $r2_password && -t 0 ]]; then
		r2_read r2_password '备份加密密码（请另行保存，恢复时需要）' true
		read -r -s -p '再次输入备份加密密码：' confirmation
		printf '\n'
		[[ $r2_password == "$confirmation" ]] || fail '两次加密密码不一致。'
	fi
	[[ -n $r2_password && $r2_password != *$'\n'* && $r2_password != *$'\r'* ]] || fail '请通过 R2_BACKUP_PASSWORD 提供单行、非空的备份加密密码。'
	r2_endpoint=${r2_endpoint%/}
	[[ $r2_endpoint =~ ^https://[a-f0-9]{32}(\.(eu|us|fedramp))?\.r2\.cloudflarestorage\.com$ ]] || fail 'R2 Endpoint 格式无效。'
	[[ $r2_bucket =~ ^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$ ]] || fail 'R2 Bucket 名称格式无效。'
	[[ $r2_access_key =~ ^[a-zA-Z0-9_/-]+$ && $r2_secret_key =~ ^[a-zA-Z0-9_+/=-]+$ ]] || fail 'R2 S3 凭据格式无效。'
	install -d -m 0700 "$backup_root"
	candidate=$(mktemp -d "$backup_root/.r2-bind-XXXXXX")
	trap 'rm -f -- "$candidate/repository.env" "$candidate/password"; rmdir -- "$candidate/empty" "$candidate"' EXIT
	mkdir "$candidate/empty"
	printf 'RESTIC_REPOSITORY=s3:%s/%s/trekker-camp\nAWS_ACCESS_KEY_ID=%s\nAWS_SECRET_ACCESS_KEY=%s\n' \
		"$r2_endpoint" "$r2_bucket" "$r2_access_key" "$r2_secret_key" > "$candidate/repository.env"
	printf '%s\n' "$r2_password" > "$candidate/password"
	r2_credentials_dir=$candidate
	r2_payload=$candidate/empty
	stage='验证 R2 访问和加密密码'
	r2_restic cat config >/dev/null || code=$?
	case "$code" in
		0) ;;
		10) r2_restic init ;;
		*) return "$code" ;;
	esac
	install -d -m 0700 "$r2_dir"
	stage='执行首次 R2 备份'
	r2_backup
	install -m 0600 "$candidate/repository.env" "$r2_dir/repository.env"
	install -m 0600 "$candidate/password" "$r2_dir/password"
	stage='安装每日 R2 备份任务'
	write_backup_units /etc/systemd/system
	systemctl daemon-reload
	systemctl enable --now trekker-camp-backup.timer
	log 'R2 已绑定，每天北京时间 04:00 自动备份；请另行保存备份加密密码。'
)

r2_backup_status() {
	if [[ ! -f $r2_dir/repository.env ]]; then
		printf '尚未绑定 R2，请运行 camp r2-bind。\n'
		return
	fi
	if [[ -f $r2_dir/last-success ]]; then
		printf '最近一次成功备份：%s\n' "$(< "$r2_dir/last-success")"
	fi
	systemctl list-timers --all --no-pager trekker-camp-backup.timer
	systemctl show trekker-camp-backup.service --property=Result --property=ExecMainStatus
}
