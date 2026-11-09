#!/usr/bin/env bash
# SPDX-FileCopyrightText: syuilo and misskey-project
# SPDX-License-Identifier: AGPL-3.0-only

cli_entry=$(realpath -s -- "${BASH_SOURCE[0]}")
cli_dir=$(dirname "$(realpath -- "$cli_entry")")
default_site_url=https://camp.stellasora.cafe

usage() {
	cat <<'HELP'
旅人营地 VPS 部署（Ubuntu 22.04 / 24.04 / 26.04 LTS，amd64 / arm64）

  camp                         # 打开交互菜单
  camp tui --dir /opt/trekker-camp
  sudo bash scripts/deploy.sh install --url https://camp.example.com
  sudo camp update
  sudo camp self-update
  camp version
  sudo camp status
  sudo camp logs
  sudo camp start              # 启动整套站点并检查健康状态
  sudo camp stop               # 停止整套站点，保留容器和数据
  sudo camp restart            # 重启整套站点并检查健康状态
  sudo camp autostart on       # 开启开机自启
  sudo camp autostart off      # 关闭开机自启，保持当前运行状态
  sudo camp autostart          # 查看开机自启状态
  sudo camp r2-bind
  sudo camp backup
  sudo camp backup-status

选项：
  --dir PATH   覆盖本次操作的代码目录；默认使用已记录目录，首次为 /opt/trekker-camp
  --data-dir PATH  首次安装的数据目录，默认与部署目录相同；后续自动读取
  --url URL    首次部署的 HTTPS 域名；Cloudflare DNS 指向 VPS，开放 TCP 80/443
  -h, --help   显示帮助

终端中直接运行 camp 使用方向键 / 回车或数字选择；非终端中不带命令时显示帮助。
菜单按需调用 sudo，首次安装会询问域名和存储目录，子命令用法保持不变。
首次安装默认站点为 https://camp.stellasora.cafe；方括号内的默认值可直接回车采用。
认证依次读取 GH_TOKEN、GITHUB_TOKEN、数据目录 .config/github-token，或交互式隐藏输入。
使用仅授权私有素材仓库 Contents: Read-only 的细粒度 PAT，无需安装 gh。
访问素材成功后自动保存 PAT（仅 root 可读写），重开终端和 CLI 自更新后继续使用。
更换 PAT 时注入 GH_TOKEN，例如 sudo --preserve-env=GH_TOKEN camp update。
首次安装读取 CLOUDFLARE_API_TOKEN 或隐藏输入，用于 DNS 验证及自动续期证书。
Cloudflare SSL/TLS 模式使用 Full (strict)。
R2 绑定读取 R2_ENDPOINT、R2_BUCKET、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY、
R2_BACKUP_PASSWORD 或交互式输入；绑定成功后每天北京时间 04:00 加密备份。
HELP
}

fail() { printf '错误：%s\n' "$*" >&2; exit 1; }
log() { printf '\n==> %s\n' "$*"; }

cli_version() {
	if [[ -f $cli_dir/VERSION ]]; then
		printf 'camp CLI %s\n' "$(< "$cli_dir/VERSION")"
	else
		printf 'camp CLI 源码版 %s\n' "$(git -C "$cli_dir" rev-parse --short HEAD 2>/dev/null || printf unknown)"
	fi
}

