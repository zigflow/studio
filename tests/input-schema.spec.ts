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
// Input schema — pure logic tests (no browser, no filesystem).
//
// Covers two layers:
//   1. parseWorkflowFile / exportToYaml round-trips (schema.document in IR)
//   2. input-schema helpers (parseSchemaDocument / buildSchemaDocument / validateFields)
//
// All workflow data is defined inline — no disk reads.
import { expect, test } from '@playwright/test';

import { exportToYaml } from '../src/lib/export/yaml';
import type { WorkflowFile } from '../src/lib/tasks/model';
import { parseWorkflowFile } from '../src/lib/tasks/parse';
import {
  buildSchemaDocument,
  parseSchemaDocument,
  validateFields,
} from '../src/lib/ui/input-schema';

// Deterministic ID factory for tests — avoids random UUIDs in assertions.
let _seq = 0;
function seqId(): string {
  return `id-${++_seq}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeYaml(extra: string = ''): string {
  return `document:
  dsl: "1.0.0"
  namespace: test
  name: test-workflow
  version: "0.0.1"
${extra}do:
  - test-workflow:
      do: []
`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('input schema — pure logic', () => {
  test('parses input.schema.document from YAML', () => {
    const content = makeYaml(`input:
  schema:
    format: json
    document:
      type: object
      properties:
        orderId:
          type: string
`);
    const { workflowFile } = parseWorkflowFile(content, 'test.yaml');

    expect(workflowFile.input.schema.format).toBe('json');
    expect(workflowFile.input.schema.document).toEqual({
      type: 'object',
      properties: { orderId: { type: 'string' } },
    });
  });

  test('applies default input.schema when input key is absent', () => {
    const content = makeYaml();
    const { workflowFile } = parseWorkflowFile(content, 'test.yaml');

    expect(workflowFile.input.schema).toEqual({
      format: 'json',
      document: { type: 'object', properties: {} },
    });
  });

  test('applies default input.schema.document when schema.document is absent', () => {
    const content = makeYaml(`input:
  schema:
    format: json
`);
    const { workflowFile } = parseWorkflowFile(content, 'test.yaml');

    expect(workflowFile.input.schema.format).toBe('json');
    expect(workflowFile.input.schema.document).toEqual({
      type: 'object',
      properties: {},
    });
  });

  test('input.schema.document update is reflected in WorkflowFile', () => {
    const content = makeYaml(`input:
  schema:
    format: json
    document:
      type: object
      properties: {}
`);
    const { workflowFile } = parseWorkflowFile(content, 'test.yaml');

    const updated: WorkflowFile = {
      ...workflowFile,
      input: {
        schema: {
          format: workflowFile.input.schema.format,
          document: {
            type: 'object',
            properties: { newField: { type: 'string' } },
          },
        },
      },
    };

    expect(updated.input.schema.document).toEqual({
      type: 'object',
      properties: { newField: { type: 'string' } },
    });
    // Original is unchanged (immutable update).
    expect(workflowFile.input.schema.document).toEqual({
      type: 'object',
      properties: {},
    });
  });

  test('export preserves input.schema structure', () => {
    const content = makeYaml(`input:
  schema:
    format: json
    document:
      type: object
      properties:
        orderId:
          type: string
`);
    const { workflowFile } = parseWorkflowFile(content, 'test.yaml');
    const result = exportToYaml(workflowFile);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.yaml).toContain('input:');
    expect(result.yaml).toContain('schema:');
    expect(result.yaml).toContain('format: json');
    expect(result.yaml).toContain('type: object');
    expect(result.yaml).toContain('orderId:');
  });

  test('export includes default input.schema when none was in source', () => {
    const content = makeYaml();
    const { workflowFile } = parseWorkflowFile(content, 'test.yaml');
    const result = exportToYaml(workflowFile);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.yaml).toContain('input:');
    expect(result.yaml).toContain('schema:');
    expect(result.yaml).toContain('format: json');
  });

  test('export preserves updated input.schema.document', () => {
    const content = makeYaml();
    const { workflowFile } = parseWorkflowFile(content, 'test.yaml');

    const updated: WorkflowFile = {
      ...workflowFile,
      input: {
        schema: {
          format: 'json',
          document: {
            type: 'object',
            properties: { amount: { type: 'number' } },
          },
        },
      },
    };

    const result = exportToYaml(updated);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.yaml).toContain('amount:');
    expect(result.yaml).toContain('type: number');
  });
});

// ---------------------------------------------------------------------------
// Schema editor helpers — parseSchemaDocument / buildSchemaDocument / validate
// ---------------------------------------------------------------------------

test.describe('parseSchemaDocument', () => {
  test('parses properties into field rows', () => {
    _seq = 0;
    const doc = {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        amount: { type: 'number' },
      },
    };
    const fields = parseSchemaDocument(doc, seqId);

    expect(fields).toHaveLength(2);
    expect(fields[0]).toMatchObject({
      name: 'orderId',
      type: 'string',
      required: false,
    });
    expect(fields[1]).toMatchObject({
      name: 'amount',
      type: 'number',
      required: false,
    });
  });

  test('marks required fields', () => {
    _seq = 0;
    const doc = {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        amount: { type: 'number' },
      },
      required: ['orderId'],
    };
    const fields = parseSchemaDocument(doc, seqId);

    expect(fields[0]).toMatchObject({ name: 'orderId', required: true });
    expect(fields[1]).toMatchObject({ name: 'amount', required: false });
  });

  test('coerces unknown types to string', () => {
    _seq = 0;
    const doc = {
      type: 'object',
      properties: { x: { type: 'integer' } },
    };
    const fields = parseSchemaDocument(doc, seqId);

    expect(fields[0]).toMatchObject({ name: 'x', type: 'string' });
  });

  test('returns empty array for empty properties', () => {
    const doc = { type: 'object', properties: {} };
    expect(parseSchemaDocument(doc, seqId)).toHaveLength(0);
  });

  test('returns empty array when properties key is missing', () => {
    const doc = { type: 'object' };
    expect(parseSchemaDocument(doc, seqId)).toHaveLength(0);
  });
});

test.describe('buildSchemaDocument', () => {
  test('builds properties from field rows', () => {
    const fields = [
      { id: 'a', name: 'orderId', type: 'string' as const, required: false },
      { id: 'b', name: 'amount', type: 'number' as const, required: false },
    ];
    const doc = buildSchemaDocument(fields);

    expect(doc).toEqual({
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        amount: { type: 'number' },
      },
    });
  });

  test('includes required array when fields are required', () => {
    const fields = [
      { id: 'a', name: 'orderId', type: 'string' as const, required: true },
      { id: 'b', name: 'amount', type: 'number' as const, required: false },
    ];
    const doc = buildSchemaDocument(fields);

    expect(doc['required']).toEqual(['orderId']);
    expect((doc['properties'] as Record<string, unknown>)['orderId']).toEqual({
      type: 'string',
    });
  });

  test('omits required array when no fields are required', () => {
    const fields = [
      { id: 'a', name: 'x', type: 'boolean' as const, required: false },
    ];
    const doc = buildSchemaDocument(fields);

    expect(doc['required']).toBeUndefined();
  });

  test('skips rows with empty names', () => {
    const fields = [
      { id: 'a', name: '', type: 'string' as const, required: false },
      { id: 'b', name: 'amount', type: 'number' as const, required: false },
    ];
    const doc = buildSchemaDocument(fields);
    const props = doc['properties'] as Record<string, unknown>;

    expect(Object.keys(props)).toEqual(['amount']);
  });

  test('round-trips through parse → build', () => {
    _seq = 0;
    const original = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        active: { type: 'boolean' },
      },
      required: ['name'],
    };
    const fields = parseSchemaDocument(original, seqId);
    const rebuilt = buildSchemaDocument(fields);

    expect(rebuilt).toEqual(original);
  });
});

test.describe('validateFields', () => {
  test('returns empty map for valid fields', () => {
    const fields = [
      { id: 'a', name: 'orderId', type: 'string' as const, required: false },
    ];
    expect(validateFields(fields).size).toBe(0);
  });

  test('flags empty name', () => {
    const fields = [
      { id: 'a', name: '', type: 'string' as const, required: false },
    ];
    const errors = validateFields(fields);

    expect(errors.get('a')).toBe('errorNameRequired');
  });

  test('flags duplicate names', () => {
    const fields = [
      { id: 'a', name: 'x', type: 'string' as const, required: false },
      { id: 'b', name: 'x', type: 'string' as const, required: false },
    ];
    const errors = validateFields(fields);

    expect(errors.has('a')).toBe(false); // first occurrence is fine
    expect(errors.get('b')).toBe('errorNameDuplicate');
  });

  test('trims names before dedup check', () => {
    const fields = [
      { id: 'a', name: ' x ', type: 'string' as const, required: false },
      { id: 'b', name: 'x', type: 'string' as const, required: false },
    ];
    const errors = validateFields(fields);

    expect(errors.get('b')).toBe('errorNameDuplicate');
  });
});

// ---------------------------------------------------------------------------
// Nested schema — object and array types
// ---------------------------------------------------------------------------

test.describe('parseSchemaDocument — nested', () => {
  test('parses nested object', () => {
    _seq = 0;
    const doc = {
      type: 'object',
      properties: {
        order: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
      },
    };
    const fields = parseSchemaDocument(doc, seqId);

    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ name: 'order', type: 'object' });
    expect(fields[0]!.children).toHaveLength(1);
    expect(fields[0]!.children![0]).toMatchObject({
      name: 'id',
      type: 'string',
    });
  });

  test('parses deeply nested object', () => {
    _seq = 0;
    const doc = {
      type: 'object',
      properties: {
        order: {
          type: 'object',
          properties: {
            pet: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
            },
          },
        },
      },
    };
    const fields = parseSchemaDocument(doc, seqId);

    const order = fields[0]!;
    expect(order.name).toBe('order');
    const pet = order.children![0]!;
    expect(pet.name).toBe('pet');
    expect(pet.children![0]).toMatchObject({ name: 'id', type: 'string' });
  });

  test('parses required flags on nested children', () => {
    _seq = 0;
    const doc = {
      type: 'object',
      properties: {
        order: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            total: { type: 'number' },
          },
          required: ['id'],
        },
      },
    };
    const fields = parseSchemaDocument(doc, seqId);

    const children = fields[0]!.children!;
    expect(children[0]).toMatchObject({ name: 'id', required: true });
    expect(children[1]).toMatchObject({ name: 'total', required: false });
  });

  test('parses array with scalar items', () => {
    _seq = 0;
    const doc = {
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' } },
      },
    };
    const fields = parseSchemaDocument(doc, seqId);

    expect(fields[0]).toMatchObject({ name: 'tags', type: 'array' });
    expect(fields[0]!.items).toMatchObject({ name: '', type: 'string' });
  });

  test('parses array with object items', () => {
    _seq = 0;
    const doc = {
      type: 'object',
      properties: {
        orders: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
          },
        },
      },
    };
    const fields = parseSchemaDocument(doc, seqId);

    const orders = fields[0]!;
    expect(orders.type).toBe('array');
    expect(orders.items).toMatchObject({ name: '', type: 'object' });
    expect(orders.items!.children![0]).toMatchObject({
      name: 'id',
      type: 'string',
    });
  });

  test('defaults items to string when items key is absent', () => {
    _seq = 0;
    const doc = {
      type: 'object',
      properties: {
        tags: { type: 'array' },
      },
    };
    const fields = parseSchemaDocument(doc, seqId);

    expect(fields[0]!.items).toMatchObject({ type: 'string' });
  });
});

test.describe('buildSchemaDocument — nested', () => {
  test('builds nested object', () => {
    const fields = [
      {
        id: 'a',
        name: 'order',
        type: 'object' as const,
        required: false,
        children: [
          { id: 'b', name: 'id', type: 'string' as const, required: false },
        ],
      },
    ];
    const doc = buildSchemaDocument(fields);

    expect(doc).toEqual({
      type: 'object',
      properties: {
        order: {
          type: 'object',
          properties: { id: { type: 'string' } },
        },
      },
    });
  });

  test('builds nested object with required children', () => {
    const fields = [
      {
        id: 'a',
        name: 'order',
        type: 'object' as const,
        required: false,
        children: [
          { id: 'b', name: 'id', type: 'string' as const, required: true },
          { id: 'c', name: 'note', type: 'string' as const, required: false },
        ],
      },
    ];
    const doc = buildSchemaDocument(fields);
    const orderDoc = (doc['properties'] as Record<string, unknown>)[
      'order'
    ] as Record<string, unknown>;

    expect(orderDoc['required']).toEqual(['id']);
  });

  test('builds array with scalar items', () => {
    const fields = [
      {
        id: 'a',
        name: 'tags',
        type: 'array' as const,
        required: false,
        items: { id: 'b', name: '', type: 'string' as const, required: false },
      },
    ];
    const doc = buildSchemaDocument(fields);

    expect(doc).toEqual({
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' } },
      },
    });
  });

  test('builds array with object items', () => {
    const fields = [
      {
        id: 'a',
        name: 'orders',
        type: 'array' as const,
        required: false,
        items: {
          id: 'b',
          name: '',
          type: 'object' as const,
          required: false,
          children: [
            { id: 'c', name: 'id', type: 'string' as const, required: false },
          ],
        },
      },
    ];
    const doc = buildSchemaDocument(fields);

    expect(doc).toEqual({
      type: 'object',
      properties: {
        orders: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
        },
      },
    });
  });

  test('round-trips nested schema through parse → build', () => {
    _seq = 0;
    const original = {
      type: 'object',
      properties: {
        order: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            total: { type: 'number' },
          },
          required: ['id'],
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    };
    const fields = parseSchemaDocument(original, seqId);
    const rebuilt = buildSchemaDocument(fields);

    expect(rebuilt).toEqual(original);
  });
});

test.describe('validateFields — nested', () => {
  test('validates child fields independently per level', () => {
    const fields = [
      {
        id: 'a',
        name: 'order',
        type: 'object' as const,
        required: false,
        children: [
          { id: 'b', name: 'id', type: 'string' as const, required: false },
          { id: 'c', name: 'id', type: 'string' as const, required: false }, // duplicate at child level
        ],
      },
      {
        id: 'd',
        name: 'id', // same name as children but at different level — no error
        type: 'string' as const,
        required: false,
      },
    ];
    const errors = validateFields(fields);

    expect(errors.has('a')).toBe(false);
    expect(errors.has('b')).toBe(false); // first occurrence at child level is fine
    expect(errors.get('c')).toBe('errorNameDuplicate');
    expect(errors.has('d')).toBe(false); // same name at parent level is fine
  });

  test('flags empty child field names', () => {
    const fields = [
      {
        id: 'a',
        name: 'order',
        type: 'object' as const,
        required: false,
        children: [
          { id: 'b', name: '', type: 'string' as const, required: false },
        ],
      },
    ];
    const errors = validateFields(fields);

    expect(errors.get('b')).toBe('errorNameRequired');
  });

  test('validates items children', () => {
    const fields = [
      {
        id: 'a',
        name: 'orders',
        type: 'array' as const,
        required: false,
        items: {
          id: 'b',
          name: '',
          type: 'object' as const,
          required: false,
          children: [
            { id: 'c', name: 'x', type: 'string' as const, required: false },
            { id: 'd', name: 'x', type: 'string' as const, required: false }, // duplicate
          ],
        },
      },
    ];
    const errors = validateFields(fields);

    expect(errors.has('c')).toBe(false);
    expect(errors.get('d')).toBe('errorNameDuplicate');
  });
});
