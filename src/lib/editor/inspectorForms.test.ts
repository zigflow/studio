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

import type {
  CallHttpTask,
  ForTask,
  SetTask,
  SwitchTask,
  Task,
  WaitTask,
} from '../types/zigflow';
import {
  type CommonFieldsForm,
  isInvalidJsonField,
  parseDurationField,
  parseJsonField,
  parseSetValue,
  readCommonFields,
  readForForm,
  readHttpForm,
  readMetadataEntries,
  readSetEntries,
  readSwitchCases,
  readWaitForm,
  thenOptions,
  writeCommonFields,
  writeForTask,
  writeHttpTask,
  writeSetTask,
  writeSwitchTask,
  writeThen,
  writeWaitTask,
} from './inspectorForms';

/** A minimal empty common-fields form, overridden per test. */
function emptyCommon(
  overrides: Partial<CommonFieldsForm> = {},
): CommonFieldsForm {
  return {
    if: '',
    inputSchema: '',
    outputAs: '',
    outputSchema: '',
    exportAs: '',
    exportSchema: '',
    heartbeat: {
      days: '',
      hours: '',
      minutes: '',
      seconds: '',
      milliseconds: '',
    },
    metadata: [],
    ...overrides,
  };
}

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

describe('set form', () => {
  it('round-trips object entries and drops empty keys', () => {
    const task: SetTask = {
      set: { validated: true, note: 'hi' },
      metadata: { __zigflow_id: 'id' },
    };
    const entries = readSetEntries(task.set as Record<string, unknown>);
    expect(entries).toEqual([
      { key: 'validated', value: 'true' },
      { key: 'note', value: 'hi' },
    ]);

    const written = writeSetTask(task, [
      ...entries,
      { key: '', value: 'ignored' },
    ]);
    expect(written.set).toEqual({ validated: true, note: 'hi' });
    // TaskBase (id) is preserved.
    expect(written.metadata?.__zigflow_id).toBe('id');
  });
});

describe('http form', () => {
  it('reads method/endpoint and preserves other with-fields on write', () => {
    const task: CallHttpTask = {
      call: 'http',
      with: {
        method: 'GET',
        endpoint: { uri: 'https://a.example' },
        headers: { 'x-test': '1' },
      },
      then: 'end',
    };
    expect(readHttpForm(task)).toEqual({
      method: 'GET',
      endpoint: 'https://a.example',
    });

    const written = writeHttpTask(task, {
      method: 'POST',
      endpoint: 'https://b.example',
    });
    expect(written.with.method).toBe('POST');
    expect(written.with.endpoint).toEqual({ uri: 'https://b.example' });
    // Untouched fields preserved.
    expect(written.with.headers).toEqual({ 'x-test': '1' });
    expect(written.then).toBe('end');
  });
});

describe('wait form', () => {
  it('round-trips a duration and only writes non-empty fields', () => {
    const task: WaitTask = { wait: { minutes: 1, seconds: 30 } };
    const form = readWaitForm(task);
    expect(form).toEqual({
      mode: 'duration',
      days: '',
      hours: '',
      minutes: '1',
      seconds: '30',
      milliseconds: '',
    });
    expect(writeWaitTask(task, form).wait).toEqual({ minutes: 1, seconds: 30 });
  });

  it('handles the until form', () => {
    const task: WaitTask = { wait: { until: '2026-01-01T00:00:00Z' } };
    expect(readWaitForm(task)).toEqual({
      mode: 'until',
      until: '2026-01-01T00:00:00Z',
    });
    const written = writeWaitTask(task, { mode: 'until', until: 'X' });
    expect(written.wait).toEqual({ until: 'X' });
  });
});

describe('for form', () => {
  it('preserves the loop body and drops blank optional fields', () => {
    const task: ForTask = {
      for: { in: '${ .items }', each: 'item' },
      do: [{ step: { set: { a: 1 } } }],
    };
    expect(readForForm(task)).toEqual({
      in: '${ .items }',
      each: 'item',
      at: '',
      while: '',
    });

    const written = writeForTask(task, {
      in: '${ .rows }',
      each: '',
      at: 'idx',
      while: '',
    });
    expect(written.for).toEqual({ in: '${ .rows }', at: 'idx' });
    expect('while' in written).toBe(false);
    // The body is untouched.
    expect(written.do).toBe(task.do);
  });
});

