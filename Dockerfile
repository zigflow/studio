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

FROM node:lts AS builder
ARG GIT_COMMIT
ARG VERSION
USER node
WORKDIR /home/node
ENV GIT_COMMIT="${GIT_COMMIT}"
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV VERSION="${VERSION}"
COPY --chown=node:node . .
EXPOSE 3000
RUN npm ci \
  && npm run build
CMD [ "npm", "run", "dev" ]

FROM cgr.dev/chainguard/node
ARG GIT_COMMIT
ARG VERSION
WORKDIR /app
ENV GIT_COMMIT="${GIT_COMMIT}"
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV PORT=3000
ENV VERSION="${VERSION}"
COPY --from=builder /home/node/public ./public
COPY --from=builder /home/node/.next/static ./.next/static
COPY --from=builder /home/node/.next/standalone ./
EXPOSE 3000
CMD [ "server.js" ]
