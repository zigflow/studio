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
import addFormats from 'ajv-formats';
import Ajv2020 from 'ajv/dist/2020';
import type { ErrorObject, ValidateFunction } from 'ajv/dist/2020';
import { parse as parseYaml } from 'yaml';

// The bundled schema is imported as raw text (via Vite's `?raw` suffix) and
// parsed at module load. Refresh it with `npm run update-schema`.
import schemaText from './zigflow.schema.yaml?raw';

/**
 * The single source of truth for workflow validation (DESIGN.md §4).
 *
 * This is the *only* validation path in the app: the save API route calls it,
 * and any client-side pre-check may reuse it. There is deliberately no separate,
 * hand-maintained set of "UI validation rules" to keep in sync with the schema.
 *
 * It covers only pure JSON-Schema-expressible rules. jq expression syntax,
 * determinism rules, and task-name-uniqueness-within-scope are additional
 * `zigflow validate` (CLI) checks that are not expressible as JSON Schema and are
 * out of scope here. The CLI remains the final authority before a workflow runs.
 */

/** A single validation failure, derived from an Ajv error. */
export interface ValidationError {
  /** JSON Pointer to the offending value, e.g. `/document/dsl`. */
  path: string;
  /** The failed schema keyword, e.g. `required`, `pattern`. */
  keyword: string;
  /** A human-readable message including the path. */
  message: string;
  /** The raw Ajv error params (e.g. `{ missingProperty: 'dsl' }`). */
  params: Record<string, unknown>;
}

/** The result of validating a workflow document. */
export type ValidationResult =
  { valid: true } | { valid: false; errors: ValidationError[] };

const schema = parseYaml(schemaText) as Record<string, unknown>;

const ajv = new Ajv2020({
  allErrors: true,
  // The schema is authored externally; disable strict-mode throws for keywords
  // Ajv would otherwise reject so validation reflects the schema as published.
  strict: false,
});
addFormats(ajv);

const validateFn: ValidateFunction = ajv.compile(schema);

function toValidationError(err: ErrorObject): ValidationError {
  const path = err.instancePath === '' ? '/' : err.instancePath;
  return {
    path,
    keyword: err.keyword,
    message: `${path} ${err.message ?? 'is invalid'}`.trim(),
    params: err.params as Record<string, unknown>,
  };
}

/**
 * Validate a candidate workflow document against the bundled Zigflow schema.
 *
 * Never throws for invalid input — expected failures are returned as data so
 * callers (the save route, client pre-checks) can surface them to the user.
 */
export function validateWorkflow(doc: unknown): ValidationResult {
  const valid = validateFn(doc);
  if (valid) {
    return { valid: true };
  }
  const errors = (validateFn.errors ?? []).map(toValidationError);
  return { valid: false, errors };
}
