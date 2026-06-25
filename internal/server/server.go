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

// Package server wires the OpenAPI-generated handlers onto a Chi router and an
// http.Server. It is the minimal HTTP foundation for Zigflow Studio.
package server

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog/log"
	"github.com/zigflow/studio/internal/api"
	"github.com/zigflow/studio/web/app"
)

// appName is the human-readable application name reported by GET /api/config.
const appName = "Zigflow Studio"

// readHeaderTimeout bounds how long the server waits for request headers,
// guarding against slow-client (Slowloris) connections.
const readHeaderTimeout = 10 * time.Second

// Options configures the HTTP server.
type Options struct {
	// Address is the host:port the server listens on, e.g. "0.0.0.0:8080".
	Address string
	// Version is the running application version reported by GET /api/config.
	Version string
}

// New constructs the HTTP server: a Chi router with the OpenAPI-generated
// handler mounted onto it. Routes are owned by the OpenAPI contract, so we
// register the generated handler rather than declaring routes by hand.
func New(opts Options) *http.Server {
	strict := api.NewStrictHandler(&handlers{
		appName: appName,
		version: opts.Version,
	}, nil)

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(RequestLogger(new(
		log.
			With().
			Str("component", "http").
			Logger(),
	)))
	r.Use(middleware.Recoverer)

	r.Mount("/", app.Mount("/"))
	r.Mount("/api", api.Handler(strict))

	return &http.Server{
		Addr:              opts.Address,
		Handler:           r,
		ReadHeaderTimeout: readHeaderTimeout,
	}
}
