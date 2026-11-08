# 营地美术素材

本指南中的开发、协作和部署流程围绕旅人营地本站及团队维护，不主动提供第三方部署支持。代码使用权利和项目维护范围见 [README](README.md#项目定位与支持范围)。

程序代码和独立授权的美术素材分别管理。`private-assets/` 和本地素材链接不进入公开 Git 仓库、Docker 构建上下文或源码下载包。公开仓库中的现有资源保持原有授权。

团队素材仓库为 [HePudding/trekker-camp-assets](https://github.com/HePudding/trekker-camp-assets)，保持 **Private**，默认分支为 `master`。仅授权成员有权拉取；素材更新在该仓库独立提交和审查。

## 目录约定

素材仓库在本地位于主代码仓库忽略的 `private-assets/`：

```text
private-assets/
├── public/              网页实际加载的图片、字体、音频
│   └── home/hero.webp
├── originals/           PSD、绘画工程、未发布素材
└── RIGHTS.md            权利人、来源、授权范围、署名要求
```

仅 `public/` 对网站访客开放。授权记录、凭据、原始工程和私有仓库的 `.git/` 均放在它外面。`private-assets` 是分发管理约定，网页中的素材仍可由访客下载。

素材遵循各自的授权；AGPL 源码入口继续提供网站实际运行版本的完整程序源码和构建脚本。程序代码、组件、样式和构建所需文件放在公开源码中。

后续的页面、主题和业务逻辑定制遵循相同边界，不将受 AGPL 管辖的实现移入私有素材库。私有仓库用于管理独立授权素材；素材使用和品牌使用仍须遵守相应权利人的授权。

## 本地开发

团队成员安装 Git LFS 并取得素材仓库访问权限后，在代码仓库根目录执行：

```bash
pnpm assets:pull
pnpm dev
```

`assets:pull` 首次在 `private-assets/` 中初始化独立 Git 仓库，安装该仓库的 LFS hooks 并拉取素材；以后仅快进更新 `master`，下载 `public/` 下的 Git LFS 文件，再建立本地链接。它会拒绝未提交素材、其他开发分支、分叉历史或错误的远程仓库，保留本地工作。登录使用本机已有的 Git 凭据，凭据不写入项目文件。

`apps/misskey/packages/frontend/assets/camp` 链接到素材库的 `public/`；Windows 使用目录联接，无需管理员权限。素材通过 `/client-assets/camp/` 访问。例如 `private-assets/public/home/hero.webp` 对应 `/client-assets/camp/home/hero.webp`。

`pnpm dev` 会自动建立或复用链接，不访问 GitHub，适合离线开发。直接修改素材即可刷新预览，无需重新复制或构建；浏览器缓存命中时强制刷新。需要同步团队更新时显式执行 `pnpm assets:pull`。

没有素材库权限的公开贡献者可运行 `pnpm assets:link` 创建空素材目录，再使用公开默认资源开发。已有未入库素材时，先保存或提交，再进行同步；主仓库中不添加素材子模块。

### 团队提交

在 `private-assets/` 中创建素材分支，添加网站资源并更新 `RIGHTS.md`，验证后向私有素材库创建 PR。程序对素材 URL 的引用在主代码仓库单独提交。主仓库的 `git add` 不会加入素材仓库。

音频、视频和原稿的 LFS 规则已在私有仓库配置；新增大图片时可按需要扩展其 `.gitattributes`。具体协作和发布步骤见[私有素材仓库指南](https://github.com/HePudding/trekker-camp-assets#readme)。

### 多个 worktree 共用素材

通过 `CAMP_ASSETS_DIR` 指定已有的 `public` 目录。相对路径以当前代码仓库根目录为准。指定的目录必须存在，拼写错误会直接报错。来源应位于当前代码仓库外，或当前仓库的 `private-assets/public/` 内；脚本拒绝链接当前仓库中未排除的其他目录。

PowerShell：

```powershell
$env:CAMP_ASSETS_DIR = 'D:/projects/trekker-camp/private-assets/public'
pnpm assets:link
```

Linux / macOS：

```bash
CAMP_ASSETS_DIR=/srv/trekker-assets/public pnpm assets:link
```

链接建立后，后续 `pnpm dev` 会复用它。需要切换来源时，重新设置 `CAMP_ASSETS_DIR` 并运行 `pnpm assets:link`。脚本只替换链接；遇到同名的普通目录或文件会停止，保留其内容。

`pnpm assets:pull` 会沿用现有共享链接，更新它指向的素材工作副本。该来源需要是素材仓库根目录下的 `public/`；对任意本地素材子目录仅使用 `assets:link`。

## 编写页面

- 图片通过 `/client-assets/camp/文件名` 或实例中的图片 URL 配置加载。保持运行时加载，不使用 `import`、`new URL(..., import.meta.url)`、Base64 内嵌或构建脚本复制版权素材。
- 公共源码应在没有私有素材时也能构建、运行。使用公开默认图、CSS 背景或图片加载失败回退，确保关键操作仍可用。
- 开发机、生产服务器使用相同 URL，素材只需按目录结构同步。
- 现有静态路由缓存 7 天。发布更新时采用新文件名，例如 `home/hero-v2.webp`，并更新引用，避免访客继续使用旧缓存。
- 对外发布截图、Storybook 或 CI 附件前，按素材授权决定展示范围；公开 CI 使用可公开的资源。

## Docker 部署

### 星塔旅人表情

私有素材库的 `public/emojis/stella-sora/manifest.json` 记录表情名称、中文搜索别名、分类及图片文件名，图片保存在同一目录。静态表情使用 PNG，动态表情使用 GIF；来源与授权记录留在素材库的 `RIGHTS.md` 和 `originals/` 中。

应用在 HTTP 服务启动前自动读取挂载的清单，将缺少的表情注册到站内表情列表，并刷新表情缓存。重复启动及多个服务进程同时启动均不会重复添加，已有表情的管理设置会保留。生产部署沿用以下素材同步及只读挂载流程，无需在管理页面手动上传或导入表情。

未挂载清单时正常启动并使用已有表情；清单存在但图片缺失或数据无效时，启动会报错，避免注册无法显示的表情。图片只通过 `/client-assets/camp/` 运行时加载，不进入代码包或镜像。

### 默认用户头像

未设置自定义头像的用户使用私有素材库中的 `public/avatars/default-v1.png`。用户上传头像后显示其自定义头像，移除后恢复营地默认头像；无需修改已有账号数据。系统账号沿用实例图标。

本次发布需要同时交付代码仓库与素材仓库：先同步包含该图片的素材版本到服务器，再部署配套代码，并沿用下述 `compose.assets.yml` 只读挂载。头像通过 `/client-assets/camp/avatars/default-v1.png` 加载，不进入镜像。未挂载图片时沿用原有默认头像；素材随后到位即可生效，无需再次重启应用。

### 同步与挂载

私有素材库的 [Assets 工作流](https://github.com/HePudding/trekker-camp-assets/actions/workflows/assets.yml) 已配置为：PR 验证素材；`master` 更新时验证并同步到已配置的服务器。未配置服务器时只验证，不发布。代码镜像仍只构建公开代码。

使用现有的 `compose.yml` 应用配置，附加仓库提供的 `compose.assets.yml`。素材目录由运行时只读挂载，镜像构建不读取它。

默认来源是服务器代码目录中的 `private-assets/public/`。也可以在部署 shell 或 Compose 的 `.env` 文件中指定代码仓库外的目录：

```dotenv
CAMP_ASSETS_DIR=/srv/trekker-assets/public
```

在私有素材库设置 `DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_PATH` 等 Actions Variables，以及 `DEPLOY_SSH_KEY`、`DEPLOY_KNOWN_HOSTS` Secrets，即可启用自动同步。参数说明见私有仓库指南。工作流先解析素材提交号，验证和同步使用同一个版本，只上传 `public/`；原稿与授权记录留在私有仓库。同步不删除服务器上的旧文件。

素材到位后，应用部署执行：

```bash
docker compose -f compose.yml -f compose.assets.yml up -d --build
```

使用现成镜像时去掉 `--build`。素材目录必须预先存在；容器内默认 UID/GID 为 `991`，需要能够读取文件、遍历目录。容器只挂载 `public/`，原稿和授权记录留在宿主机。

后续仅修改素材时，合入私有素材库 `master` 会自动同步已挂载目录。采用上述新文件名规则更新引用，无需重建镜像。非 Docker 部署也可在服务器执行 `pnpm assets:pull`，使用同一静态资源路径。

应用自动部署需要配套素材时，可从可信的部署任务触发私有素材库的 `assets.yml`，将 `assets_ref` 设置为选定的素材提交号，等待成功后再部署应用。普通 PR 检查不读取私有素材或部署凭据。

## 检查与 Agent 工作流

```bash
pnpm assets:check
pnpm assets:test
```

`assets:check` 检查素材目录及链接的 Git 忽略规则，并拒绝已加入 Git 索引的素材、链接或私有子仓库。该检查已接入 `scripts/check-shipping.mjs` 和 GitHub Actions。

`assets:test` 验证连接、重复运行、素材变更、现有目录保护、Git 排除和源码打包排除；Docker 可用时，还会用实际构建检查 `.dockerignore` 并解析部署挂载配置。测试使用临时目录，不读取实际美术文件。

Agent 首次准备团队环境时运行 `pnpm assets:pull`；之后按需要显式同步。发现本地素材修改、开发分支或分叉时保留现场，使用当前素材继续开发。纯公开开发使用 `assets:link`。沿用固定 URL，并验证缺少私有素材时的回退。

素材目录被 Git 忽略，查找时对命令输出的实际目录使用 `rg --files --no-ignore`；默认目录可执行 `rg --files --no-ignore private-assets/public`。有 `RIGHTS.md` 时先阅读其中的素材授权与署名要求。交付前运行正常的 shipping 检查；修改素材脚本、忽略规则或 Compose 配置时，再运行 `pnpm assets:test`。主仓库的提交仅包含程序和公开默认资源，素材更新单独记录在私有素材仓库。
