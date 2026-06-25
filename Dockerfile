# Copyright 2026 Zigflow authors <https://github.com/zigflow/studio/graphs/contributors>
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

ARG ZIGFLOW_IMAGE=ghcr.io/zigflow/zigflow:latest
FROM ${ZIGFLOW_IMAGE} AS zigflow

FROM golang AS builder
ARG GIT_COMMIT
ARG GIT_REPO="github.com/zigflow/studio"
ARG PROJECT_NAME="studio"
ARG VERSION
ENV CGO_ENABLED=0
ENV GOOS=linux
ENV GOCACHE=/go/.cache
ENV PATH=${PATH}:/opt/bin
ENV PROJECT_NAME="${PROJECT_NAME}"
USER 1000
WORKDIR /go/app
COPY --chown=1000:1000 . .
COPY --from=zigflow /app/app /opt/bin/zigflow
RUN zigflow version
RUN go build \
  -ldflags \
  "-w -s -X $GIT_REPO/cmd.Version=$VERSION -X $GIT_REPO/cmd.GitCommit=$GIT_COMMIT" \
  -o /go/bin/app
COPY --from=cosmtrek/air /go/bin/air /go/bin/air
ENTRYPOINT [ "air" ]

FROM cgr.dev/chainguard/static
ARG GIT_COMMIT
ARG VERSION
ENV GIT_COMMIT="${GIT_COMMIT}"
ENV PATH=${PATH}:/opt/bin
ENV VERSION="${VERSION}"
WORKDIR /app
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /go/bin/app /app
COPY --from=zigflow /app/app /opt/bin/zigflow
ENTRYPOINT [ "/app/app" ]
