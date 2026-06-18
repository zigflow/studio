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
// Pure helpers for the value source selector.
//
// No UI dependencies — importable from tests and non-UI contexts.
//
// A "value source" describes how a stored string value should be
// interpreted and edited:
//
//   input      — `${ $input.<path> }` — path selected from the input schema
//   expression — `${ ... }` (any expression that is not a plain $input path)
//   literal    — anything else; stored verbatim

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The three mutually-exclusive sources a value can come from. */
export type ValueSource = 'input' | 'literal' | 'expression';

// ---------------------------------------------------------------------------
// Regex
// ---------------------------------------------------------------------------

// Matches exactly `${ $input.<path> }` where <path> is a dot-notation
// identifier (letters, digits, underscores, dots). Captures the path in
// group 1. Deliberately excludes complex expressions (spaces, operators) so
// that values like `${ $input.a == true }` are not misclassified as `input`.
const INPUT_RE = /^\$\{\s*\$input\.([\w.]+)\s*\}$/;

// Matches any `${ ... }` expression.
const EXPRESSION_RE = /^\$\{[^}]+\}$/;

// ---------------------------------------------------------------------------
// Detect
// ---------------------------------------------------------------------------

/**
 * Infer the ValueSource from a stored string value.
 *
 * - `${ $input.<path> }` → `'input'`
 * - `${ ... }`           → `'expression'`
 * - anything else        → `'literal'`
 */
export function detectSource(value: string): ValueSource {
  if (INPUT_RE.test(value)) return 'input';
  if (EXPRESSION_RE.test(value)) return 'expression';
  return 'literal';
}

// ---------------------------------------------------------------------------
// Parse / build input values
// ---------------------------------------------------------------------------

/**
 * Extract the dot-path from an input expression.
 *
 * Returns the path string (e.g. `"hello.world"`) when the value is an input
 * expression, or an empty string otherwise.
 */
export function parseInputPath(value: string): string {
  const m = INPUT_RE.exec(value);
  return m ? m[1] : '';
}

/**
 * Build a stored value string from an input path.
 *
 * `"hello.world"` → `"${ $input.hello.world }"`
 */
export function buildInputValue(path: string): string {
  return `\${ $input.${path} }`;
}

// ---------------------------------------------------------------------------
// Resolve path type from schema document
// ---------------------------------------------------------------------------

/**
 * The subset of JSON Schema primitive types exposed as input type hints.
 */
export type InputPathType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array';

/**
 * Resolve the JSON Schema type of a dot-notation path within a schema document.
 *
 * Traversal rules:
 * - Each segment looks up `properties[segment]` on the current node.
 * - If a segment's type is `object`, traversal continues into that node.
 * - If a segment's type is `array` and items has `type: 'object'`, traversal
 *   continues into `items` for remaining segments.
 * - If a segment's type is `array` and it is the last segment, returns `'array'`.
 * - Any unsupported shape or missing key returns `null`.
 *
 * Does NOT implement full JSON Schema — only handles the subset produced by
 * `buildSchemaDocument`.
 */
export function resolveInputPathType(
  doc: Record<string, unknown>,
  path: string,
): InputPathType | null {
  if (!path) return null;

  const segments = path.split('.');
  let current: Record<string, unknown> = doc;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    const props = current['properties'];
    if (typeof props !== 'object' || props === null) return null;

    const field = (props as Record<string, unknown>)[segment];
    if (typeof field !== 'object' || field === null) return null;

    const fieldObj = field as Record<string, unknown>;
    const isLast = i === segments.length - 1;

    if (isLast) {
      const ft = fieldObj['type'];
      if (
        ft === 'string' ||
        ft === 'number' ||
        ft === 'boolean' ||
        ft === 'object' ||
        ft === 'array'
      ) {
        return ft;
      }
      return null;
    }

    // Not the last segment: traverse deeper.
    if (fieldObj['type'] === 'object') {
      current = fieldObj;
    } else if (fieldObj['type'] === 'array') {
      const items = fieldObj['items'];
      if (
        typeof items === 'object' &&
        items !== null &&
        (items as Record<string, unknown>)['type'] === 'object'
      ) {
        current = items as Record<string, unknown>;
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Extract paths from schema document
// ---------------------------------------------------------------------------

/**
 * Recursively collect all dot-notation paths from a JSON-Schema-subset
 * `object` document produced by `buildSchemaDocument`.
 *
 * Traversal rules:
 * - `object` properties are traversed recursively (as before).
 * - `array` with `object` items: the array path is included and item object
 *   properties are traversed using the array path as prefix (no `[]` syntax).
 * - `array` with primitive or array items: only the array path is included.
 *
 * Examples:
 * ```
 * { type: 'object', properties: { a: { type: 'string' }, b: { type: 'object', properties: { c: { type: 'number' } } } } }
 * → ["a", "b", "b.c"]
 *
 * { type: 'object', properties: { arr: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' } } } } } }
 * → ["arr", "arr.id"]
 * ```
 */
export function extractInputPaths(
  doc: Record<string, unknown>,
  prefix = '',
): string[] {
  const properties =
    typeof doc['properties'] === 'object' && doc['properties'] !== null
      ? (doc['properties'] as Record<string, unknown>)
      : {};

  const paths: string[] = [];
  for (const [key, def] of Object.entries(properties)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    paths.push(fullPath);
    if (typeof def === 'object' && def !== null) {
      const defObj = def as Record<string, unknown>;
      if (defObj['type'] === 'object') {
        paths.push(...extractInputPaths(defObj, fullPath));
      } else if (defObj['type'] === 'array') {
        const items = defObj['items'];
        if (
          typeof items === 'object' &&
          items !== null &&
          (items as Record<string, unknown>)['type'] === 'object'
        ) {
          paths.push(
            ...extractInputPaths(items as Record<string, unknown>, fullPath),
          );
        }
        // array of primitive or array of array: only the array path (already pushed)
      }
    }
  }
  return paths;
}
