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

// Package api contains the HTTP API types and server interfaces for Zigflow
// Studio. The bulk of this package is generated from the OpenAPI contract in
// api/openapi.yaml; see generated.go.
package api

// Regenerate the OpenAPI server interfaces and models. The paths are relative
// to this directory, which is the working directory used by `go generate`.
//go:generate go tool oapi-codegen --config ../../api/oapi-codegen.yaml ../../api/openapi.yaml
