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
// value-source — pure logic tests (no browser, no filesystem).
//
// Covers detectSource, parseInputPath, buildInputValue, extractInputPaths.
// All data is defined inline.
import { expect, test } from '@playwright/test';

import {
  buildInputValue,
  detectSource,
  extractInputPaths,
  parseInputPath,
  resolveInputPathType,
} from '../src/lib/ui/value-source';

// ---------------------------------------------------------------------------
// detectSource
// ---------------------------------------------------------------------------

test.describe('detectSource', () => {
  test('detects input source for ${ $input.path }', () => {
    expect(detectSource('${ $input.items }')).toBe('input');
  });

  test('detects input source for nested path', () => {
    expect(detectSource('${ $input.user.name }')).toBe('input');
  });

  test('detects input source with extra whitespace', () => {
    expect(detectSource('${  $input.foo  }')).toBe('input');
  });

  test('detects expression for non-input ${ } expression', () => {
    expect(detectSource('${ $context.bar }')).toBe('expression');
  });

  test('detects expression for complex expression', () => {
    expect(detectSource('${ $input.a + $context.b }')).toBe('expression');
  });

  test('detects literal for plain string', () => {
    expect(detectSource('hello')).toBe('literal');
  });

  test('detects literal for empty string', () => {
    expect(detectSource('')).toBe('literal');
  });

  test('detects literal for string that looks like a path', () => {
    expect(detectSource('input.items')).toBe('literal');
  });

  test('detects literal for $input without braces', () => {
    expect(detectSource('$input.items')).toBe('literal');
  });
});

// ---------------------------------------------------------------------------
// parseInputPath
// ---------------------------------------------------------------------------

