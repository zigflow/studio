/*
 * Copyright 2025 - 2026 Zigflow authors <https://github.com/zigflow/studio/graphs/contributors>
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
import { parse, stringify } from 'yaml';

import type { ZigflowWorkflow } from '../types/zigflow';

/**
 * YAML (de)serialisation for workflows (DESIGN.md §5.2).
 *
 * Uses `yaml` (eemeli/yaml), *not* `js-yaml` — chosen because `yaml` also exposes
 * a `Document`/CST API that preserves comments, key order, and formatting. Today
 * this module does plain parse-to-object / stringify-from-object (no more capable
 * than `js-yaml` would be), but if lossless round-tripping becomes a requirement,
 * upgrading is a one-file change rather than a library swap.
 *
 * Parsing is untrusted at this layer: callers must validate the result before it
 * enters the domain model (AGENTS.md "Serialisation").
 */

/** Parse workflow YAML into a plain object. The result is untyped/untrusted. */
export function parseWorkflowYaml(text: string): unknown {
  return parse(text);
}

/** Serialise a workflow to YAML. */
export function stringifyWorkflowYaml(workflow: ZigflowWorkflow): string {
  return stringify(workflow);
}
