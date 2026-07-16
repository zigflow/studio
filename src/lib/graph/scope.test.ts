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

import type { ZigflowWorkflow } from '../types/zigflow';
import { ScopeResolutionError, findById, resolveScope } from './scope';

/**
 * A workflow whose root contains one `do` workflow with, in turn, a `do`, a
 * `for`, a `fork`, and a `try` container — one of each nesting kind, each with a
 * distinguishable child task.
 */
function workflow(): ZigflowWorkflow {
  return {
    document: {
      dsl: '1.0.0',
      taskQueue: 'q',
      workflowType: 'main',
      version: '0.1.0',
    },
    do: [
      {
        main: {
          do: [
            {
              seq: {
                do: [
                  {
                    inSeq: {
                      set: { v: 1 },
                      metadata: { __zigflow_id: 'in-seq' },
                    },
                  },
                ],
                metadata: { __zigflow_id: 'seq' },
              },
            },
            {
              loop: {
                for: { in: '${ .items }' },
                do: [
                  {
                    inLoop: {
                      set: { v: 2 },
                      metadata: { __zigflow_id: 'in-loop' },
                    },
                  },
                ],
                metadata: { __zigflow_id: 'loop' },
              },
            },
            {
              fan: {
                fork: {
                  branches: [
                    {
                      inFork: {
                        set: { v: 3 },
                        metadata: { __zigflow_id: 'in-fork' },
                      },
                    },
                  ],
                },
                metadata: { __zigflow_id: 'fan' },
              },
            },
            {
              guard: {
                try: [
                  {
                    inTry: {
                      set: { v: 4 },
                      metadata: { __zigflow_id: 'in-try' },
                    },
                  },
                ],
                catch: {
                  do: [
                    {
                      inCatch: {
                        set: { v: 5 },
                        metadata: { __zigflow_id: 'in-catch' },
                      },
                    },
                  ],
                },
                metadata: { __zigflow_id: 'guard' },
              },
            },
          ],
          metadata: { __zigflow_id: 'main' },
        },
      },
    ],
  };
}

describe('resolveScope', () => {
  it('resolves the root do list for an empty path', () => {
    const wf = workflow();
    const { list } = resolveScope(wf, []);
    expect(list).toBe(wf.do);
    expect(Object.keys(list[0])).toEqual(['main']);
  });

  it('resolves one level into a do body', () => {
    const wf = workflow();
    const { list } = resolveScope(wf, [
      { taskId: 'main', label: 'main', field: 'do' },
      { taskId: 'seq', label: 'seq', field: 'do' },
    ]);
    expect(list.map((n) => Object.keys(n)[0])).toEqual(['inSeq']);
  });

  it('resolves into a for body, a fork branches list, and a try body', () => {
    const wf = workflow();
    const base = { taskId: 'main', label: 'main', field: 'do' as const };

    const forScope = resolveScope(wf, [
      base,
      { taskId: 'loop', label: 'loop', field: 'do' },
    ]);
    expect(forScope.list.map((n) => Object.keys(n)[0])).toEqual(['inLoop']);

    const forkScope = resolveScope(wf, [
      base,
      { taskId: 'fan', label: 'fan', field: 'branches' },
    ]);
    expect(forkScope.list.map((n) => Object.keys(n)[0])).toEqual(['inFork']);

    const tryScope = resolveScope(wf, [
      base,
      { taskId: 'guard', label: 'guard', field: 'try' },
    ]);
    expect(tryScope.list.map((n) => Object.keys(n)[0])).toEqual(['inTry']);

    const catchScope = resolveScope(wf, [
      base,
      { taskId: 'guard', label: 'guard', field: 'catch' },
    ]);
    expect(catchScope.list.map((n) => Object.keys(n)[0])).toEqual(['inCatch']);
  });

  it('setList writes a replacement back into the tree', () => {
    const wf = workflow();
    const { setList } = resolveScope(wf, [
      { taskId: 'main', label: 'main', field: 'do' },
      { taskId: 'seq', label: 'seq', field: 'do' },
    ]);
    setList([{ replaced: { set: { v: 9 } } }]);

    const reread = resolveScope(wf, [
      { taskId: 'main', label: 'main', field: 'do' },
      { taskId: 'seq', label: 'seq', field: 'do' },
    ]);
    expect(reread.list.map((n) => Object.keys(n)[0])).toEqual(['replaced']);
  });

  it('throws a clear error when a step no longer resolves', () => {
    const wf = workflow();
    expect(() =>
      resolveScope(wf, [{ taskId: 'deleted', label: 'gone', field: 'do' }]),
    ).toThrow(ScopeResolutionError);
  });
});

describe('findById', () => {
  it('finds a deeply nested task with its name', () => {
    const wf = workflow();
    expect(findById(wf, 'in-catch')?.name).toBe('inCatch');
    expect(findById(wf, 'loop')?.name).toBe('loop');
    expect(findById(wf, 'missing')).toBeUndefined();
  });
});
