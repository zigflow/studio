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
import { parseJsonField } from '$lib/editor/formValues';
import type { SetTask } from '$lib/types/zigflow';

/**
 * Form ↔ task mapping for `set` (DESIGN.md §6), paired with `SetForm.svelte`.
 * Each entry's value type is explicit (not sniffed from content), which is what
 * lets a literal string `"42"` stay a string rather than becoming the number 42.
 */

/**
 * The explicit value type of a `set` entry. Stored per entry rather than
 * sniffed from the value on save: content-sniffing was the bug that made a
 * literal string `"42"` round-trip to the number 42, with no way to keep the
 * string (DESIGN.md §6). `json` covers any compound/structured value — object,
 * array, or any valid JSON — via a JSON textarea; there is no recursive
 * per-element picker (rationale in §6).
 */
export type SetValueType = 'string' | 'boolean' | 'number' | 'null' | 'json';

/** One `set` key with its explicit value type and string-backed editable value. */
export interface SetValueEntry {
  key: string;
  type: SetValueType;
  /**
   * The value as an editable string, interpreted per `type`: the literal string
   * for `string`, `'true'`/`'false'` for `boolean`, the numeral for `number`,
   * JSON text for `json`. Unused for `null` (the stored value is always `null`).
   */
  value: string;
}

/** Whether a `set` task uses the object form this editor supports (vs a string). */
export function isSetObjectForm(
  task: SetTask,
): task is SetTask & { set: Record<string, unknown> } {
  return typeof task.set === 'object' && task.set !== null;
}

/**
 * Infer a value's type for the UI selector — a one-time, load-time convenience
 * so an existing task opens with each entry typed sensibly. This is NOT the
 * write path: once loaded the type is explicit and user-controlled, never
 * re-inferred from content (re-inferring is exactly the bug the selector
 * replaces). A real boolean/number/string/null maps to its own dedicated type
 * regardless of content; everything compound (objects *and* arrays alike) maps
 * to `json` and is edited as JSON text.
 */
export function inferSetValueType(value: unknown): SetValueType {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  if (value === null) return 'null';
  return 'json';
}

/** Format a stored value into the editable string for its inferred type. */
function formatSetEntryValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  if (value === null) return '';
  return JSON.stringify(value, null, 2);
}

export function readSetEntries(set: Record<string, unknown>): SetValueEntry[] {
  return Object.entries(set).map(([key, value]) => ({
    key,
    type: inferSetValueType(value),
    value: formatSetEntryValue(value),
  }));
}

/**
 * Re-render an entry's value string when its type changes. Scalar targets
 * best-effort convert the current text, else fall back to that type's default
 * (e.g. string `"42"` → number `"42"`, but string `"abc"` → number `"0"`);
 * `null` clears the (unused) value. Switching *into* `json` pre-fills the
 * current effective value serialized as JSON (number `42` → `42`, string `"hi"`
 * → `"hi"`), preserving the user's work rather than discarding it. Chosen over
 * always resetting because it keeps the common cases lossless.
 */
export function coerceSetValueForType(
  value: string,
  from: SetValueType,
  to: SetValueType,
): string {
  switch (to) {
    case 'string':
      return value;
    case 'boolean':
      return value.trim() === 'true' ? 'true' : 'false';
    case 'number': {
      const trimmed = value.trim();
      const n = Number(trimmed);
      return trimmed !== '' && Number.isFinite(n) ? String(n) : '0';
    }
    case 'null':
      return ''; // a `null` entry has no editable value
    case 'json':
      return valueAsJsonText(value, from);
    default: {
      const unreachable: never = to;
      throw new Error(`Unhandled set value type: ${String(unreachable)}`);
    }
  }
}

/**
 * Serialize the current `(value, from)` effective value as JSON text, for when
 * an entry is switched *into* `json`. A blank/invalid scalar becomes blank, so a
 * fresh entry starts empty rather than as `""`.
 */
function valueAsJsonText(value: string, from: SetValueType): string {
  switch (from) {
    case 'json':
      return value; // already JSON text
    case 'null':
      return 'null';
    case 'string':
      return value.trim() === '' ? '' : JSON.stringify(value);
    case 'boolean':
      return value.trim() === 'true' ? 'true' : 'false';
    case 'number': {
      const trimmed = value.trim();
      const n = Number(trimmed);
      return trimmed !== '' && Number.isFinite(n) ? String(n) : '';
    }
    default: {
      const unreachable: never = from;
      throw new Error(`Unhandled set value type: ${String(unreachable)}`);
    }
  }
}

/**
 * Convert one typed entry to its stored JS value. The type — not the content —
 * decides: a `string` entry stays a literal string even if it reads `"42"`. For
 * `json`, invalid *or* blank text keeps the last valid value (`prior`) so a
 * mid-edit bad value never clobbers what's stored (the JSON-textarea convention,
 * DESIGN.md §6); with no prior yet, the key is omitted until the JSON parses.
 */
function parseSetEntryValue(
  entry: SetValueEntry,
  prior: unknown,
): { value: unknown; omit: boolean } {
  switch (entry.type) {
    case 'string':
      return { value: entry.value, omit: false };
    case 'boolean':
      return { value: entry.value === 'true', omit: false };
    case 'number': {
      const n = Number(entry.value);
      return { value: Number.isFinite(n) ? n : 0, omit: false };
    }
    case 'null':
      return { value: null, omit: false };
    case 'json': {
      const parsed = parseJsonField(entry.value);
      // Invalid mid-edit or blank (both surface as no parsed value): keep the
      // last valid value, else omit the key until the JSON parses.
      if (!parsed.valid || parsed.value === undefined) {
        return prior === undefined
          ? { value: undefined, omit: true }
          : { value: prior, omit: false };
      }
      return { value: parsed.value, omit: false };
    }
    default: {
      const unreachable: never = entry.type;
      throw new Error(`Unhandled set value type: ${String(unreachable)}`);
    }
  }
}

export function writeSetTask(task: SetTask, entries: SetValueEntry[]): SetTask {
  const prior = isSetObjectForm(task) ? task.set : {};
  const set: Record<string, unknown> = {};
  for (const entry of entries) {
    const key = entry.key.trim();
    if (key === '') {
      continue;
    }
    const { value, omit } = parseSetEntryValue(entry, prior[entry.key]);
    if (!omit) {
      set[key] = value;
    }
  }
  return { ...task, set };
}
