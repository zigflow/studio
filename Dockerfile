# Copyright 2025 - 2026 Zigflow authors <https://github.com/zigflow/studio/graphs/contributors>
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

FROM node:lts AS dev
ARG APP
ARG GIT_COMMIT
ARG VERSION
USER node
WORKDIR /home/node/app
ENV GIT_COMMIT="${GIT_COMMIT}"
ENV VERSION="${VERSION}"
COPY --chown=node:node . .
ENV HOST=0.0.0.0
ENV PORT=5173
EXPOSE 5173
CMD [ "npm", "run", "dev" ]

FROM node:lts-alpine AS builder
ARG VERSION
ENV VERSION="${VERSION}"
USER node
WORKDIR /home/node/app
COPY --chown=node:node . .
RUN npm ci \
  && npm run build \
  && npm prune --production

FROM gcr.io/distroless/nodejs20
ARG GIT_COMMIT
ARG GIT_REPO
ARG VERSION
WORKDIR /opt/app
ENV GIT_REPO="${GIT_REPO}"
ENV GIT_COMMIT="${GIT_COMMIT}"
ENV VERSION="${VERSION}"
ENV HOST=0.0.0.0
ENV PORT=3000
ENV PUBLIC_WORKFLOWS_DIR=/data
ENV NODE_ENV=production
COPY --from=builder /home/node/app/build build
COPY --from=builder /home/node/app/node_modules node_modules
COPY --from=builder /home/node/app/package.json package.json
USER 65532
EXPOSE 3000
VOLUME [ "/data" ]
CMD [ "build" ]
