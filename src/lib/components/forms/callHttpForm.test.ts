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

import { validateWorkflow } from '../../schema/validate';
import type { CallHttpTask, Task, ZigflowWorkflow } from '../../types/zigflow';
import {
  type HttpForm,
  entriesToMap,
  inferMethodOption,
  isMapField,
  mapToEntries,
  readHttpForm,
  writeHttpTask,
} from './callHttpForm';

/** Wrap a task in a minimal, otherwise-valid workflow for validation. */
function shell(task: Task): ZigflowWorkflow {
  return {
    document: {
      dsl: '1.0.0',
      taskQueue: 'q',
      workflowType: 'main',
      version: '0.1.0',
    },
    do: [{ main: { do: [{ node: task }] } }],
  };
}

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
      output: 'content', // schema default when absent
      redirect: false,
      body: '',
      headers: { 'x-test': '1' },
      query: undefined,
    });

    const written = writeHttpTask(task, {
      ...readHttpForm(task),
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

// Regression coverage for the endpoint shape/diff-noise findings from the
// CallHttpForm audit: writeHttpTask must preserve the loaded endpoint's shape
// and never silently drop keys. NB the schema's endpoint object permits only
// `uri` (`unevaluatedProperties: false`), so the sibling-property cases are
// *defensive* transform contracts — Save validation, not this pure function,
// is what rejects an illegal sibling (see the clearing case below).
describe('http form — endpoint shape/sibling preservation', () => {
  it('preserves endpoint-object sibling properties across an unrelated method edit', () => {
    const task = {
      call: 'http',
      with: {
        method: 'GET',
        endpoint: { uri: 'https://x.example', authentication: 'basic-ref' },
      },
    } as unknown as CallHttpTask;
    // Edit method only; endpoint text is untouched.
    const written = writeHttpTask(task, {
      ...readHttpForm(task),
      method: 'POST',
    });
    expect(written.with.method).toBe('POST');
    expect(written.with.endpoint).toEqual({
      uri: 'https://x.example',
      authentication: 'basic-ref', // was silently dropped before the fix
    });
  });

  it('keeps a bare-string endpoint a bare string when its text is unchanged', () => {
    const template: CallHttpTask = {
      call: 'http',
      with: { method: 'GET', endpoint: 'https://api.example.com/v1/{id}' },
    };
    expect(
      writeHttpTask(template, { ...readHttpForm(template), method: 'POST' })
        .with.endpoint,
    ).toBe('https://api.example.com/v1/{id}'); // still bare, not { uri: … }

    const expression: CallHttpTask = {
      call: 'http',
      with: { method: 'GET', endpoint: '${ .cfg.url }' },
    };
    expect(
      writeHttpTask(expression, { ...readHttpForm(expression), method: 'POST' })
        .with.endpoint,
    ).toBe('${ .cfg.url }');
  });

  it('writes an edited bare-string endpoint back as a bare string', () => {
    const task: CallHttpTask = {
      call: 'http',
      with: { method: 'GET', endpoint: 'https://old.example' },
    };
    const written = writeHttpTask(task, {
      ...readHttpForm(task),
      endpoint: 'https://new.example',
    });
    expect(written.with.endpoint).toBe('https://new.example'); // bare, not re-wrapped
  });

  it('writes an edited object endpoint, updating uri and keeping siblings', () => {
    const task = {
      call: 'http',
      with: {
        method: 'GET',
        endpoint: { uri: 'https://old.example', authentication: 'basic-ref' },
      },
    } as unknown as CallHttpTask;
    const written = writeHttpTask(task, {
      ...readHttpForm(task),
      endpoint: 'https://new.example',
    });
    expect(written.with.endpoint).toEqual({
      uri: 'https://new.example',
      authentication: 'basic-ref',
    });
  });

  it('clearing the endpoint is left for the single validator to reject, not special-cased', () => {
    const task: CallHttpTask = {
      call: 'http',
      with: { method: 'GET', endpoint: { uri: 'https://x.example' } },
    };
    const cleared = writeHttpTask(task, {
      ...readHttpForm(task),
      endpoint: '',
    });
    // No silent prevention: the empty uri is written through as-is…
    expect(cleared.with.endpoint).toEqual({ uri: '' });
    // …and surfaces as a normal schema error via the existing validator (§4).
    expect(validateWorkflow(shell(cleared)).valid).toBe(false);
  });
});

describe('inferMethodOption (load-time-only method-select inference)', () => {
  it('shows the matching option for a known method', () => {
    expect(inferMethodOption('GET')).toBe('GET');
    expect(inferMethodOption('POST')).toBe('POST');
    expect(inferMethodOption('TRACE')).toBe('TRACE');
  });

  it('shows Other for any non-matching value (exact match only)', () => {
    // Wrong case, custom verbs, the literal word "OTHER", and blank all fall to
    // the free-text escape hatch; the raw method text itself is untouched by
    // inference (it stays on the form/task and pre-fills the free-text field).
    expect(inferMethodOption('get')).toBe('other');
    expect(inferMethodOption('OTHER')).toBe('other');
    expect(inferMethodOption('PURGE')).toBe('other');
    expect(inferMethodOption('')).toBe('other');
  });
});

describe('http form — output / redirect / body (default/blank omits)', () => {
  const base: CallHttpTask = {
    call: 'http',
    with: { method: 'GET', endpoint: { uri: 'https://x.example' } },
  };
  // Apply a form patch over the read defaults and return the resulting `with`.
  const write = (patch: Partial<HttpForm>) =>
    writeHttpTask(base, { ...readHttpForm(base), ...patch }).with;

  it('reads a missing output as the content default and omits content on write', () => {
    expect(readHttpForm(base).output).toBe('content');
    expect('output' in write({ output: 'content' })).toBe(false);
  });

  it('writes output only for raw / response, and reads an explicit value', () => {
    expect(write({ output: 'raw' }).output).toBe('raw');
    expect(write({ output: 'response' }).output).toBe('response');
    const explicit = {
      call: 'http',
      with: { method: 'GET', endpoint: { uri: 'https://x' }, output: 'raw' },
    } as CallHttpTask;
    expect(readHttpForm(explicit).output).toBe('raw');
  });

  it('reads a missing redirect as false and omits it when unchecked', () => {
    expect(readHttpForm(base).redirect).toBe(false);
    expect('redirect' in write({ redirect: false })).toBe(false);
  });

  it('writes redirect: true only when checked, and reads an explicit true', () => {
    expect(write({ redirect: true }).redirect).toBe(true);
    const explicit = {
      call: 'http',
      with: { method: 'GET', endpoint: { uri: 'https://x' }, redirect: true },
    } as CallHttpTask;
    expect(readHttpForm(explicit).redirect).toBe(true);
  });

  it('reads a missing body as blank and omits it when blank', () => {
    expect(readHttpForm(base).body).toBe('');
    expect('body' in write({ body: '' })).toBe(false);
  });

  it('writes body as any JSON — object, array, or a bare scalar', () => {
    expect(write({ body: '{"a":1}' }).body).toEqual({ a: 1 });
    expect(write({ body: '[1,2]' }).body).toEqual([1, 2]);
    expect(write({ body: '42' }).body).toBe(42);
    expect(write({ body: '"hi"' }).body).toBe('hi');
  });

  it('round-trips a body value through read → write', () => {
    const task = {
      call: 'http',
      with: {
        method: 'GET',
        endpoint: { uri: 'https://x' },
        body: { a: [1, 2] },
      },
    } as CallHttpTask;
    expect(readHttpForm(task).body).toBe(
      JSON.stringify({ a: [1, 2] }, null, 2),
    );
    expect(writeHttpTask(task, readHttpForm(task)).with.body).toEqual({
      a: [1, 2],
    });
  });

  it('keeps the last valid body while the JSON is mid-edit invalid', () => {
    const prior = {
      call: 'http',
      with: {
        method: 'GET',
        endpoint: { uri: 'https://x' },
        body: { ok: true },
      },
    } as CallHttpTask;
    const out = writeHttpTask(prior, { ...readHttpForm(prior), body: '{bad' });
    expect(out.with.body).toEqual({ ok: true });
  });
});

describe('http form — headers / query maps', () => {
  const base: CallHttpTask = {
    call: 'http',
    with: { method: 'GET', endpoint: { uri: 'https://x.example' } },
  };
  const write = (patch: Partial<HttpForm>) =>
    writeHttpTask(base, { ...readHttpForm(base), ...patch }).with;

  it('entriesToMap builds a map, drops blank keys, and is last-wins on dupes', () => {
    expect(
      entriesToMap([
        { key: 'X-A', value: '1' },
        { key: 'X-B', value: '2' },
      ]),
    ).toEqual({ 'X-A': '1', 'X-B': '2' });
    // blank keys dropped
    expect(
      entriesToMap([
        { key: '', value: 'ignored' },
        { key: 'X-A', value: '1' },
      ]),
    ).toEqual({ 'X-A': '1' });
    // duplicate key → last value wins (a plain object naturally overwrites)
    expect(
      entriesToMap([
        { key: 'X-Custom', value: 'first' },
        { key: 'X-Custom', value: 'second' },
      ]),
    ).toEqual({ 'X-Custom': 'second' });
    // empty → undefined so the property is omitted
    expect(entriesToMap([])).toBeUndefined();
    expect(entriesToMap([{ key: '  ', value: 'x' }])).toBeUndefined();
  });

  it('mapToEntries / isMapField mirror the map-vs-expression split', () => {
    expect(mapToEntries({ 'X-A': '1' })).toEqual([{ key: 'X-A', value: '1' }]);
    expect(mapToEntries(undefined)).toEqual([]);
    expect(isMapField({ 'X-A': '1' })).toBe(true);
    expect(isMapField(undefined)).toBe(true); // absent → an empty map to fill in
    expect(isMapField('${ .headers }')).toBe(false); // expression form
  });

  it('round-trips a headers map and a query map through read → write', () => {
    const task = {
      call: 'http',
      with: {
        method: 'GET',
        endpoint: { uri: 'https://x' },
        headers: { 'X-A': '1', 'X-B': '2' },
        query: { q: 'search' },
      },
    } as CallHttpTask;
    const form = readHttpForm(task);
    expect(form.headers).toEqual({ 'X-A': '1', 'X-B': '2' });
    expect(form.query).toEqual({ q: 'search' });
    const out = writeHttpTask(task, form).with;
    expect(out.headers).toEqual({ 'X-A': '1', 'X-B': '2' });
    expect(out.query).toEqual({ q: 'search' });
  });

  it('passes an expression-string headers/query through unchanged', () => {
    const task = {
      call: 'http',
      with: {
        method: 'GET',
        endpoint: { uri: 'https://x' },
        headers: '${ .h }',
        query: '${ .q }',
      },
    } as CallHttpTask;
    const form = readHttpForm(task);
    expect(form.headers).toBe('${ .h }');
    expect(form.query).toBe('${ .q }');
    const out = writeHttpTask(task, form).with;
    expect(out.headers).toBe('${ .h }');
    expect(out.query).toBe('${ .q }');
  });

  it('omits headers/query when absent or an empty map', () => {
    expect('headers' in write({})).toBe(false); // absent stays absent
    expect('headers' in write({ headers: entriesToMap([]) })).toBe(false);
    expect('query' in write({ query: {} })).toBe(false); // explicit empty map normalized away
  });
});