test.describe('parseInputPath', () => {
  test('extracts path from input expression', () => {
    expect(parseInputPath('${ $input.items }')).toBe('items');
  });

  test('extracts nested path', () => {
    expect(parseInputPath('${ $input.user.name }')).toBe('user.name');
  });

  test('returns empty string for expression source', () => {
    expect(parseInputPath('${ $context.bar }')).toBe('');
  });

  test('returns empty string for literal', () => {
    expect(parseInputPath('hello')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// buildInputValue
// ---------------------------------------------------------------------------

test.describe('buildInputValue', () => {
  test('builds ${ $input.path } from path', () => {
    expect(buildInputValue('items')).toBe('${ $input.items }');
  });

  test('builds nested path expression', () => {
    expect(buildInputValue('user.name')).toBe('${ $input.user.name }');
  });

  test('round-trips: build then parse returns original path', () => {
    const path = 'order.items';
    expect(parseInputPath(buildInputValue(path))).toBe(path);
  });
});

// ---------------------------------------------------------------------------
// extractInputPaths
// ---------------------------------------------------------------------------

test.describe('extractInputPaths', () => {
  test('returns empty array for empty document', () => {
    expect(extractInputPaths({ type: 'object', properties: {} })).toEqual([]);
  });

  test('returns top-level scalar paths', () => {
    const doc = {
      type: 'object',
      properties: {
        items: { type: 'array' },
        count: { type: 'number' },
      },
    };
    expect(extractInputPaths(doc)).toEqual(['items', 'count']);
  });

  test('includes nested object paths', () => {
    const doc = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
        },
      },
    };
    expect(extractInputPaths(doc)).toEqual(['user', 'user.name', 'user.age']);
  });

  test('array of primitive — includes only the array path', () => {
    const doc = {
      type: 'object',
      properties: {
        arr: { type: 'array', items: { type: 'string' } },
      },
    };
    expect(extractInputPaths(doc)).toEqual(['arr']);
  });

  test('array of object — includes array path and item property paths', () => {
    const doc = {
      type: 'object',
      properties: {
        arr: {
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
    expect(extractInputPaths(doc)).toEqual(['arr', 'arr.id']);
  });

  test('array of object with nested object — traverses nested object properties', () => {
    const doc = {
      type: 'object',
      properties: {
        arr: {
          type: 'array',
          items: {
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
      },
    };
    expect(extractInputPaths(doc)).toEqual(['arr', 'arr.pet', 'arr.pet.id']);
  });

  test('array of array — includes only the array path', () => {
    const doc = {
      type: 'object',
      properties: {
        arr: {
          type: 'array',
          items: { type: 'array', items: { type: 'string' } },
        },
      },
    };
    expect(extractInputPaths(doc)).toEqual(['arr']);
  });

  test('handles mixed top-level and nested fields', () => {
    const doc = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        address: {
          type: 'object',
          properties: {
            city: { type: 'string' },
            zip: { type: 'string' },
          },
        },
        tags: { type: 'array' },
      },
    };
    expect(extractInputPaths(doc)).toEqual([
      'name',
      'address',
      'address.city',
      'address.zip',
      'tags',
    ]);
  });

  test('handles document without properties key', () => {
    expect(extractInputPaths({ type: 'object' })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Value storage round-trips (spec requirements)
// ---------------------------------------------------------------------------

test.describe('value storage round-trips', () => {
  test('select input path → stores ${ $input.* }', () => {
    const path = 'hello.world';
    const stored = buildInputValue(path);
    expect(stored).toBe('${ $input.hello.world }');
    expect(detectSource(stored)).toBe('input');
    expect(parseInputPath(stored)).toBe(path);
  });

  test('enter literal → stored unchanged', () => {
    const literal = 'input.data';
    expect(detectSource(literal)).toBe('literal');
    // A literal value is stored as-is — no transformation.
    expect(literal).toBe('input.data');
  });

  test('enter expression → stored unchanged', () => {
    const expr = '${ $input.foo + $context.bar }';
    expect(detectSource(expr)).toBe('expression');
    // An expression is stored verbatim — no transformation.
    expect(expr).toBe('${ $input.foo + $context.bar }');
  });
});

// ---------------------------------------------------------------------------
// resolveInputPathType
// ---------------------------------------------------------------------------

const SCHEMA = {
  type: 'object',
  properties: {
    fast: { type: 'boolean' },
    count: { type: 'number' },
    userId: { type: 'string' },
    hello: {
      type: 'object',
      properties: {
        world: { type: 'boolean' },
        deep: {
          type: 'object',
          properties: {
            val: { type: 'number' },
          },
        },
      },
    },
    arr: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          score: { type: 'number' },
        },
      },
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
    },
  },
};

test.describe('resolveInputPathType', () => {
  test('top-level boolean', () => {
    expect(resolveInputPathType(SCHEMA, 'fast')).toBe('boolean');
  });

  test('top-level number', () => {
    expect(resolveInputPathType(SCHEMA, 'count')).toBe('number');
  });

  test('top-level string', () => {
    expect(resolveInputPathType(SCHEMA, 'userId')).toBe('string');
  });

  test('object node itself returns object', () => {
    expect(resolveInputPathType(SCHEMA, 'hello')).toBe('object');
  });

  test('nested object property', () => {
    expect(resolveInputPathType(SCHEMA, 'hello.world')).toBe('boolean');
  });

  test('deeply nested object property', () => {
    expect(resolveInputPathType(SCHEMA, 'hello.deep.val')).toBe('number');
  });

  test('array node itself returns array', () => {
    expect(resolveInputPathType(SCHEMA, 'arr')).toBe('array');
  });

  test('array of object: nested string property', () => {
    expect(resolveInputPathType(SCHEMA, 'arr.id')).toBe('string');
  });

  test('array of object: nested number property', () => {
    expect(resolveInputPathType(SCHEMA, 'arr.score')).toBe('number');
  });

  test('array of primitive with nested path returns null', () => {
    expect(resolveInputPathType(SCHEMA, 'tags.name')).toBeNull();
  });

  test('unknown top-level path returns null', () => {
    expect(resolveInputPathType(SCHEMA, 'missing')).toBeNull();
  });

  test('unknown nested path returns null', () => {
    expect(resolveInputPathType(SCHEMA, 'hello.missing')).toBeNull();
  });

  test('empty path returns null', () => {
    expect(resolveInputPathType(SCHEMA, '')).toBeNull();
  });

  test('empty schema returns null', () => {
    expect(resolveInputPathType({}, 'fast')).toBeNull();
  });
});
