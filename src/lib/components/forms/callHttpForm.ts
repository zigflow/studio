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
import { formatJson, parseJsonField } from '$lib/editor/formValues';
import { endpointText } from '$lib/editor/subtitle';
import type { CallHttpTask, Endpoint } from '$lib/types/zigflow';

/**
 * Form ↔ task mapping for `call: http` (DESIGN.md §6), paired with
 * `CallHttpForm.svelte`. `read*` flattens the task into a string-friendly form;
 * `write*` merges edits back onto the original task, preserving untouched
 * `with` fields and `TaskBase`. Each optional field follows the project's
 * "default/blank omits the property" convention so generated YAML stays minimal.
 */

/** The `output` format enum (schema: `raw`/`content`/`response`, default `content`). */
export const HTTP_OUTPUTS = ['raw', 'content', 'response'] as const;
export type HttpOutput = (typeof HTTP_OUTPUTS)[number];

/** A name→string map — the map form of `headers`/`query`. */
export type StringMap = Record<string, string>;

/** One name/value row of a headers/query map editor. */
export interface KeyValueEntry {
  key: string;
  value: string;
}

export interface HttpForm {
  method: string;
  endpoint: string;
  /** `output`; `content` is the schema default and is written as omitted. */
  output: HttpOutput;
  /** `redirect`; the schema states no default, so only `true` is written. */
  redirect: boolean;
  /** `body` as JSON text (unconstrained — any JSON value); blank omits it. */
  body: string;
  /** `headers` — a name→string map, or a whole-value runtime expression. */
  headers: StringMap | string | undefined;
  /** `query` — same shape as `headers`. */
  query: StringMap | string | undefined;
}

/**
 * Whether a `headers`/`query` value is the editable name→string **map** form (an
 * object, or absent → an empty map to fill in) rather than a whole-value
 * runtime-expression **string**. Mirrors `set`'s `isSetObjectForm` object-vs-
 * string split; the expression form has no structured editor and is shown
 * read-only (edited in YAML), the same fallback a set-expression gets.
 */
export function isMapField(
  value: StringMap | string | undefined,
): value is StringMap | undefined {
  return typeof value !== 'string';
}

/** A map → editable rows (insertion order preserved). */
export function mapToEntries(value: StringMap | undefined): KeyValueEntry[] {
  return value
    ? Object.entries(value).map(([key, entryValue]) => ({
        key,
        value: entryValue,
      }))
    : [];
}

/**
 * Editable rows → a name→string map. Blank keys are dropped; **duplicate keys
 * are last-wins** — a plain object literal naturally overwrites, which is fine
 * for `headers`/`query` (unlike task names, they have no uniqueness-dependent
 * resolution, so there's nothing to guard). An empty result is `undefined` so
 * the property is omitted entirely.
 */
export function entriesToMap(entries: KeyValueEntry[]): StringMap | undefined {
  const map: StringMap = {};
  for (const { key, value } of entries) {
    const trimmed = key.trim();
    if (trimmed === '') {
      continue;
    }
    map[trimmed] = value;
  }
  return Object.keys(map).length === 0 ? undefined : map;
}

/**
 * The nine general HTTP methods (IANA HTTP Method Registry, MDN, and Go's
 * `net/http` constants all agree on this set), offered as a convenience
 * dropdown. This is a **Studio-only UX aid, not a schema rule**: the Zigflow
 * schema's `method` is an unconstrained string, so the "Other" free-text escape
 * hatch stays schema-valid. There is no schema-side source to derive this list
 * from (the schema deliberately stays generic), so it is a legitimate
 * hand-written constant, not a duplicated rule.
 */
export const HTTP_METHODS = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'CONNECT',
  'OPTIONS',
  'TRACE',
] as const;

/** A method-select option: a known method, or the free-text `other` escape hatch. */
export type HttpMethodOption = (typeof HTTP_METHODS)[number] | 'other';

