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
import { ensureTaskIds, syncWorkflowType } from './mutations';

function workflow(): ZigflowWorkflow {
  return {
    document: {
      dsl: '1.0.0',
      taskQueue: 'q',
      workflowType: 'stale',
      version: '0.1.0',
    },
    do: [
      {
        first: {
          do: [
            // Already has an id — must be preserved.
            { child: { set: { a: 1 }, metadata: { __zigflow_id: 'keep-me' } } },
          ],
        },
      },
      { second: { do: [] } },
    ],
  };
}

describe('ensureTaskIds', () => {
  it('assigns ids only where missing and leaves existing ids alone', () => {
    const wf = workflow();
    ensureTaskIds(wf);

    const first = wf.do[0].first;
    const second = wf.do[1].second;
    if (!('do' in first)) {
      throw new Error('expected first task to be a do task');
    }
    const child = first.do[0].child;

    // Pre-existing id untouched.
    expect(child.metadata?.__zigflow_id).toBe('keep-me');
    // Missing ids filled in on every task, including nested containers.
    expect(typeof first.metadata?.__zigflow_id).toBe('string');
    expect(first.metadata?.__zigflow_id).not.toBe('');
    expect(typeof second.metadata?.__zigflow_id).toBe('string');
  });

  it('is idempotent', () => {
    const wf = workflow();
    ensureTaskIds(wf);
    const snapshot = JSON.stringify(wf);
    ensureTaskIds(wf);
    expect(JSON.stringify(wf)).toBe(snapshot);
  });
});

describe('syncWorkflowType', () => {
  it('derives workflowType from the first do entry and ignores the others', () => {
    const wf = workflow();
    syncWorkflowType(wf);
    expect(wf.document.workflowType).toBe('first');
  });

  it('leaves workflowType unchanged when the root do list is empty', () => {
    const wf = workflow();
    wf.do = [];
    syncWorkflowType(wf);
    expect(wf.document.workflowType).toBe('stale');
  });
});
