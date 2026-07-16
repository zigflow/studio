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
  WaitTask,
} from '../types/zigflow';
import {
  parseDurationField,
  parseSetValue,
  readForForm,
  readHttpForm,
  readSetEntries,
  readSwitchCases,
  readWaitForm,
  thenOptions,
  writeForTask,
  writeHttpTask,
  writeSetTask,
  writeSwitchTask,
  writeWaitTask,
} from './inspectorForms';

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
