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
// Pure helpers for parsing and displaying assignment values.
// No UI or Svelte dependencies.
import type { AssignmentValue } from '$lib/tasks/model';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-row type-override mode. Not persisted to the IR. */
export type ValueOverride = 'auto' | 'string' | 'number' | 'boolean' | 'null';

export type ParseOk = { ok: true; value: AssignmentValue };
export type ParseErr = { ok: false; errorKey: string };
export type ParseResult = ParseOk | ParseErr;

// ---------------------------------------------------------------------------
// parsePrimitive — AUTO mode
// ---------------------------------------------------------------------------

/**
 * Parse a raw input string as a JSON primitive using AUTO heuristics:
 *
 * - `"true"` / `"false"` → boolean
 * - `"null"` → null
 * - JSON string literal `"Hello"` (with quotes) → string without quotes
 * - Valid integer or float → number
 * - `{...}` or `[...]` that is valid JSON → error (objects/arrays forbidden)
 * - Everything else → string (raw input preserved)
 */
export function parsePrimitive(raw: string): ParseResult {
  const trimmed = raw.trim();

  if (trimmed === 'true') return { ok: true, value: true };
  if (trimmed === 'false') return { ok: true, value: false };
  if (trimmed === 'null') return { ok: true, value: null };

  // Quoted JSON string literal: `"Hello"` → "Hello" (strips surrounding quotes).
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'string') return { ok: true, value: parsed };
    } catch {
      // Malformed JSON string — fall through to plain string.
    }
  }

  // Reject JSON objects and arrays explicitly.
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null) {
        return { ok: false, errorKey: 'inspector.set.errorObjectArray' };
      }
    } catch {
      // Not valid JSON — treat as an ordinary string.
    }
  }

  // Number: non-empty, finite, and actually parseable as a number.
  if (trimmed !== '') {
    const num = Number(trimmed);
    if (!isNaN(num) && isFinite(num)) {
      return { ok: true, value: num };
    }
  }

  // String fallback — preserve the original input including any whitespace.
  return { ok: true, value: raw };
}

// ---------------------------------------------------------------------------
// coerceWithOverride — apply explicit override mode
// ---------------------------------------------------------------------------

/**
 * Parse `raw` according to an explicit override mode.
 *
 * - `'string'`  — always store raw input as a string.
 * - `'null'`    — always store null; input is ignored.
 * - `'number'`  — require a valid finite number or return an error.
 * - `'boolean'` — accept `true` / `false` (case-insensitive) or return an error.
 * - `'auto'`    — delegate to `parsePrimitive`.
 */
export function coerceWithOverride(
  raw: string,
  override: ValueOverride,
): ParseResult {
  switch (override) {
    case 'string':
      return { ok: true, value: raw };

    case 'null':
      return { ok: true, value: null };

    case 'number': {
      const trimmed = raw.trim();
      const num = Number(trimmed);
      if (trimmed === '' || isNaN(num) || !isFinite(num)) {
        return { ok: false, errorKey: 'inspector.set.errorNotNumber' };
      }
      return { ok: true, value: num };
    }

    case 'boolean': {
      const lower = raw.trim().toLowerCase();
      if (lower === 'true') return { ok: true, value: true };
      if (lower === 'false') return { ok: true, value: false };
      return { ok: false, errorKey: 'inspector.set.errorNotBoolean' };
    }

    case 'auto':
      return parsePrimitive(raw);
  }
}

// ---------------------------------------------------------------------------
// inferOverride — determine initial override from a stored value
// ---------------------------------------------------------------------------

/**
 * Infer a sensible initial override for a stored `AssignmentValue` so that
 * displaying → re-parsing the value in the inferred mode produces the same
 * stored value (i.e. the display round-trips without type changes).
 *
 * - `null`    → `'null'`
 * - boolean   → `'auto'`  (auto-parse of "true"/"false" gives boolean again)
 * - number    → `'auto'`  (auto-parse of the number string gives number again)
 * - string    → `'string'` if auto-parse would change the type; else `'auto'`
 */
export function inferOverride(value: AssignmentValue): ValueOverride {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return 'auto';
  if (typeof value === 'number') return 'auto';

  // String: check whether AUTO mode would silently coerce it.
  const probe = parsePrimitive(value);
  if (!probe.ok || typeof probe.value !== 'string') return 'string';
  return 'auto';
}

// ---------------------------------------------------------------------------
// displayValue — convert stored value to input text
// ---------------------------------------------------------------------------

/**
 * Return the text representation of a stored `AssignmentValue` for display
 * in a text input.
 */
export function displayValue(value: AssignmentValue): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  return value;
}
