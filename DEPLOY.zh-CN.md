# 旅人营地 VPS 部署

`scripts/deploy.sh` 为本站准备 Linux VPS、部署应用并更新代码和私有素材。支持 **Ubuntu 22.04、24.04、26.04 LTS**，CPU 架构为 **amd64 / arm64**。宿主机使用 Bash、Git、Git LFS 和 Docker，Node 与 pnpm 在镜像中安装。

## 首次部署

在 Cloudflare 中将本站域名的 A / AAAA 记录指向 VPS，可以开启橙云代理；VPS 开放 TCP 80、443。Caddy 使用 Cloudflare DNS 验证自动申请并续期 HTTPS 证书。默认部署目录为 `/opt/trekker-camp`，应用端口只绑定 `127.0.0.1:3000`。

使用可读取 `HePudding/trekker-camp-assets` 的 GitHub token。细粒度 token 选择该私有仓库并授予 **Contents: Read-only**；仓库读取权限说明见 [GitHub 文档](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)。代码仓库以 HTTPS 拉取，默认分支均为 `master`。

另准备一个仅授权本站域名的 Cloudflare API token，权限为 **Zone → Zone → Read** 和 **Zone → DNS → Edit**，供 Caddy DNS 插件管理验证记录，参见 [插件权限说明](https://github.com/caddy-dns/cloudflare#configuration)。Cloudflare 的 SSL/TLS 加密模式选择 [Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/)。DNS 验证可在橙云开启时进行。

此改动合入 `master` 后，在 VPS 执行：

```bash
sudo -i
apt-get update
apt-get install -y ca-certificates curl
curl -fsSL https://raw.githubusercontent.com/HePudding/trekker-camp/master/scripts/deploy.sh -o /tmp/camp-deploy.sh
bash /tmp/camp-deploy.sh install --url https://camp.example.com
```

将示例域名替换为本站域名。CLI 会隐藏输入 GitHub token 和 Cloudflare token，也会读取已有的 `GH_TOKEN`、`GITHUB_TOKEN`、`CLOUDFLARE_API_TOKEN`；GitHub 认证还可使用当前执行用户的 `gh auth token`。首次安装后通过 `camp` 命令操作。

安装自动完成：

1. 检测 Ubuntu 版本，安装缺少的 Git / Git LFS 等工具；没有 Docker 时通过官方 APT 源安装 Docker Engine、Compose 和 Buildx。版本对应 `jammy` / `noble` / `resolute`，依据 [Docker Ubuntu 安装文档](https://docs.docker.com/engine/install/ubuntu/)。已有可用 Docker 会被复用。
2. 拉取代码和私有素材，仅下载 `public/` 下的 LFS 文件。
3. 生成随机数据库密码、应用配置和 Caddy / Cloudflare DNS 配置，将 `compose.vps.yml` 复制为本站的 `compose.yml`。
4. 构建应用及包含 Cloudflare 插件的 Caddy 镜像，验证代理配置，启动 PostgreSQL 18 和 Redis，备份数据库与配置，执行迁移。
5. 挂载素材并启动应用，等待容器健康检查和本机 HTTPS `/healthz` 检查成功。

首次打开站点时创建管理员账号。站点创建后保持配置中的 `url` 不变。

### 自定义数据目录

首次安装时指定数据盘目录：

```bash
bash /tmp/camp-deploy.sh install --url https://camp.example.com --data-dir /srv/trekker-camp-data
```

`--dir` 管理代码目录，默认 `/opt/trekker-camp`；`--data-dir` 管理持久化数据，默认沿用代码目录。自定义数据目录需位于代码目录之外，两个目录不能互相包含。示例中的存储布局为：

| 位置 | 内容 |
| --- | --- |
| `/srv/trekker-camp-data/.config/` | 应用、数据库、Cloudflare 和 Caddy 配置 |
| `/srv/trekker-camp-data/db/`、`redis/`、`files/` | 数据库、Redis 和上传文件 |
| `/srv/trekker-camp-data/private-assets/` | 私有素材工作副本，仅 `public/` 挂载给应用 |
| `/srv/trekker-camp-data/backups/` | 更新前本地备份、`r2/` 凭据与临时快照 |
| `/srv/trekker-camp-data/caddy/data/`、`caddy/config/` | Caddy 证书和运行状态 |
| `/srv/trekker-camp-data/restic-cache/` | Restic 缓存 |
| `/opt/trekker-camp/.config/data-dir` | 保存的数据根目录，仅 root 可读写 |

后续 `camp update`、`camp backup` 和定时任务自动读取该位置，`camp status` 显示实际路径。已有安装继续使用原目录；传入不同的 `--data-dir` 会停止操作，数据位置变更需安排停机迁移。Docker 引擎自身的镜像存储仍由宿主机 Docker 配置管理。

## 更新与日常操作

### 交互式菜单

安装后直接输入 `camp` 打开终端菜单，也可显式运行 `camp tui`。使用 **↑ / ↓ 和回车**，或菜单中的 **数字 / C** 选择操作，**Q / Esc / 0** 退出。方向键在当前界面更新高亮，不向终端滚动记录追加菜单；Windows Terminal 的 SSH 连接同样适用。菜单包含站点状态、实时日志、应用与素材更新、R2 备份与绑定、首次安装和 CLI 自更新。

```bash
camp
camp --dir /srv/trekker-camp
```

菜单按需调用 `sudo`，版本查看和浏览菜单无需 root；凭据仍通过隐藏输入或环境变量提供。未配置的目录默认选中“首次安装”，需要已有站点的操作会灰显。首次安装依次询问代码目录、站点地址和数据目录，默认分别为 `/opt/trekker-camp`、`https://camp.stellasora.cafe` 和当前代码目录；每项均可直接回车采用方括号中的值。地址或路径无效时在当前步骤重新输入，失败后重试沿用本次会话填写的值；输入 `:q` 返回菜单。

路径和地址确定后，CLI 先读取 GitHub 与 Cloudflare 凭据，再安装系统依赖。凭据使用已有环境变量或隐藏输入，不提供占位 token。

选择“切换代码目录”只改变当前菜单操作的站点，已有数据位置继续从该站点的 `.config/data-dir` 读取。

每次执行结束后按回车返回菜单；查看实时日志时用 `Ctrl+C` 结束日志并返回。更新和备份沿用子命令的停站、备份、失败处理和操作锁。非交互环境中直接运行 `camp` 显示帮助，CI 和定时任务继续使用以下子命令。

### 子命令

```bash
sudo camp update
sudo camp status
sudo camp logs
camp version
```

`update` 同步两个仓库的 `master`，构建新镜像后停止应用，备份数据库、执行迁移并重新创建应用容器。素材清单中的新增表情会在应用启动时自动注册。数据库、上传文件、配置和证书持续保存在原有目录 / Docker 卷中。

代码或素材有未提交修改、未发布提交、分叉或处于其他分支时，CLI 会停止并保留现场。更新使用已有配置；`compose.vps.yml` 的后续变化由维护者审查后应用到服务器 `compose.yml`。

构建失败时现有应用继续运行。备份或迁移失败时应用保持停止；修复报错后再次执行 `camp update`。首次部署在安装 `camp` 命令前失败时，可以使用 `bash /tmp/camp-deploy.sh update` 继续；尚未生成配置时重新执行 `install`。

HTTPS 检查失败时，检查域名解析、80 / 443 端口及 `camp logs` 中的 Caddy 日志。首次安装尚无 `camp` 命令时，使用 `bash /tmp/camp-deploy.sh logs`。脚本不会自动还原数据库迁移。

Caddy 只信任 [Cloudflare 官方网段](https://www.cloudflare.com/ips/)传来的 `CF-Connecting-IP`，将解析后的访客 IP 传给应用；直接连接 VPS 的请求使用连接来源地址。WebSocket 由 Caddy 正常转发，Cloudflare 保持 WebSockets 启用。缓存规则沿用应用响应头，为 `/api/*`、`/streaming*` 和登录页面保留动态访问，避免设置整站强制缓存。

### CLI 自更新

```bash
sudo camp self-update
camp version
```

`self-update` 从公开代码仓库读取 `master` 的提交号，按同一提交下载 `deploy.sh` 和 `backup.sh`，检查文件非空与 Bash 语法，再原子切换命令入口。下载或检查失败时保留旧 CLI。该命令独立于应用部署，不需要 GitHub token 或 Docker，也不需要先安装站点；运行中的站点保持原状。

CLI 成套安装到 `/usr/local/lib/trekker-camp/<提交号>-<随机后缀>/`，`current` 指向当前版本，`/usr/local/bin/camp` 是命令入口。`camp version` 显示工具提交号；备份模块从同一版本目录加载。成功执行应用 `camp update` 后，也会成套安装该应用提交携带的 CLI。自更新与部署、备份共用操作锁。

尚无 `self-update` 命令的旧安装，可重新下载上面的入口脚本，执行 `bash /tmp/camp-deploy.sh self-update`，随后使用 `camp` 命令。

### 无人值守的 token 注入

在运行 CLI 的终端或部署任务中注入 token：

```bash
read -r -s -p 'GitHub token: ' GH_TOKEN
printf '\n'
export GH_TOKEN
sudo --preserve-env=GH_TOKEN camp update
unset GH_TOKEN
```

也可由部署系统的 Secret 环境变量提供 `GH_TOKEN`。CLI 通过临时 `GIT_ASKPASS` 向 Git / Git LFS 提供凭据，token 不写入仓库 URL、Git 配置、应用配置或镜像；运行结束删除临时 helper。`status` / `logs` 不需要 token。

Cloudflare token 在首次安装时从 `CLOUDFLARE_API_TOKEN` 或隐藏输入读取，保存在仅 root 可读写的 `.config/cloudflare.env`，只注入 Caddy 容器，用于证书续期；普通更新沿用该文件。轮换 token 时更新此文件后执行 `camp update`。首次无人值守安装可使用 `sudo --preserve-env=GH_TOKEN,CLOUDFLARE_API_TOKEN bash /tmp/camp-deploy.sh install --url https://camp.example.com`。

### 目录和备份

以下为未指定 `--data-dir` 的默认位置；自定义数据盘使用前面的存储布局。

| 位置 | 内容 |
| --- | --- |
| `/opt/trekker-camp/.config/default.yml` | 站点配置与数据库密码，容器 UID/GID 991 可读取 |
| `/opt/trekker-camp/.config/docker.env` | PostgreSQL 初始化凭据，仅 root 可读写 |
| `/opt/trekker-camp/.config/Caddyfile` | HTTPS 反向代理配置 |
| `/opt/trekker-camp/.config/cloudflare.env` | 证书申请 / 续期的 Cloudflare token，仅 root 可读写 |
| `/opt/trekker-camp/private-assets/public/` | 运行时只读挂载的私有素材 |
| `/opt/trekker-camp/files/` | 上传文件 |
| `/opt/trekker-camp/db/`、`redis/` | 数据库和 Redis 数据 |
| `/opt/trekker-camp.backups/<时间>-<随机后缀>/` | `database.dump`（pg_dump 自定义格式）与 `config.tar.gz` |
| `/opt/trekker-camp.backups/r2/` | R2 绑定凭据、加密密码、最近成功时间和上传失败时保留的快照，仅 root 可访问 |
| Docker 卷 `caddy_data`、`caddy_config`（带 Compose 项目前缀） | Caddy 证书和状态 |

更新前的本地备份放在代码与 Docker 构建上下文之外，仅 root 可访问，更新不会自动清理。每日 R2 备份同时保存上传文件和运行时素材，设置见下节。数据库恢复使用 PostgreSQL 的 `pg_restore`，由维护者确定恢复版本与停机窗口。

需要其他安装位置时，为首次安装与每次后续操作都传入同一个 `--dir /你的目录`。使用 root / sudo 执行命令；CLI 只管理这套部署，不更改防火墙规则。

## R2 每日自动备份

先在 Cloudflare R2 创建本站专用的**私有 Bucket**，不启用公开访问。创建限定到该 Bucket 的 **Object Read & Write** 凭据，保存 **Access Key ID**、**Secret Access Key** 和控制台提供的 **S3 API Endpoint**。此处使用 R2 S3 凭据，证书续期仍使用前面的 DNS token。创建步骤和 Endpoint 格式见 [Cloudflare R2 文档](https://developers.cloudflare.com/r2/api/tokens/)。

部署完成后运行：

```bash
sudo camp r2-bind
```

使用自定义数据目录时，R2 凭据与快照自动放到该目录的 `backups/r2/`；下面的默认路径示例按 `camp status` 显示的备份目录替换即可。

按提示输入 Endpoint、Bucket、两项凭据及备份加密密码；凭据和密码隐藏输入。CLI 使用固定版本 `restic/restic:0.19.1` 加密并增量备份到 Bucket 的 `trekker-camp/` 前缀，首次绑定立即备份一次，成功后启用 systemd 定时任务。已有备份仓库使用原来的加密密码；重复绑定复用历史快照。[Restic 的 S3 仓库和密码说明](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html)介绍了恢复所需的凭据。

**每天北京时间 04:00（`Asia/Shanghai`）执行**，与 VPS 的系统时区无关；缺少时区数据库时会自动安装 `tzdata`。关机期间错过任务会在开机后补跑；失败后每 15 分钟重试，6 小时内最多启动 3 次。备份和部署共用锁；备份最多等待正在进行的部署 1 小时。

每次采集数据库与文件快照时短暂停止应用，数据库导出完成后恢复服务，再向 R2 上传。应用原本已停止时保持原状态。文件快照通过硬链接保留已删除文件，采集耗时取决于数据库大小和文件数量。`files/`、素材目录和备份目录需位于同一文件系统，默认部署路径满足这一要求；自定义挂载导致硬链接失败时，采集会终止并恢复应用。

快照内容包括：

- PostgreSQL 的 `database.dump`、`.config/` 配置、两份 Compose 文件和代码提交号 `code-revision`。
- 本机 `files/` 上传文件，以及 `private-assets/public/` 中的运行时素材。

Redis 缓存、Caddy 证书卷、素材原稿、Git 元数据和 R2 自身的访问凭据不进入快照。Caddy 可通过备份中的 DNS 配置重新申请证书；若站点另用对象存储保存上传文件，该存储需单独备份。

加密密码存于 `/opt/trekker-camp.backups/r2/password`，S3 凭据存于同目录的 `repository.env`，均仅 root 可读写。**把加密密码及 R2 访问资料另行保存在密码管理器**，供 VPS 丢失后的恢复使用。远端历史快照持续保留，内容自动去重；不要对仓库对象单独设置过期删除规则。上传失败保留本地快照，成功时只移除本次临时快照，之前的失败副本保留供排查。

```bash
sudo camp backup                 # 立即备份，不需要 GitHub token
sudo camp backup-status          # 最近成功时间、下次运行和任务结果
sudo journalctl -u trekker-camp-backup.service -n 100 --no-pager
```

无人值守绑定可从部署系统注入 `R2_ENDPOINT`、`R2_BUCKET`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BACKUP_PASSWORD`，以 root 运行 `camp r2-bind`。定时任务使用已保存的凭据，不需要额外环境变量。

### 提取远端备份

下面以默认部署路径为例，在 root 终端将最新快照提取到独立的空目录，避免覆盖正在运行的站点。VPS 丢失时，先用另存的 R2 资料与密码重建 `repository.env` 和 `password`，权限均设为 `0600`，再提取备份：

```bash
restore_dir=$(mktemp -d /opt/trekker-camp-restore.XXXXXX)
docker run --rm \
  --env-file /opt/trekker-camp.backups/r2/repository.env \
  --env AWS_DEFAULT_REGION=auto \
  --env RESTIC_PASSWORD_FILE=/run/secrets/backup-password \
  --mount type=bind,source=/opt/trekker-camp.backups/r2/password,target=/run/secrets/backup-password,readonly \
  --mount "type=bind,source=$restore_dir,target=/restore" \
  restic/restic:0.19.1 restore latest --target /restore
```

提取内容位于 `$restore_dir/backup/`。恢复时按 `code-revision` 准备对应代码，停站后还原配置、文件和素材，使用 PostgreSQL 18 的 `pg_restore` 恢复数据库，再启动服务；CLI 不自动覆盖现有数据库。

## 验证 CLI

交付检查执行：

```bash
node scripts/check-shipping.mjs
pnpm assets:test
```

CLI 专项可在 Linux / WSL 中单独运行 `bash scripts/check-deploy.sh`。真实加密恢复检查使用 `RESTIC_TEST_IMAGE=restic/restic:0.19.1 python3 scripts/backup.test.py BackupTests.test_real_restic_encrypted_incremental_backup_and_restore -v`，需要可用 Docker daemon。

部署相关文件发生改动时，`node scripts/check-shipping.mjs` 自动调用同一检查入口；Windows 使用默认 WSL 发行版。需在 Linux 环境安装 Bash、Python 3、Git、Git LFS 和 ShellCheck，Compose 检查需要 Docker CLI。Agent 依照 `AGENTS.md` 与交付技能使用实际数据路径，获得生产部署授权后通过 `camp update` 发布。

`.github/workflows/deploy-cli.yml` 支持 PR、`master` 推送和手动触发，在 Ubuntu 22.04、24.04、26.04 容器中实际安装 Docker 官方 APT 软件包。检查覆盖终端菜单键盘操作、安装向导、普通用户提权、日志中断、失败后返回菜单、CLI 成套自更新、下载失败保留旧命令、自定义数据目录、旧安装路径、Git / LFS、Compose，以及备份 / 迁移 / 健康检查失败处理。R2 流程测试覆盖停站恢复、上传失败、凭据保存和北京时间调度，并使用真实 Restic 镜像离线验证加密、增量备份和恢复。另行构建 Caddy 镜像，在禁用网络的容器中验证 Cloudflare DNS 和访客 IP 配置。结果汇总到 `VPS CLI checks`。测试使用临时仓库和模拟服务命令；实际 R2 连接在 VPS 绑定时验证。