tui_select() (
	local selected=0 previous key i step configured=false
	local commands=(status logs update backup backup-status r2-bind install self-update version start stop restart autostart-on autostart-off directory exit)
	local available=(0 0 0 0 0 0 1 1 1 0 0 0 0 0 1 1)
	local labels=(
		'1  查看站点状态和数据位置' '2  查看实时日志' '3  更新应用与素材（先备份）'
		'4  立即备份到 R2' '5  查看备份状态' '6  绑定 R2 每日备份'
		'7  首次安装' '8  更新 camp CLI' '9  查看 CLI 版本'
		'S  启动站点' 'T  停止站点' 'R  重启站点' 'A  开启开机自启' 'D  关闭开机自启'
		'C  切换代码目录' '0  退出'
	)
	if [[ -f $camp_dir/compose.yml ]]; then configured=true; else selected=6; fi
	# The entry point requires a TTY. Windows OpenSSH can still report TERM=dumb.
	# Keep each row on one line so long paths do not move the menu coordinates.
	trap 'printf "\033[0m\033[?7h\033[?25h\033[?1049l" >&2' EXIT
	printf '\033[?1049h\033[?25l\033[?7l\033[H\033[2J' >&2
	trap 'exit 130' INT
	trap 'exit 143' TERM
	printf '旅人营地 · VPS 管理\n\n代码目录：%s\n' "$camp_dir" >&2
	if $configured; then printf '状态：已有部署配置\n' >&2
	else printf '状态：尚未配置，按回车开始首次安装\n' >&2; fi
	for i in "${!labels[@]}"; do
		if ! $configured && ((! available[i])); then printf '   \033[2m%s（需先安装）\033[0m\n' "${labels[i]}" >&2
		elif ((i == selected)); then printf ' > \033[7m%s\033[0m\n' "${labels[i]}" >&2
		else printf '   %s\n' "${labels[i]}" >&2; fi
	done
	printf '\n↑ / ↓ 选择，回车执行；也可按菜单快捷键；Q 或 Esc 退出。\n更新和备份会短暂停站。\n' >&2
	while true; do
		previous=$selected
		IFS= read -rsn1 key || { printf exit; return; }
		case "$key" in
			$'\033')
				if ! IFS= read -rsn2 -t 0.2 key; then printf exit; return; fi
				case "$key" in
					'[A'|'OA') step=-1 ;;
					'[B'|'OB') step=1 ;;
					*) continue ;;
				esac
				while true; do
					selected=$(((selected + ${#commands[@]} + step) % ${#commands[@]}))
					if $configured || ((available[selected])); then break; fi
				done ;;
			'') printf '%s' "${commands[selected]}"; return ;;
			[1-9])
				if $configured || ((key >= 7)); then printf '%s' "${commands[key - 1]}"; return; fi ;;
			s|S|t|T|r|R|a|A|d|D)
				if $configured; then
					case "$key" in s|S) printf start ;; t|T) printf stop ;; r|R) printf restart ;; a|A) printf autostart-on ;; d|D) printf autostart-off ;; esac
					return
				fi ;;
			c|C) printf directory; return ;;
			0|q|Q) printf exit; return ;;
		esac
		if ((selected != previous)); then
			printf '\033[%d;1H\033[2K   %s\033[%d;1H\033[2K > \033[7m%s\033[0m' \
				"$((previous + 5))" "${labels[previous]}" "$((selected + 5))" "${labels[selected]}" >&2
		fi
	done
)

tui_run() {
	# A fresh Bash process preserves errexit inside deployment and backup commands.
	local runner=(bash "$cli_entry")
	if [[ $EUID != 0 && $1 != version ]]; then
		if ! command -v sudo >/dev/null; then printf '请以 root 运行 camp，或先安装 sudo。\n' >&2; return 1; fi
		runner=(sudo '--preserve-env=GH_TOKEN,CLOUDFLARE_API_TOKEN,R2_ENDPOINT,R2_BUCKET,R2_ACCESS_KEY_ID,R2_SECRET_ACCESS_KEY,R2_BACKUP_PASSWORD' -- "${runner[@]}")
	fi
	GH_TOKEN="$github_token" CLOUDFLARE_API_TOKEN="$cloudflare_token" "${runner[@]}" "$@"
}

tui_read_default() {
	local variable=$1 label=$2 fallback=$3 response
	read -r -e -p "$label [$fallback]：" response || return 1
	[[ $response != :q ]] || return 1
	printf -v "$variable" '%s' "${response:-$fallback}"
}

valid_site_url() {
	[[ $1 =~ ^https://[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,63}$ && $1 != *..* ]]
}

tui_install_wizard() {
	local previous_dir=$camp_dir candidate
	printf '\033[H\033[2J首次安装\n\n方括号内为默认值，直接回车采用；输入 :q 返回菜单。\n\n'
	while true; do
		candidate=$camp_dir
		tui_read_default candidate '代码目录' "$camp_dir" || return 1
		candidate=$(realpath -m -- "$candidate") || continue
		if (camp_dir=$candidate; resolve_storage); then camp_dir=$candidate; break; fi
	done
	if [[ -z $install_data || $install_data == "$previous_dir" ]]; then install_data=$camp_dir; fi
	while true; do
		candidate=$install_url
		tui_read_default candidate '站点地址' "$install_url" || return 1
		candidate=${candidate%/}
		if [[ $candidate != *://* ]]; then candidate=https://$candidate; fi
		if valid_site_url "$candidate"; then install_url=$candidate; break; fi
		printf '请输入 HTTPS 站点域名，不含端口或子路径；也可直接回车使用默认值。\n' >&2
	done
	while true; do
		candidate=$install_data
		tui_read_default candidate '数据目录' "$install_data" || return 1
		candidate=$(realpath -m -- "$candidate") || continue
		if (resolve_storage "$candidate"); then install_data=$candidate; break; fi
	done
	printf '\n站点地址：%s\n代码目录：%s\n数据目录：%s\n\n' "$install_url" "$camp_dir" "$install_data"
}

tui_wait() {
	local key
	printf '按回车返回菜单。'
	while IFS= read -rsn1 key; do
		case "$key" in
			'') printf '\n'; return ;;
			$'\033') IFS= read -rsn2 -t 0.2 key || true ;;
		esac
	done
	return 1
}

tui_menu() {
	local action value install_url=$default_site_url install_data='' result
	local args=()
	while true; do
		if ! action=$(tui_select); then return; fi
		case "$action" in
			exit) return ;;
			directory)
				if tui_read_default value '代码目录' "$camp_dir"; then
					value=$(realpath -m -- "$value")
					if [[ $install_data == "$camp_dir" ]]; then install_data=$value; fi
					camp_dir=$value
				fi
				continue ;;
			install)
				if ! tui_install_wizard; then continue; fi
				args=(install --dir "$camp_dir" --url "$install_url" --data-dir "$install_data") ;;
			autostart-on|autostart-off) args=(autostart "${action#autostart-}" --dir "$camp_dir") ;;
			*) args=("$action" --dir "$camp_dir") ;;
		esac
		# Keep the menu alive when Ctrl+C stops a log stream or another child command.
		trap ':' INT
		if tui_run "${args[@]}"; then
			printf '\n操作完成。\n'
		else
			result=$?
			printf '\n命令已结束（退出码 %s），请查看上方输出。\n' "$result"
		fi
		trap - INT
		tui_wait || return
	done
}

