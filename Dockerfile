# syntax = docker/dockerfile:1.27

ARG NODE_VERSION=26.12.1-trixie

# build assets & compile TypeScript

FROM --platform=$BUILDPLATFORM node:${NODE_VERSION} AS native-builder

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
	--mount=type=cache,target=/var/lib/apt,sharing=locked \
	rm -f /etc/apt/apt.conf.d/docker-clean \
	; echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache \
	&& apt-get update \
	&& apt-get install -yqq --no-install-recommends \
	build-essential

WORKDIR /misskey

COPY --link ["pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json", "./"]
COPY --link ["scripts", "./scripts"]
COPY --link ["apps/misskey/package.json", "./apps/misskey/"]
COPY --link ["patches", "./patches"]
COPY --link ["apps/misskey/packages/backend/package.json", "./apps/misskey/packages/backend/"]
COPY --link ["apps/misskey/packages/frontend-shared/package.json", "./apps/misskey/packages/frontend-shared/"]
COPY --link ["apps/misskey/packages/frontend/package.json", "./apps/misskey/packages/frontend/"]
COPY --link ["apps/misskey/packages/frontend-embed/package.json", "./apps/misskey/packages/frontend-embed/"]
COPY --link ["apps/misskey/packages/frontend-builder/package.json", "./apps/misskey/packages/frontend-builder/"]
COPY --link ["apps/misskey/packages/i18n/package.json", "./apps/misskey/packages/i18n/"]
COPY --link ["apps/misskey/packages/icons-subsetter/package.json", "./apps/misskey/packages/icons-subsetter/"]
COPY --link ["apps/misskey/packages/sw/package.json", "./apps/misskey/packages/sw/"]
COPY --link ["apps/misskey/packages/misskey-js/package.json", "./apps/misskey/packages/misskey-js/"]
COPY --link ["apps/misskey/packages/misskey-reversi/package.json", "./apps/misskey/packages/misskey-reversi/"]
COPY --link ["apps/misskey/packages/misskey-bubble-game/package.json", "./apps/misskey/packages/misskey-bubble-game/"]

ARG NODE_ENV=production

RUN node -e "console.log(JSON.parse(require('node:fs').readFileSync('./package.json')).packageManager)" | xargs npm install -g

RUN --mount=type=cache,target=/root/.local/share/pnpm/store,sharing=locked \
	pnpm i --frozen-lockfile --aggregate-output

COPY --link . ./

RUN pnpm build
RUN rm -rf .git/

# build native dependencies for target platform

FROM --platform=$TARGETPLATFORM node:${NODE_VERSION} AS target-builder

RUN apt-get update \
	&& apt-get install -yqq --no-install-recommends \
	build-essential

WORKDIR /misskey

COPY --link ["pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json", "./"]
COPY --link ["scripts", "./scripts"]
COPY --link ["apps/misskey/package.json", "./apps/misskey/"]
COPY --link ["patches", "./patches"]
COPY --link ["apps/misskey/packages/backend/package.json", "./apps/misskey/packages/backend/"]
COPY --link ["apps/misskey/packages/misskey-js/package.json", "./apps/misskey/packages/misskey-js/"]
COPY --link ["apps/misskey/packages/misskey-reversi/package.json", "./apps/misskey/packages/misskey-reversi/"]
COPY --link ["apps/misskey/packages/misskey-bubble-game/package.json", "./apps/misskey/packages/misskey-bubble-game/"]

ARG NODE_ENV=production

RUN node -e "console.log(JSON.parse(require('node:fs').readFileSync('./package.json')).packageManager)" | xargs npm install -g

RUN --mount=type=cache,target=/root/.local/share/pnpm/store,sharing=locked \
	pnpm i --frozen-lockfile --aggregate-output

FROM --platform=$TARGETPLATFORM node:${NODE_VERSION}-slim AS runner

ARG UID="991"
ARG GID="991"

ENV PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
	ffmpeg tini curl libjemalloc-dev libjemalloc2 \
	&& ln -s /usr/lib/$(uname -m)-linux-gnu/libjemalloc.so.2 /usr/local/lib/libjemalloc.so \
	&& groupadd -g "${GID}" misskey \
	&& useradd -l -u "${UID}" -g "${GID}" -m -d /misskey misskey \
	&& find / -type d -path /sys -prune -o -type d -path /proc -prune -o -type f -perm /u+s -ignore_readdir_race -exec chmod u-s {} \; \
	&& find / -type d -path /sys -prune -o -type d -path /proc -prune -o -type f -perm /g+s -ignore_readdir_race -exec chmod g-s {} \; \
	&& apt-get clean \
	&& rm -rf /var/lib/apt/lists

# add package.json to add pnpm
COPY ./package.json ./package.json
RUN node -e "console.log(JSON.parse(require('node:fs').readFileSync('./package.json')).packageManager)" | xargs npm install -g

USER misskey
WORKDIR /misskey

COPY --chown=misskey:misskey --from=target-builder /misskey/node_modules ./node_modules
COPY --chown=misskey:misskey --from=target-builder /misskey/apps/misskey/packages/backend/node_modules ./apps/misskey/packages/backend/node_modules
COPY --chown=misskey:misskey --from=target-builder /misskey/apps/misskey/packages/misskey-js/node_modules ./apps/misskey/packages/misskey-js/node_modules
COPY --chown=misskey:misskey --from=target-builder /misskey/apps/misskey/packages/misskey-reversi/node_modules ./apps/misskey/packages/misskey-reversi/node_modules
COPY --chown=misskey:misskey --from=target-builder /misskey/apps/misskey/packages/misskey-bubble-game/node_modules ./apps/misskey/packages/misskey-bubble-game/node_modules
COPY --chown=misskey:misskey --from=native-builder /misskey/apps/misskey/built ./apps/misskey/built
COPY --chown=misskey:misskey --from=native-builder /misskey/apps/misskey/packages/misskey-js/built ./apps/misskey/packages/misskey-js/built
COPY --chown=misskey:misskey --from=native-builder /misskey/apps/misskey/packages/misskey-reversi/built ./apps/misskey/packages/misskey-reversi/built
COPY --chown=misskey:misskey --from=native-builder /misskey/apps/misskey/packages/misskey-bubble-game/built ./apps/misskey/packages/misskey-bubble-game/built
COPY --chown=misskey:misskey --from=native-builder /misskey/apps/misskey/packages/backend/built ./apps/misskey/packages/backend/built
COPY --chown=misskey:misskey --from=native-builder /misskey/apps/misskey/packages/i18n/built ./apps/misskey/packages/i18n/built
COPY --chown=misskey:misskey . ./

ENV LD_PRELOAD=/usr/local/lib/libjemalloc.so
ENV NODE_ENV=production
HEALTHCHECK --interval=5s --retries=20 CMD ["/bin/bash", "/misskey/healthcheck.sh"]
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["pnpm", "run", "migrateandstart"]