/**
 * Which method-select option to show for a method string — inferred **once at
 * load** (the same one-time, load-time-only convenience as `inferSetValueType`,
 * never part of the write path). An exact match against `HTTP_METHODS` shows
 * that option; anything else (a custom verb, `OTHER`, …) shows `other`, with the
 * raw text carried into the free-text field. It is NOT re-inferred while editing
 * — once in `other` mode the form stays there for the session; it re-derives
 * only on a fresh load.
 */
export function inferMethodOption(method: string): HttpMethodOption {
  return (HTTP_METHODS as readonly string[]).includes(method)
    ? (method as HttpMethodOption)
    : 'other';
}

export function readHttpForm(task: CallHttpTask): HttpForm {
  return {
    method: task.with.method,
    endpoint: endpointText(task.with.endpoint),
    output: task.with.output ?? 'content',
    redirect: task.with.redirect ?? false,
    body: formatJson(task.with.body),
    headers: task.with.headers,
    query: task.with.query,
  };
}

export function writeHttpTask(
  task: CallHttpTask,
  form: HttpForm,
): CallHttpTask {
  const withValue: CallHttpTask['with'] = {
    ...task.with,
    method: form.method,
    endpoint: nextEndpoint(task.with.endpoint, form.endpoint),
  };

  // `output`: `content` is the schema default, so writing it is omitted to keep
  // YAML minimal (like `then: continue`); only `raw`/`response` are stored.
  if (form.output === 'content') {
    delete withValue.output;
  } else {
    withValue.output = form.output;
  }

  // `redirect`: the schema states no default, so an unchecked box omits the
  // property (no explicit `false`) and only a checked one writes `true`.
  if (form.redirect) {
    withValue.redirect = true;
  } else {
    delete withValue.redirect;
  }

  applyBody(withValue, form.body, task.with.body);

  // `headers`/`query`: omit when absent or an empty map (the map editor already
  // reduces an empty map to `undefined`); a map or an expression string is set
  // through as-is.
  if (isOmittableMap(form.headers)) {
    delete withValue.headers;
  } else {
    withValue.headers = form.headers;
  }
  if (isOmittableMap(form.query)) {
    delete withValue.query;
  } else {
    withValue.query = form.query;
  }

  return { ...task, with: withValue };
}

/** Whether a headers/query value should be omitted: absent, or an empty map. */
function isOmittableMap(value: StringMap | string | undefined): boolean {
  return (
    value === undefined ||
    (typeof value === 'object' && Object.keys(value).length === 0)
  );
}

/**
 * Apply the JSON `body` text: blank omits the property; invalid JSON keeps the
 * last valid value (`prior`) — the JSON-textarea convention (§6) shared with the
 * schema fields and `set`'s json type; otherwise the parsed value is stored,
 * which may be any JSON (object, array, or a bare scalar/`null`).
 */
function applyBody(
  withValue: CallHttpTask['with'],
  raw: string,
  prior: unknown,
): void {
  const parsed = parseJsonField(raw);
  if (!parsed.valid) {
    if (prior !== undefined) {
      withValue.body = prior;
    } else {
      delete withValue.body;
    }
    return;
  }
  if (parsed.value === undefined) {
    delete withValue.body; // blank
  } else {
    withValue.body = parsed.value;
  }
}

/**
 * Merge the form's edited URI text back onto the loaded endpoint, preserving its
 * shape rather than rebuilding it from scratch:
 * - A **bare-string** endpoint (URI template or runtime expression) stays a bare
 *   string — an unchanged endpoint isn't re-wrapped into `{ uri: … }` (which was
 *   pure on-disk diff noise) and an edited one isn't needlessly promoted to the
 *   object form.
 * - An **object** endpoint is spread so only `uri` is overwritten and no other
 *   key is silently dropped. The schema's endpoint object permits *only* `uri`
 *   (`unevaluatedProperties: false`), so for valid input this is exactly
 *   `{ uri }`; the spread is defensive — if hand-authored YAML carries an extra
 *   key we don't quietly discard it, we let the Save validator flag it (§4).
 * `endpointText` (used on read) collapses both shapes to the same string, so this
 * is the only place the original shape is reconstructed.
 */
function nextEndpoint(prior: Endpoint, uri: string): Endpoint {
  return typeof prior === 'object' && prior !== null ? { ...prior, uri } : uri;
}
