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

import type { ValidationError } from '../schema/validate';
import type { ZigflowWorkflow } from '../types/zigflow';
import {
  interpretSaveResponse,
  saveWorkflow,
  serializeWorkflow,
  taskHintFromPath,
  toSaveErrorDisplays,
} from './save';

function workflow(): ZigflowWorkflow {
  return {
    document: {
      dsl: '1.0.0',
      taskQueue: 'q',
      workflowType: 'main',
      version: '0.1.0',
    },
    do: [{ main: { do: [{ step: { set: { done: true } } }] } }],
  };
}

/** A minimal stand-in for `Response` that interpretSaveResponse accepts. */
function fakeResponse(
  ok: boolean,
  status: number,
  body: unknown,
  { throwOnJson = false } = {},
): { ok: boolean; status: number; json(): Promise<unknown> } {
  return {
    ok,
    status,
    json: () =>
      throwOnJson
        ? Promise.reject(new Error('bad json'))
        : Promise.resolve(body),
  };
}

describe('serializeWorkflow (dirty comparison)', () => {
  it('is stable for the same value and changes when the tree changes', () => {
    const a = workflow();
    const saved = serializeWorkflow(a);
    expect(serializeWorkflow(workflow())).toBe(saved); // clean: matches disk

    a.do.push({ extra: { set: { x: 1 } } });
    expect(serializeWorkflow(a)).not.toBe(saved); // an edit => dirty

    a.do.pop();
    expect(serializeWorkflow(a)).toBe(saved); // undo back to saved => clean again
  });
});

describe('taskHintFromPath', () => {
  it('extracts the innermost task/case name after a numeric segment', () => {
    expect(
      taskHintFromPath('/do/0/orderProcessing/do/2/fulfilOrder/with/method'),
    ).toBe('fulfilOrder');
    expect(taskHintFromPath('/do/0/main/switch/1/electronic/then')).toBe(
      'electronic',
    );
  });

  it('returns null for document-level and root paths', () => {
    expect(taskHintFromPath('/document/dsl')).toBeNull();
    expect(taskHintFromPath('/')).toBeNull();
    expect(taskHintFromPath('')).toBeNull();
  });

  it('unescapes JSON Pointer tokens', () => {
    expect(taskHintFromPath('/do/0/a~1b/set')).toBe('a/b');
  });
});

describe('toSaveErrorDisplays', () => {
  it('keeps the schema message/path and adds a task hint', () => {
    const errors: ValidationError[] = [
      {
        path: '/do/0/main/do/0/step/wait',
        keyword: 'minProperties',
        message:
          '/do/0/main/do/0/step/wait must NOT have fewer than 1 property',
        params: { limit: 1 },
      },
      {
        path: '/document',
        keyword: 'required',
        message: "/document must have required property 'dsl'",
        params: { missingProperty: 'dsl' },
      },
    ];
    expect(toSaveErrorDisplays(errors)).toEqual([
      {
        path: '/do/0/main/do/0/step/wait',
        message:
          '/do/0/main/do/0/step/wait must NOT have fewer than 1 property',
        taskHint: 'step',
      },
      {
        path: '/document',
        message: "/document must have required property 'dsl'",
        taskHint: null,
      },
    ]);
  });
});

describe('interpretSaveResponse', () => {
  it('maps 200 + workflow body to "saved"', async () => {
    const wf = workflow();
    const result = await interpretSaveResponse(fakeResponse(true, 200, wf));
    expect(result).toEqual({ kind: 'saved', workflow: wf });
  });

  it('maps 422 + errors to "invalid"', async () => {
    const errors: ValidationError[] = [
      {
        path: '/do',
        keyword: 'type',
        message: '/do must be array',
        params: {},
      },
    ];
    const result = await interpretSaveResponse(
      fakeResponse(false, 422, { message: 'nope', errors }),
    );
    expect(result).toEqual({ kind: 'invalid', errors });
  });

  it('maps a non-422 non-OK status to a distinct server error', async () => {
    const result = await interpretSaveResponse(
      fakeResponse(false, 500, { message: 'boom' }),
    );
    expect(result).toEqual({ kind: 'error', reason: 'server', status: 500 });
  });

  it('maps a 422 without a structured error list to a server error', async () => {
    const result = await interpretSaveResponse(
      fakeResponse(false, 422, { message: 'no list' }),
    );
    expect(result).toEqual({ kind: 'error', reason: 'server', status: 422 });
  });

  it('maps an unparseable OK body to a malformed error', async () => {
    const result = await interpretSaveResponse(
      fakeResponse(true, 200, null, { throwOnJson: true }),
    );
    expect(result).toEqual({ kind: 'error', reason: 'malformed', status: 200 });
  });
});

describe('saveWorkflow', () => {
  it('reports a network error when the request itself rejects', async () => {
    const fetchFn = (() =>
      Promise.reject(new Error('offline'))) as unknown as typeof fetch;
    const result = await saveWorkflow('demo', workflow(), fetchFn);
    expect(result).toEqual({ kind: 'error', reason: 'network' });
  });

  it('PUTs to the name-scoped endpoint and returns the saved workflow', async () => {
    const wf = workflow();
    const calls: Array<[string, RequestInit | undefined]> = [];
    const fetchFn = ((url: string, init?: RequestInit) => {
      calls.push([url, init]);
      return Promise.resolve(
        fakeResponse(true, 200, wf) as unknown as Response,
      );
    }) as unknown as typeof fetch;

    const result = await saveWorkflow('my demo', wf, fetchFn);

    expect(calls).toHaveLength(1);
    const [url, init] = calls[0];
    expect(url).toBe('/api/workflows/my%20demo');
    expect(init?.method).toBe('PUT');
    expect(result).toEqual({ kind: 'saved', workflow: wf });
  });
});
