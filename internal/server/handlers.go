/*
 * Copyright 2026 Zigflow authors <https://github.com/zigflow/studio/graphs/contributors>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package server

import (
	"context"

	"github.com/zigflow/studio/internal/api"
)

// handlers implements the OpenAPI-generated api.StrictServerInterface. Each
// method maps one-to-one onto an operation in api/openapi.yaml.
type handlers struct {
	appName string
	version string
}

// Ensure handlers satisfies the generated strict server interface.
var _ api.StrictServerInterface = (*handlers)(nil)

// GetConfig returns the basic application and runtime configuration.
//
// (GET /api/config)
func (h *handlers) GetConfig(_ context.Context, _ api.GetConfigRequestObject) (api.GetConfigResponseObject, error) {
	return api.GetConfig200JSONResponse{
		AppName: h.appName,
		Version: h.version,
	}, nil
}
