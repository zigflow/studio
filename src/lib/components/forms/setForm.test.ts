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

import type { SetTask } from '../../types/zigflow';
import {
  type SetValueEntry,
  coerceSetValueForType,
  inferSetValueType,
  readSetEntries,
  writeSetTask,
} from './setForm';

describe('inferSetValueType (load-time inference, not the write path)', () => {
  it('maps each JS type to its selector type', () => {
    expect(inferSetValueType(true)).toBe('boolean');
    expect(inferSetValueType(42)).toBe('number');
    expect(inferSetValueType('hi')).toBe('string');
    // A string that *looks* like another type is still a string.
    expect(inferSetValueType('42')).toBe('string');
    expect(inferSetValueType('true')).toBe('string');
    // Objects and arrays both collapse to the single json type.
    expect(inferSetValueType([1, 2])).toBe('json');
    expect(inferSetValueType({ a: 1 })).toBe('json');
    // null has its own dedicated type.
    expect(inferSetValueType(null)).toBe('null');
  });
});

describe('set form read', () => {
  it('reads each value with an inferred type and editable string', () => {
    const set = {
      flag: true,
      count: 42,
      note: 'hi',
      literal: '42',
      nul: null,
      obj: { a: 1 },
      arr: [1, 2],
    };
    expect(readSetEntries(set)).toEqual([
      { key: 'flag', type: 'boolean', value: 'true' },
      { key: 'count', type: 'number', value: '42' },
      { key: 'note', type: 'string', value: 'hi' },
      { key: 'literal', type: 'string', value: '42' },
      { key: 'nul', type: 'null', value: '' },
      { key: 'obj', type: 'json', value: JSON.stringify({ a: 1 }, null, 2) },
      { key: 'arr', type: 'json', value: JSON.stringify([1, 2], null, 2) },
    ]);
  });
});

describe('set form write — type is explicit, never sniffed from content', () => {
  const task: SetTask = { set: {}, metadata: { __zigflow_id: 'id' } };
  // writeSetTask always yields the object form; narrow the `set` union for the
  // assertions below.
  const write = (entries: SetValueEntry[]) =>
    writeSetTask(task, entries).set as Record<string, unknown>;

  it('keeps a literal string "42" as the string "42" (the bug fix)', () => {
    const out = write([{ key: 'k', type: 'string', value: '42' }]);
    expect(out).toEqual({ k: '42' });
    expect(out.k).toBe('42');
    expect(typeof out.k).toBe('string');
  });

  it('keeps a literal string "true" as the string "true"', () => {
    const out = write([{ key: 'k', type: 'string', value: 'true' }]);
    expect(out.k).toBe('true');
    expect(typeof out.k).toBe('string');
  });

  it('serialises boolean as a real boolean', () => {
    expect(write([{ key: 'k', type: 'boolean', value: 'true' }]).k).toBe(true);
    expect(write([{ key: 'k', type: 'boolean', value: 'false' }]).k).toBe(
      false,
    );
  });

  it('serialises number as a real number', () => {
    const out = write([{ key: 'k', type: 'number', value: '42' }]);
    expect(out.k).toBe(42);
    expect(typeof out.k).toBe('number');
  });

  it('serialises json (object, array, or bare scalar) from its JSON text', () => {
    expect(write([{ key: 'k', type: 'json', value: '{"a":1}' }]).k).toEqual({
      a: 1,
    });
    expect(write([{ key: 'k', type: 'json', value: '[1,2]' }]).k).toEqual([
      1, 2,
    ]);
    // A bare scalar typed into the json editor is accepted, not blocked.
    expect(write([{ key: 'k', type: 'json', value: '42' }]).k).toBe(42);
  });

  it('serialises null as a real null', () => {
    const out = write([{ key: 'k', type: 'null', value: '' }]);
    expect(out).toEqual({ k: null });
    expect(out.k).toBeNull();
  });

  it('drops empty keys but keeps TaskBase (id)', () => {
    const written = writeSetTask(task, [
      { key: 'keep', type: 'string', value: 'x' },
      { key: '', type: 'string', value: 'ignored' },
    ]);
    expect(written.set).toEqual({ keep: 'x' });
    expect(written.metadata?.__zigflow_id).toBe('id');
  });

  it('round-trips every type through read → write unchanged', () => {
    const original = {
      s: 'literal',
      s42: '42',
      b: false,
      n: 3.5,
      o: { nested: true },
      a: ['x', 1],
    };
    const roundTripped = writeSetTask({ set: {} }, readSetEntries(original))
      .set as Record<string, unknown>;
    expect(roundTripped).toEqual(original);
  });

  it('keeps the last valid value while json is mid-edit invalid', () => {
    const prior: SetTask = { set: { k: { a: 1 } } };
    // Broken JSON in the textarea: the stored value stays the last valid one.
    const out = writeSetTask(prior, [
      { key: 'k', type: 'json', value: '{"a":' },
    ]).set as Record<string, unknown>;
    expect(out.k).toEqual({ a: 1 });
  });

  it('omits an invalid-JSON entry that has no prior value', () => {
    const out = writeSetTask({ set: {} }, [
      { key: 'k', type: 'json', value: '{bad' },
    ]).set;
    expect(out).toEqual({});
  });
});

describe('coerceSetValueForType (value on type change)', () => {
  it('best-effort converts scalars, keeps text for string', () => {
    expect(coerceSetValueForType('42', 'string', 'number')).toBe('42');
    expect(coerceSetValueForType('42', 'number', 'string')).toBe('42');
    expect(coerceSetValueForType('true', 'string', 'boolean')).toBe('true');
  });

  it('resets to the type default when conversion is not possible', () => {
    expect(coerceSetValueForType('abc', 'string', 'number')).toBe('0');
    expect(coerceSetValueForType('abc', 'string', 'boolean')).toBe('false');
  });

  it('clears the (unused) value when switching to null', () => {
    expect(coerceSetValueForType('42', 'number', 'null')).toBe('');
  });

  it('serializes the effective value when switching into json', () => {
    // A number pre-fills the JSON number — preserved, not reset.
    expect(coerceSetValueForType('42', 'number', 'json')).toBe('42');
    // A literal string keeps its string-ness as a JSON string.
    expect(coerceSetValueForType('42', 'string', 'json')).toBe('"42"');
    expect(coerceSetValueForType('hi', 'string', 'json')).toBe('"hi"');
    expect(coerceSetValueForType('true', 'boolean', 'json')).toBe('true');
    expect(coerceSetValueForType('', 'null', 'json')).toBe('null');
    // A fresh/blank scalar starts the json editor empty, not as `""`.
    expect(coerceSetValueForType('', 'string', 'json')).toBe('');
  });

  it('best-effort parses out of json to a scalar, else resets', () => {
    expect(coerceSetValueForType('42', 'json', 'number')).toBe('42');
    expect(coerceSetValueForType('{"a":1}', 'json', 'number')).toBe('0');
    // json → string keeps the raw text verbatim.
    expect(coerceSetValueForType('{"a":1}', 'json', 'string')).toBe('{"a":1}');
  });
});
