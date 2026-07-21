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
import { describe, expect, it } from 'vitest';

import {
  isInvalidJsonField,
  parseDurationField,
  parseJsonField,
  parseSetValue,
} from './formValues';

describe('parseSetValue', () => {
  it('parses JSON primitives but keeps expressions/plain strings verbatim', () => {
    expect(parseSetValue('true')).toBe(true);
    expect(parseSetValue('42')).toBe(42);
    expect(parseSetValue('"x"')).toBe('x');
    expect(parseSetValue('${ .order.total }')).toBe('${ .order.total }');
    expect(parseSetValue('')).toBe('');
  });
});

describe('parseDurationField', () => {
  it('omits blanks, parses integers, keeps expressions', () => {
    expect(parseDurationField('  ')).toBeUndefined();
    expect(parseDurationField('30')).toBe(30);
    expect(parseDurationField('${ .n }')).toBe('${ .n }');
  });
});

describe('parseJsonField / isInvalidJsonField', () => {
  it('treats blank as valid/undefined, parses JSON, flags bad JSON', () => {
    expect(parseJsonField('')).toEqual({ valid: true, value: undefined });
    expect(parseJsonField('  ')).toEqual({ valid: true, value: undefined });
    expect(parseJsonField('{"a":1}')).toEqual({ valid: true, value: { a: 1 } });
    expect(parseJsonField('{bad').valid).toBe(false);
    expect(isInvalidJsonField('')).toBe(false);
    expect(isInvalidJsonField('{bad')).toBe(true);
  });
});