save_deployment_dir() {
	local directory=$1 record=$2
	printf '%s\n' "$directory" > "$record"
	chmod 0644 "$record"
}

install_cli() {
	local source_dir=$1 revision=$2 prefix=${3:-/usr/local} deployment_dir=${4:-} release
	[[ $revision =~ ^[a-f0-9]{40}$ ]] || fail 'CLI 版本需为 Git 提交号。'
	[[ -s $source_dir/deploy.sh && -s $source_dir/backup.sh ]] || fail 'CLI 更新文件不完整。'
	# Validate the complete bundle before changing the installed entry point.
	bash -n "$source_dir/deploy.sh"
	bash -n "$source_dir/backup.sh"
	install -d -m 0755 "$prefix/lib/trekker-camp" "$prefix/bin"
	release=$(mktemp -d "$prefix/lib/trekker-camp/$revision-XXXXXX")
	install -m 0755 "$source_dir/deploy.sh" "$release/deploy.sh"
	install -m 0644 "$source_dir/backup.sh" "$release/backup.sh"
	printf '%s\n' "$revision" > "$release/VERSION"
	chmod 0644 "$release/VERSION"
	chmod 0755 "$release"
	ln -s "$release" "$release.link"
	mv -Tf "$release.link" "$prefix/lib/trekker-camp/current"
	ln -s "$prefix/lib/trekker-camp/current/deploy.sh" "$release/camp-entry"
	mv -Tf "$release/camp-entry" "$prefix/bin/camp"
	if [[ -n $deployment_dir ]]; then
		save_deployment_dir "$deployment_dir" "$prefix/lib/trekker-camp/deployment-dir"
	fi
}