describe('switch form', () => {
  it('offers directives then siblings for then', () => {
    expect(thenOptions(['ship', 'refund'])).toEqual([
      'continue',
      'exit',
      'end',
      'ship',
      'refund',
    ]);
  });

  it('round-trips cases and omits blank when / unnamed cases', () => {
    const task: SwitchTask = {
      switch: [
        { electronic: { when: '${ .card }', then: 'ship' } },
        { fallback: { then: 'continue' } },
      ],
    };
    expect(readSwitchCases(task)).toEqual([
      { name: 'electronic', when: '${ .card }', then: 'ship' },
      { name: 'fallback', when: '', then: 'continue' },
    ]);

    const written = writeSwitchTask(task, [
      { name: 'electronic', when: '${ .card }', then: 'ship' },
      { name: 'fallback', when: '', then: 'end' },
      { name: '', when: 'x', then: 'continue' },
    ]);
    expect(written.switch).toEqual([
      { electronic: { when: '${ .card }', then: 'ship' } },
      { fallback: { then: 'end' } },
    ]);
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

describe('common TaskBase fields', () => {
  it('round-trips if/input/output/export via read + write', () => {
    const task = {
      set: { x: 1 },
      if: '${ .ready }',
      input: { schema: { format: 'json' } },
      output: { as: '${ .result }', schema: { document: { type: 'object' } } },
      export: { as: { kept: true } },
      metadata: { __zigflow_id: 'id-1' },
    } as unknown as Task;

    const form = readCommonFields(task);
    expect(form.if).toBe('${ .ready }');
    expect(JSON.parse(form.inputSchema)).toEqual({ format: 'json' });
    expect(form.outputAs).toBe('${ .result }'); // expression kept as string
    expect(form.exportAs).toBe('{"kept":true}'); // object stringified

    const written = writeCommonFields(task, form);
    expect(written.if).toBe('${ .ready }');
    expect(written.input).toEqual({ schema: { format: 'json' } });
    expect(written.output).toEqual({
      as: '${ .result }',
      schema: { document: { type: 'object' } },
    });
    expect(written.export).toEqual({ as: { kept: true } }); // object round-trips
  });

  it('clears optional fields when blanked and drops empty containers', () => {
    const task = {
      set: { x: 1 },
      if: '${ .x }',
      input: { schema: { format: 'json' } },
      output: { as: 'a' },
    } as unknown as Task;
    const written = writeCommonFields(task, emptyCommon());
    expect('if' in written).toBe(false);
    expect('input' in written).toBe(false);
    expect('output' in written).toBe(false);
  });

  it('keeps the prior schema when the JSON text is invalid (no data loss)', () => {
    const task = {
      set: { x: 1 },
      input: { schema: { format: 'json' } },
    } as unknown as Task;
    const written = writeCommonFields(
      task,
      emptyCommon({ inputSchema: '{ not json' }),
    );
    expect(written.input).toEqual({ schema: { format: 'json' } });
  });

  it('parses output.as as object when it looks like one, else keeps a string', () => {
    const base = { set: { x: 1 } } as unknown as Task;
    expect(
      writeCommonFields(base, emptyCommon({ outputAs: '{"a":1}' })).output,
    ).toEqual({ as: { a: 1 } });
    expect(
      writeCommonFields(base, emptyCommon({ outputAs: '.foo' })).output,
    ).toEqual({ as: '.foo' });
  });
});

describe('metadata (heartbeat + generic key/value)', () => {
  it('reads only string entries, excluding __zigflow_id and heartbeat', () => {
    const meta = {
      __zigflow_id: 'id-1',
      heartbeat: { seconds: 30 },
      owner: 'ops',
      retries: 3, // non-string -> not surfaced
    };
    expect(readMetadataEntries(meta)).toEqual([{ key: 'owner', value: 'ops' }]);
  });

  it('preserves __zigflow_id and non-string entries; edits string kv + heartbeat', () => {
    const task = {
      set: { x: 1 },
      metadata: { __zigflow_id: 'id-1', retries: 3, owner: 'ops' },
    } as unknown as Task;
    const written = writeCommonFields(
      task,
      emptyCommon({
        heartbeat: {
          days: '',
          hours: '',
          minutes: '',
          seconds: '30',
          milliseconds: '',
        },
        metadata: [
          { key: 'owner', value: 'sre' },
          { key: 'team', value: 'core' },
        ],
      }),
    );
    expect(written.metadata).toEqual({
      __zigflow_id: 'id-1', // preserved (§2.3)
      retries: 3, // non-string entry preserved untouched
      heartbeat: { seconds: 30 },
      owner: 'sre', // edited
      team: 'core', // added
    });
  });

  it('never lets the kv list overwrite __zigflow_id or heartbeat', () => {
    const task = {
      set: { x: 1 },
      metadata: { __zigflow_id: 'id-1' },
    } as unknown as Task;
    const written = writeCommonFields(
      task,
      emptyCommon({
        metadata: [
          { key: '__zigflow_id', value: 'HACKED' },
          { key: 'heartbeat', value: 'x' },
        ],
      }),
    );
    expect(written.metadata).toEqual({ __zigflow_id: 'id-1' });
  });

  it('heartbeat keeps integers only (expressions dropped, per integer-only duration)', () => {
    const task = {
      set: { x: 1 },
      metadata: { __zigflow_id: 'id-1' },
    } as unknown as Task;
    const written = writeCommonFields(
      task,
      emptyCommon({
        heartbeat: {
          days: '',
          hours: '2',
          minutes: '${ .m }',
          seconds: '',
          milliseconds: '',
        },
      }),
    );
    expect(written.metadata).toEqual({
      __zigflow_id: 'id-1',
      heartbeat: { hours: 2 },
    });
  });
});

describe('writeThen', () => {
  it('drops then for the continue default and sets it otherwise', () => {
    const task = { set: { x: 1 }, then: 'exit' } as unknown as Task;
    expect('then' in writeThen(task, 'continue')).toBe(false);
    expect(writeThen(task, 'end').then).toBe('end');
    expect(writeThen(task, 'ship').then).toBe('ship');
  });
});
