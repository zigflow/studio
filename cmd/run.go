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

package cmd

import (
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/zigflow/studio/internal/server"
)

func newRunCmd() *cobra.Command {
	var opts struct {
		Address string
	}

	cmd := &cobra.Command{
		Use:   "run",
		Short: "Run the Zigflow Studio HTTP server",
		RunE: func(cmd *cobra.Command, args []string) error {
			s := server.New(server.Options{
				Address: opts.Address,
				Version: Version,
			})

			log.Info().
				Str("address", opts.Address).
				Msg("Starting HTTP server")

			return s.ListenAndServe()
		},
	}

	viper.SetDefault("address", "0.0.0.0:8080")
	cmd.Flags().StringVar(
		&opts.Address, "address",
		viper.GetString("address"), "Address to listen on",
	)

	return cmd
}