self_update() (
	local prefix=${1:-/usr/local} download_dir remote_head revision name
	umask 077
	download_dir=$(mktemp -d)
	trap 'rm -f -- "$download_dir/deploy.sh" "$download_dir/backup.sh"; rmdir -- "$download_dir"' EXIT
	stage='下载 CLI 更新'
	remote_head=$(GIT_TERMINAL_PROMPT=0 git -c credential.helper= ls-remote https://github.com/HePudding/trekker-camp.git refs/heads/master)
	revision=${remote_head%%[[:space:]]*}
	[[ $revision =~ ^[a-f0-9]{40}$ ]] || fail '无法读取 CLI 最新提交。'
	for name in deploy.sh backup.sh; do
		curl --fail --silent --show-error --location --proto '=https' \
			"https://raw.githubusercontent.com/HePudding/trekker-camp/$revision/scripts/$name" -o "$download_dir/$name"
	done
	stage='安装 CLI 更新'
	install_cli "$download_dir" "$revision" "$prefix"
	log "CLI 已更新：$revision"
)

resolve_storage() {
	local requested=${1:-} saved="$camp_dir/.config/data-dir"
	data_dir=$camp_dir
	if [[ -f $saved ]]; then
		data_dir=$(< "$saved")
		[[ -n $data_dir ]] || fail '保存的数据目录为空。'
	elif [[ -n $requested && ! -f $camp_dir/.config/default.yml ]]; then
		data_dir=$requested
	fi
	data_dir=$(realpath -m -- "$data_dir")
	[[ $data_dir != / && $data_dir != *$'\n'* && $data_dir != *$'\r'* && $data_dir != *,* && $data_dir != *:* ]] ||
		fail '数据目录需为独立路径，不含换行、逗号或冒号。'
	if [[ -n $requested && $(realpath -m -- "$requested") != "$data_dir" ]]; then
		fail "已有数据目录为 $data_dir；请保留该目录，路径变更需另行迁移数据。"
	fi
	if [[ $data_dir != "$camp_dir" ]]; then
		[[ $data_dir != "$camp_dir/"* && $camp_dir != "$data_dir/"* ]] || fail '自定义数据目录需位于代码目录之外，且不能包含代码目录。'
	fi
	config_dir=$data_dir/.config
	assets_dir=$data_dir/private-assets
	backup_root=$data_dir/backups
	if [[ $data_dir == "$camp_dir" ]]; then backup_root=$camp_dir.backups; fi
}

load_backup() {
	local library=$cli_dir/backup.sh
	if [[ ! -f $library ]]; then library=$camp_dir/scripts/backup.sh; fi
	# shellcheck source=scripts/backup.sh
	source "$library"
}

detect_ubuntu() {
	# shellcheck disable=SC1090
	source "${1:-/etc/os-release}"
	case "${ID:-}:${VERSION_ID:-}" in
		ubuntu:22.04) ubuntu_codename=jammy ;;
		ubuntu:24.04) ubuntu_codename=noble ;;
		ubuntu:26.04) ubuntu_codename=resolute ;;
		*) fail '支持 Ubuntu 22.04、24.04、26.04 LTS。' ;;
	esac
	architecture=$(dpkg --print-architecture)
	case "$architecture" in amd64|arm64) ;; *) fail '支持 amd64 和 arm64 VPS。' ;; esac
}

docker_apt_source() {
	cat <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $ubuntu_codename
Components: stable
Architectures: $architecture
Signed-By: /etc/apt/keyrings/docker.asc
EOF
}

install_dependencies() {
	local package
	local missing=()
	for package in ca-certificates curl git git-lfs openssl tzdata; do
		if [[ $(dpkg-query -W -f='${Status}' "$package" 2>/dev/null || true) != 'install ok installed' ]]; then
			missing+=("$package")
		fi
	done
	if ((${#missing[@]})); then
		apt-get update
		DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${missing[@]}"
	fi
	if ! command -v docker >/dev/null; then
		for package in docker.io docker-compose docker-compose-v2 docker-doc docker-buildx podman-docker containerd runc; do
			[[ $(dpkg-query -W -f='${Status}' "$package" 2>/dev/null || true) != 'install ok installed' ]] ||
				fail "发现已有 $package，请先处理与 Docker CE 的包冲突。"
		done
		install -d -m 0755 /etc/apt/keyrings
		curl --fail --silent --show-error --location https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
		chmod 0644 /etc/apt/keyrings/docker.asc
		docker_apt_source > /etc/apt/sources.list.d/docker.sources
		apt-get update
		DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
			docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
	fi
	docker compose version >/dev/null || fail '现有 Docker 缺少 Compose 插件，请安装 docker-compose-plugin。'
	docker buildx version >/dev/null || fail '现有 Docker 缺少 Buildx 插件，请安装 docker-buildx-plugin。'
}

prepare_auth() {
	if [[ -z $github_token && -s $config_dir/github-token ]]; then
		github_token=$(< "$config_dir/github-token")
	fi
	if [[ -z $github_token && -t 0 ]]; then
		read -r -s -p 'GitHub 细粒度 PAT（私有素材仓库 Contents: Read-only，验证后保存）：' github_token
		printf '\n'
	fi
	[[ -n $github_token ]] || fail '尚未保存 GitHub PAT，请交互输入或通过 GH_TOKEN / GITHUB_TOKEN 提供。'
	[[ $github_token =~ ^github_pat_[a-zA-Z0-9_]+$ ]] || fail '请提供 github_pat_ 开头的 GitHub 细粒度 PAT。'
	auth_dir=$(mktemp -d)
	cat > "$auth_dir/askpass" <<'ASKPASS'
#!/bin/sh
case "$1" in
  "Username for 'https://github.com':"*|"Username for 'https://github.com/"*) printf '%s\n' x-access-token ;;
  "Password for 'https://github.com':"*|"Password for 'https://x-access-token@github.com':"*|\
  "Password for 'https://github.com/"*|"Password for 'https://x-access-token@github.com/"*) printf '%s\n' "$CAMP_GH_TOKEN" ;;
  *) exit 1 ;;
esac
ASKPASS
	chmod 0700 "$auth_dir/askpass"
}

