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

BINARY_NAME = studio
WEB_APP_DIR = web/app

build:
	@echo "Building ${BINARY_NAME}..."
	@rm -f ${BINARY_NAME}
	@npm --prefix ${WEB_APP_DIR} ci
	@npm --prefix ${WEB_APP_DIR} run build
	@go generate ./...
	@go build -tags prod -o ${BINARY_NAME} .

	@./${BINARY_NAME}

	@echo "\nBinary saved to ${PWD}/${BINARY_NAME}"
.PHONY: build

cruft-update:
ifeq (,$(wildcard .cruft.json))
	@echo "Cruft not configured"
else
	@cruft check || cruft update --skip-apply-ask --refresh-private-variables
endif
.PHONY: cruft-update

dev:
	@npx --yes concurrently "air" "npm --prefix ${WEB_APP_DIR} run dev"
.PHONY: dev
