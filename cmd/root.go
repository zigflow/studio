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
	"os"

	gh "github.com/mrsimonemms/golang-helpers"
	"github.com/rs/zerolog"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

func newRootCmd() *cobra.Command {
	viper.AutomaticEnv()

	var opts struct {
		LogLevel string
	}

	rootCmd := &cobra.Command{
		Use:           "studio",
		Version:       Version,
		Short:         "A drag and drop UI for building Temporal workflows",
		SilenceUsage:  true,
		SilenceErrors: true,
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			level, err := zerolog.ParseLevel(opts.LogLevel)
			if err != nil {
				return err
			}
			zerolog.SetGlobalLevel(level)

			gh.CheckAndMaybePrintUpdate(cmd.Context(), Version, "zigflow", "studio")

			return nil
		},
	}

	viper.SetDefault("log_level", zerolog.InfoLevel.String())
	rootCmd.PersistentFlags().StringVarP(
		&opts.LogLevel, "log-level", "l",
		viper.GetString("log_level"), "Set log level",
	)

	rootCmd.AddCommand(
		newRunCmd(),
		newVersionCmd(),
	)

	return rootCmd
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	if err := newRootCmd().Execute(); err != nil {
		os.Exit(gh.HandleFatalError(err))
	}
}