save_github_token() (
	local candidate
	umask 077
	candidate=$(mktemp "$config_dir/.github-token-XXXXXX")
	trap 'rm -f -- "$candidate"' EXIT
	printf '%s\n' "$github_token" > "$candidate"
	chmod 0600 "$candidate"
	mv -f -- "$candidate" "$config_dir/github-token"
)

github_git() {
	LC_ALL=C CAMP_GH_TOKEN="$github_token" GIT_ASKPASS="$auth_dir/askpass" GIT_TERMINAL_PROMPT=0 GIT_LFS_SKIP_SMUDGE=1 \
		git -c credential.helper= "$@"
}

prepare_cloudflare() {
	if [[ -z $cloudflare_token && -t 0 ]]; then
		read -r -s -p 'Cloudflare API token（本站 Zone Read + DNS Edit）：' cloudflare_token
		printf '\n'
	fi
	[[ $cloudflare_token =~ ^([a-zA-Z0-9_-]{35,50}|cf(ut|at)_[a-zA-Z0-9_-]{32,256})$ ]] ||
		fail '请提供有效的 CLOUDFLARE_API_TOKEN，授权本站 Zone Read 和 DNS Edit。'
}

check_checkout() {
	local directory=$1 repository=$2
	[[ -e $directory/.git ]] || fail "$directory 不是独立 Git 工作副本。"
	[[ $(git -C "$directory" config --get remote.origin.url) == "$repository" ]] || fail "$directory 的 origin 需为 $repository。"
	[[ $(git -C "$directory" symbolic-ref --quiet --short HEAD) == master ]] || fail "$directory 需位于 master 分支。"
	[[ -z $(git -C "$directory" status --porcelain --untracked-files=all) ]] || fail "$directory 有本地改动，请先保存；部署已停止。"
}

sync_checkout() {
	local directory=$1 repository=$2
	if [[ ! -e $directory/.git ]]; then
		github_git clone --branch master --single-branch "$repository" "$directory"
	fi
	check_checkout "$directory" "$repository"
	github_git -C "$directory" fetch --no-tags origin master
	git -C "$directory" merge-base --is-ancestor HEAD origin/master || fail "$directory 存在未发布提交或分叉，部署已停止。"
	GIT_LFS_SKIP_SMUDGE=1 git -C "$directory" merge --ff-only origin/master
}

create_configuration() {
	local password
	[[ ! -e $camp_dir/compose.yml && ! -e $config_dir/default.yml && ! -e $config_dir/docker.env &&
		! -e $config_dir/Caddyfile && ! -e $config_dir/cloudflare.env ]] ||
		fail '部署配置已存在。请使用 update 继续部署；已有配置保持原样。'
	password=$(openssl rand -hex 32)
	install -d -m 0750 -g 991 "$config_dir"
	if [[ $data_dir != "$camp_dir" ]]; then install -d -m 0755 "$camp_dir/.config"; fi
	(
		umask 077
		printf '%s\n' "$data_dir" > "$camp_dir/.config/data-dir"
		printf 'CLOUDFLARE_API_TOKEN=%s\n' "$cloudflare_token" > "$config_dir/cloudflare.env"
		sed -e "s|^POSTGRES_PASSWORD=example-misskey-pass$|POSTGRES_PASSWORD=$password|" \
			-e 's/^POSTGRES_USER=example-misskey-user$/POSTGRES_USER=misskey/' \
			"$camp_dir/.config/docker_example.env" > "$config_dir/docker.env"
		sed -e "s|^url: https://example.tld/$|url: $site_url|" \
			-e 's/^  user: example-misskey-user$/  user: misskey/' \
			-e "s/^  pass: example-misskey-pass$/  pass: '$password'/" \
			"$camp_dir/.config/docker_example.yml" > "$config_dir/default.yml"
	)
	chown root:991 "$config_dir/default.yml"
	chmod 0640 "$config_dir/default.yml"
	cat > "$config_dir/Caddyfile" <<EOF
import /etc/caddy/cloudflare-proxies.caddy

${site_url#https://} {
	tls {
		dns cloudflare {env.CLOUDFLARE_API_TOKEN}
		resolvers 1.1.1.1 1.0.0.1
	}
	reverse_proxy web:3000 {
		header_up X-Forwarded-For {client_ip}
	}
}
EOF
	cp "$camp_dir/compose.vps.yml" "$camp_dir/compose.yml"
	write_autostart_config always "$config_dir/compose.autostart.yml"
	install -d -m 0755 -o 991 -g 991 "$data_dir/files"
	if [[ $data_dir != "$camp_dir" ]]; then
		install -d -m 0700 "$data_dir/caddy/data" "$data_dir/caddy/config"
	fi
}

