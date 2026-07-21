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

/**
 * Shared, kind-agnostic value parsers/formatters for the inspector forms
 * (DESIGN.md §6). These are reused by the common-fields logic (`commonFields.ts`)
 * and by more than one per-kind form, so they live apart from any single kind's
 * module. Pure string ↔ JS-value helpers — no domain types, no DOM.
 */

const INTEGER = /^-?\d+$/;

/**
 * Parse a `set` value string. Tries JSON first, so `true`/`42`/`"x"` become the
 * right primitive; anything that isn't valid JSON (notably a runtime expression
 * like `${ .x }`) is kept verbatim as a string.
 */
export function parseSetValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Render a `set` value back to an editable string (inverse of parseSetValue). */
export function formatSetValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * Parse one duration field: blank → omitted, an integer literal → a number, and
 * anything else (a runtime expression) kept as a string — matching the schema's
 * `integer | runtimeExpression` union for wait durations.
 */
export function parseDurationField(raw: string): number | string | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return undefined;
  }
  return INTEGER.test(trimmed) ? Number(trimmed) : trimmed;
}

/** Render a single duration field value back to an editable string. */
export function durationField(value: number | string | undefined): string {
  return value === undefined ? '' : String(value);
}

/**
 * Validate/parse a JSON text field: blank is valid (→ undefined); otherwise it
 * must be valid JSON. Used for the `schema` sub-objects (arbitrary embeddable
 * JSON Schema documents) and `set` object/array entries that don't warrant a
 * structured form.
 */
export function parseJsonField(raw: string): {
  valid: boolean;
  value: unknown;
} {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { valid: true, value: undefined };
  }
  try {
    return { valid: true, value: JSON.parse(trimmed) };
  } catch {
    return { valid: false, value: undefined };
  }
}

/** Whether a JSON text field has content that doesn't parse (drives inline errors). */
export function isInvalidJsonField(raw: string): boolean {
  return !parseJsonField(raw).valid;
}

/** Pretty-print a value as JSON text, or the empty string for `undefined`. */
export function formatJson(value: unknown): string {
  return value === undefined ? '' : JSON.stringify(value, null, 2);
}

/** Whether an object has no own keys (used to drop emptied optional containers). */
export function isEmptyObject(obj: object): boolean {
  return Object.keys(obj).length === 0;
}
