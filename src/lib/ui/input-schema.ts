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
// Pure helpers for the input schema editor.
//
// No UI dependencies — importable from tests and non-UI contexts.
//
// Scope: top-level properties with support for nested objects and arrays.
// Array-of-array nesting is intentionally not exposed in the UI.

export type SchemaFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array';

export type SchemaField = {
  /** Stable internal key used for Svelte keying. Not part of schema.document. */
  id: string;
  name: string;
  type: SchemaFieldType;
  required: boolean;
  /** Child fields — only present when type === 'object'. */
  children?: SchemaField[];
  /** Items definition — only present when type === 'array'. */
  items?: SchemaField;
};

/** Map from field id → i18n error key for rows that have a validation error. */
export type FieldErrors = Map<string, string>;

const ALLOWED_TYPES = new Set<string>([
  'string',
  'number',
  'boolean',
  'object',
  'array',
]);

function coerceFieldType(raw: unknown): SchemaFieldType {
  return ALLOWED_TYPES.has(String(raw)) ? (raw as SchemaFieldType) : 'string';
}

// ---------------------------------------------------------------------------
// Parse helpers
// ---------------------------------------------------------------------------

function parseFieldNode(
  name: string,
  def: Record<string, unknown>,
  isRequired: boolean,
  idGen: () => string,
): SchemaField {
  const type = coerceFieldType(def['type']);
  const field: SchemaField = { id: idGen(), name, type, required: isRequired };

  if (type === 'object') {
    const props =
      typeof def['properties'] === 'object' && def['properties'] !== null
        ? (def['properties'] as Record<string, unknown>)
        : {};
    const reqSet = new Set<string>(
      Array.isArray(def['required']) ? (def['required'] as string[]) : [],
    );
    field.children = Object.entries(props).map(([k, v]) =>
      parseFieldNode(
        k,
        (typeof v === 'object' && v !== null ? v : {}) as Record<
          string,
          unknown
        >,
        reqSet.has(k),
        idGen,
      ),
    );
  }

  if (type === 'array') {
    const itemsDef =
      typeof def['items'] === 'object' && def['items'] !== null
        ? (def['items'] as Record<string, unknown>)
        : { type: 'string' };
    field.items = parseFieldNode('', itemsDef, false, idGen);
  }

  return field;
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

/**
 * Parse `input.schema.document` into a field tree.
 *
 * Unknown types are coerced to `'string'`.
 *
 * @param idGen  Optional ID factory — supply a deterministic stub in tests.
 */
export function parseSchemaDocument(
  doc: Record<string, unknown>,
  idGen: () => string = () => crypto.randomUUID(),
): SchemaField[] {
  const properties =
    typeof doc['properties'] === 'object' && doc['properties'] !== null
      ? (doc['properties'] as Record<string, unknown>)
      : {};

  const requiredSet = new Set<string>(
    Array.isArray(doc['required']) ? (doc['required'] as string[]) : [],
  );

  return Object.entries(properties).map(([name, def]) =>
    parseFieldNode(
      name,
      (typeof def === 'object' && def !== null ? def : {}) as Record<
        string,
        unknown
      >,
      requiredSet.has(name),
      idGen,
    ),
  );
}

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

function collectErrors(fields: SchemaField[], errors: FieldErrors): void {
  const seen = new Set<string>();
  for (const field of fields) {
    const trimmed = field.name.trim();
    if (!trimmed) {
      errors.set(field.id, 'errorNameRequired');
    } else if (seen.has(trimmed)) {
      errors.set(field.id, 'errorNameDuplicate');
    } else {
      seen.add(trimmed);
    }
    // Recurse into object children
    if (field.children) collectErrors(field.children, errors);
    // Recurse into items children (when items is an object)
    if (field.items?.children) collectErrors(field.items.children, errors);
  }
}

/**
 * Return a map of field id → i18n error key for invalid rows.
 * An empty map means all rows are valid. Validates each nesting level
 * independently (names must be unique per level).
 */
export function validateFields(fields: SchemaField[]): FieldErrors {
  const errors: FieldErrors = new Map();
  collectErrors(fields, errors);
  return errors;
}

// ---------------------------------------------------------------------------
// Build helpers
// ---------------------------------------------------------------------------

function buildFieldDoc(field: SchemaField): Record<string, unknown> {
  if (field.type === 'object') {
    const properties: Record<string, Record<string, unknown>> = {};
    const required: string[] = [];
    for (const child of field.children ?? []) {
      const name = child.name.trim();
      if (!name) continue;
      properties[name] = buildFieldDoc(child);
      if (child.required) required.push(name);
    }
    const doc: Record<string, unknown> = { type: 'object', properties };
    if (required.length > 0) doc['required'] = required;
    return doc;
  }

  if (field.type === 'array') {
    const itemsDef = field.items
      ? buildFieldDoc(field.items)
      : { type: 'string' };
    return { type: 'array', items: itemsDef };
  }

  return { type: field.type };
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

/**
 * Convert a field tree back into an `input.schema.document` object.
 *
 * Rules:
 * - Rows with an empty name are skipped (they are in-progress edits).
 * - `required` array is only emitted when non-empty.
 * - Output structure matches the Zigflow DSL input.schema block exactly.
 */
export function buildSchemaDocument(
  fields: SchemaField[],
): Record<string, unknown> {
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];

  for (const field of fields) {
    const name = field.name.trim();
    if (!name) continue;
    properties[name] = buildFieldDoc(field);
    if (field.required) required.push(name);
  }

  const doc: Record<string, unknown> = { type: 'object', properties };
  if (required.length > 0) doc['required'] = required;
  return doc;
}

// ---------------------------------------------------------------------------
// Deep mutation helpers (used by SchemaEditor)
// ---------------------------------------------------------------------------

/**
 * Apply `fn` to the field with the given id anywhere in the tree.
 * Returns a new fields array (immutable).
 */
export function mapFieldDeep(
  fields: SchemaField[],
  id: string,
  fn: (f: SchemaField) => SchemaField,
): SchemaField[] {
  return fields.map((f) => {
    if (f.id === id) return fn(f);
    const result: SchemaField = { ...f };
    if (f.children) result.children = mapFieldDeep(f.children, id, fn);
    if (f.items) {
      if (f.items.id === id) {
        result.items = fn(f.items);
      } else {
        const newItems: SchemaField = { ...f.items };
        if (f.items.children)
          newItems.children = mapFieldDeep(f.items.children, id, fn);
        result.items = newItems;
      }
    }
    return result;
  });
}

/**
 * Remove the field with the given id from anywhere in the tree.
 */
export function deleteFieldDeep(
  fields: SchemaField[],
  id: string,
): SchemaField[] {
  return fields
    .filter((f) => f.id !== id)
    .map((f) => {
      const result: SchemaField = { ...f };
      if (f.children) result.children = deleteFieldDeep(f.children, id);
      if (f.items) {
        const newItems: SchemaField = { ...f.items };
        if (f.items.children)
          newItems.children = deleteFieldDeep(f.items.children, id);
        result.items = newItems;
      }
      return result;
    });
}

/**
 * Append a child field to the object field (or items object field) with the
 * given id.
 */
export function appendChildField(
  fields: SchemaField[],
  parentId: string,
  child: SchemaField,
): SchemaField[] {
  return mapFieldDeep(fields, parentId, (f) => ({
    ...f,
    children: [...(f.children ?? []), child],
  }));
}