compose() {
	local caddy_data=caddy_data caddy_config=caddy_config
	local overrides=()
	if [[ $data_dir != "$camp_dir" ]]; then caddy_data=$data_dir/caddy/data; caddy_config=$data_dir/caddy/config; fi
	if [[ -f $config_dir/compose.autostart.yml ]]; then overrides=(-f "$config_dir/compose.autostart.yml"); fi
	CAMP_DATA_DIR="$data_dir" CAMP_CADDY_DATA="$caddy_data" CAMP_CADDY_CONFIG="$caddy_config" \
		CAMP_ASSETS_DIR="$assets_dir/public" docker compose --project-directory "$camp_dir" \
		-f "$camp_dir/compose.yml" -f "$camp_dir/compose.assets.yml" "${overrides[@]}" "$@"
}

write_autostart_config() {
	local policy=$1 destination=$2 service
	{
		printf '# Managed by camp autostart.\nservices:\n'
		for service in web db redis caddy; do printf '  %s:\n    restart: "%s"\n' "$service" "$policy"; done
	} > "$destination"
}

autostart_status() {
	local container_ids
	local containers=()
	if systemctl is-enabled --quiet docker; then printf 'Docker 开机启动：已开启\n'
	else printf 'Docker 开机启动：未开启\n'; fi
	container_ids=$(compose ps --all --quiet)
	if [[ -z $container_ids ]]; then
		printf '站点尚未创建容器，请运行 camp start。\n'
		return
	fi
	mapfile -t containers <<< "$container_ids"
	printf '站点开机自启：\n'
	docker inspect --format '{{.Name}}：{{if eq .HostConfig.RestartPolicy.Name "always"}}已开启{{else if eq .HostConfig.RestartPolicy.Name "unless-stopped"}}已开启（手动停止后保持停止）{{else}}已关闭{{end}}' "${containers[@]}"
}

set_autostart() (
	local mode=$1 policy candidate container_ids
	local containers=()
	case "$mode" in on) policy=always ;; off) policy=no ;; *) fail 'autostart 接受 on、off 或 status。' ;; esac
	stage='保存开机自启设置'
	candidate=$(mktemp "$config_dir/.compose.autostart-XXXXXX.yml")
	trap 'rm -f -- "$candidate"' EXIT
	write_autostart_config "$policy" "$candidate"
	compose -f "$candidate" config --quiet
	container_ids=$(compose ps --all --quiet)
	if [[ $mode == on ]]; then systemctl enable docker; fi
	if [[ -n $container_ids ]]; then
		mapfile -t containers <<< "$container_ids"
		docker update --restart="$policy" "${containers[@]}" >/dev/null
	fi
	mv -f -- "$candidate" "$config_dir/compose.autostart.yml"
	if [[ $mode == on ]]; then log '已开启站点开机自启；当前运行状态保持不变。'
	else log '已关闭站点开机自启；当前运行状态保持不变。'; fi
)

check_https() {
	stage='检查 HTTPS 入口'
	site_url=$(sed -n 's/^url:[[:space:]]*//p' "$config_dir/default.yml")
	curl --fail --silent --show-error --output /dev/null --retry 60 --retry-max-time 300 --retry-delay 5 --retry-all-errors \
		--connect-timeout 5 --max-time 10 --resolve "${site_url#https://}:443:127.0.0.1" "$site_url/healthz"
}

start_site() {
	stage='启动站点并检查健康状态'
	compose config --quiet
	compose up -d --no-build --pull never --wait --wait-timeout 180
	check_https
	log "站点已启动：$site_url"
}

stop_site() {
	stage='停止站点'
	compose stop --timeout 60
	log '站点已停止，容器和数据已保留。'
}

use_image_start_command() (
	local candidate
	candidate=$(mktemp "$camp_dir/.compose-XXXXXX")
	trap 'rm -f -- "$candidate"' EXIT
	# Remove the old camp override, preserving other settings and custom commands.
	# Support the flow list we generated and its equivalent block-list spelling.
	awk '
		/^  web:$/ { web = 1; print; next }
		/^  [^[:space:]]/ { web = 0 }
		web && /^    command: \[pnpm, start\]$/ { next }
		web && /^    command:$/ {
			line = $0
			getline first
			getline second
			if (first ~ /^    (  )?- pnpm$/ && second ~ /^    (  )?- start$/) next
			print line; print first; print second; next
		}
		{ print }
	' "$camp_dir/compose.yml" > "$candidate"
	if cmp -s "$candidate" "$camp_dir/compose.yml"; then return; fi
	chmod --reference="$camp_dir/compose.yml" "$candidate"
	mv -f -- "$candidate" "$camp_dir/compose.yml"
)

deploy() {
	local action=$1
	stage='构建应用镜像'
	compose config --quiet
	compose build web caddy
	stage='验证 Caddy 与 Cloudflare 配置'
	compose run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
	stage='启动数据库与 Redis'
	compose up -d --wait --wait-timeout 120 db redis
	stage='停止应用并备份数据库'
	compose stop web
	backup_dir=$(mktemp -d "$backup_root/$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
	chmod 0700 "$backup_dir"
	(
		umask 077
		tar -czf "$backup_dir/config.tar.gz" -C "$data_dir" .config -C "$camp_dir" compose.yml compose.assets.yml
		# PostgreSQL credentials are expanded inside the database container.
		# shellcheck disable=SC2016
		compose exec -T db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup_dir/database.dump"
	)
	[[ -s $backup_dir/database.dump ]] || fail "数据库备份为空：$backup_dir/database.dump"
	log "备份已保存：$backup_dir"
	stage='使用 Misskey 镜像默认启动入口'
	use_image_start_command
	if [[ $action == install ]]; then
		stage='初始化数据库'
		compose run --rm --no-deps web pnpm run init
	else
		stage='迁移数据库'
		# Keep long migrations outside the startup health-check timeout.
		compose run --rm --no-deps web pnpm run migrate
	fi
	stage='启动应用并检查健康状态'
	if ! compose up -d --no-deps --force-recreate --wait --wait-timeout 180 web; then
		compose stop web
		fail "应用迁移或启动失败，已停止应用。请查看 camp logs；备份保存在 $backup_dir。"
	fi
	stage='启动 HTTPS 入口'
	compose up -d --wait --wait-timeout 60 caddy
	check_https
	stage='安装 camp 命令'
	install_cli "$camp_dir/scripts" "$(git -C "$camp_dir" rev-parse HEAD)" /usr/local "$camp_dir"
	log "部署完成：$site_url。数据目录：$data_dir。使用 camp status 查看状态，camp logs 查看日志。"
	compose ps
}

main() {
	# Disable tracing before reading credentials, including when invoked with bash -x.
	set +x
	set -Eeuo pipefail
	umask 022
	local action='' option requested_data_dir='' autostart_mode=status
	camp_dir=/opt/trekker-camp
	if [[ -f $cli_dir/VERSION && -s $cli_dir/../deployment-dir ]]; then
		camp_dir=$(< "$cli_dir/../deployment-dir")
	fi
	site_url=''
	github_token=${GH_TOKEN:-${GITHUB_TOKEN:-}}
	cloudflare_token=${CLOUDFLARE_API_TOKEN:-}
	unset GH_TOKEN GITHUB_TOKEN CLOUDFLARE_API_TOKEN
	auth_dir='' backup_dir='' stage='初始化'
	trap 'if [[ -n $auth_dir ]]; then rm -f -- "$auth_dir/askpass"; rmdir -- "$auth_dir"; fi' EXIT
	trap 'printf "操作失败：%s。备份目录：%s\n" "$stage" "${backup_dir:-未创建}" >&2' ERR
	if (($#)) && [[ $1 != -* ]]; then action=$1; shift; fi
	if [[ $action == autostart ]] && (($#)) && [[ $1 != -* ]]; then autostart_mode=$1; shift; fi
	while (($#)); do
		option=$1
		case "$option" in
			--dir|--url|--data-dir)
				if (($# < 2)) || [[ -z $2 || $2 == --* ]]; then fail "$option 缺少值。"; fi
				case "$option" in --dir) camp_dir=$2 ;; --data-dir) requested_data_dir=$2 ;; --url) site_url=${2%/} ;; esac
				shift 2 ;;
			-h|--help) usage; return ;;
			--version) cli_version; return ;;
			*) fail "未知参数：$option" ;;
		esac
	done
	if [[ -z $action ]]; then
		if [[ -t 0 && -t 1 && -t 2 ]]; then action=tui; else usage; return; fi
	fi
	case "$action" in
		help|-h|--help) usage; return ;;
		version|--version) cli_version; return ;;
		tui)
			[[ -t 0 && -t 1 && -t 2 ]] || fail '交互菜单需要终端；自动化任务请使用子命令或 --help。'
			[[ -z $site_url && -z $requested_data_dir ]] || fail '交互菜单只接受 --dir；域名和数据目录请在首次安装菜单中填写。'
			camp_dir=$(realpath -m -- "$camp_dir")
			tui_menu; return ;;
		install|update|self-update|status|logs|r2-bind|backup|backup-status|start|stop|restart) ;;
		autostart)
			case "$autostart_mode" in on|off|status) ;; *) fail 'autostart 接受 on、off 或 status。' ;; esac ;;
		*) fail "未知命令：$action" ;;
	esac
	[[ $EUID == 0 ]] || fail '请通过 sudo 或 root 运行。'
	detect_ubuntu /etc/os-release
	if [[ $action == self-update ]]; then
		[[ -z $site_url && -z $requested_data_dir ]] || fail 'self-update 不接受 --url 或 --data-dir。'
		exec 9>/run/lock/trekker-camp-deploy.lock
		flock -n 9 || fail '另一项营地部署或备份正在运行。'
		self_update /usr/local
		return
	fi
	camp_dir=$(realpath -m -- "$camp_dir")
	[[ $camp_dir != / && $camp_dir != *$'\n'* ]] || fail '请指定独立部署目录。'
	resolve_storage "$requested_data_dir"
	if [[ $action != install ]]; then
		[[ -z $site_url ]] || fail '--url 仅用于首次 install。'
		[[ -f $camp_dir/compose.yml && -f $config_dir/default.yml ]] || fail '部署配置不存在，请先运行 install --url https://你的域名。'
		# Adopt an existing deployment once when upgrading an older CLI bundle.
		if [[ -f $cli_dir/VERSION && ! -e $cli_dir/../deployment-dir ]]; then
			save_deployment_dir "$camp_dir" "$cli_dir/../deployment-dir"
		fi
	fi
	case "$action" in
		status) printf '代码目录：%s\n数据目录：%s\n备份目录：%s\n' "$camp_dir" "$data_dir" "$backup_root"; compose ps --all; autostart_status; return ;;
		autostart) if [[ $autostart_mode == status ]]; then autostart_status; return; fi ;;
		logs) compose logs --tail 100 --follow web caddy; return ;;
		backup-status)
			r2_dir=$backup_root/r2
			load_backup
			r2_backup_status; return ;;
		install)
			valid_site_url "$site_url" || fail '--url 需为 HTTPS 域名，不含端口或子路径。' ;;
	esac
	exec 9>/run/lock/trekker-camp-deploy.lock
	if [[ $action == backup || $action == r2-bind ]]; then
		flock -w 3600 9 || fail '等待部署或备份锁超时。'
		docker info >/dev/null
		r2_dir=$backup_root/r2
		load_backup
		if [[ $action == r2-bind ]]; then r2_bind; else r2_backup; fi
		return
	fi
	flock -n 9 || fail '另一项营地部署或备份正在运行。'
	case "$action" in
		start|restart)
			systemctl start docker
			if [[ $action == restart ]]; then stop_site; fi
			start_site; return ;;
		stop) stop_site; return ;;
		autostart) set_autostart "$autostart_mode"; return ;;
	esac
	stage='读取 GitHub 凭据'
	prepare_auth
	stage='读取 Cloudflare 凭据'
	if [[ $action == update ]]; then
		[[ -f $config_dir/cloudflare.env ]] || fail '缺少 .config/cloudflare.env。'
		cloudflare_token=$(sed -n 's/^CLOUDFLARE_API_TOKEN=//p' "$config_dir/cloudflare.env")
		[[ -n $cloudflare_token ]] || fail '.config/cloudflare.env 缺少 CLOUDFLARE_API_TOKEN。'
	fi
	prepare_cloudflare
	stage='准备系统依赖'
	if [[ $action == install ]]; then
		install_dependencies
		systemctl enable --now docker
	fi
	docker info >/dev/null
	# Validate both worktrees before advancing either repository.
	if [[ -e $camp_dir/.git ]]; then check_checkout "$camp_dir" https://github.com/HePudding/trekker-camp.git; fi
	if [[ -e $assets_dir/.git ]]; then check_checkout "$assets_dir" https://github.com/HePudding/trekker-camp-assets.git; fi
	stage='同步代码和私有素材'
	sync_checkout "$camp_dir" https://github.com/HePudding/trekker-camp.git
	install -d -m 0755 "$data_dir"
	sync_checkout "$assets_dir" https://github.com/HePudding/trekker-camp-assets.git
	git -C "$assets_dir" lfs install --local --skip-smudge
	github_git -C "$assets_dir" lfs pull --include='public/**' --exclude=
	[[ -d $assets_dir/public ]] || fail '素材仓库缺少 public/ 目录。'
	chmod -R a+rX "$assets_dir/public"
	if [[ $action == install ]]; then create_configuration; fi
	# Persist only after Git and LFS have successfully read the private assets.
	stage='保存 GitHub PAT'
	save_github_token
	install -d -m 0700 "$backup_root"
	deploy "$action"
}

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
	main "$@"
fi
