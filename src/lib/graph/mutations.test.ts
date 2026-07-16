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

import type { Task, TaskList, ZigflowWorkflow } from '../types/zigflow';
import {
  DuplicateTaskNameError,
  addTask,
  ensureTaskIds,
  moveTask,
  removeTask,
  renameTask,
  syncWorkflowType,
  updateTaskBody,
} from './mutations';

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

function sampleList(): TaskList {
  return [
    { a: { set: { x: 1 }, metadata: { __zigflow_id: 'id-a' } } },
    { b: { set: { x: 2 }, metadata: { __zigflow_id: 'id-b' } } },
    { c: { set: { x: 3 }, metadata: { __zigflow_id: 'id-c' } } },
  ];
}

const nameAt = (list: TaskList, i: number): string => Object.keys(list[i])[0];
const taskAt = (list: TaskList, i: number): Task => Object.values(list[i])[0];

describe('renameTask', () => {
  it('changes the key without touching the task body or its id', () => {
    const list = sampleList();
    const body = taskAt(list, 1);

    renameTask(list, 'id-b', 'renamed');

    expect(list.map((_, i) => nameAt(list, i))).toEqual(['a', 'renamed', 'c']);
    // Same task object, so body and id are untouched.
    expect(taskAt(list, 1)).toBe(body);
    expect(taskAt(list, 1).metadata?.__zigflow_id).toBe('id-b');
  });

  it('rejects a name that already exists elsewhere in the list', () => {
    const list = sampleList();
    expect(() => renameTask(list, 'id-b', 'a')).toThrow(DuplicateTaskNameError);
    // The list is left untouched on rejection.
    expect(list.map((_, i) => nameAt(list, i))).toEqual(['a', 'b', 'c']);
  });

  it('allows renaming a task to its own current name (no-op, not a clash)', () => {
    const list = sampleList();
    expect(() => renameTask(list, 'id-b', 'b')).not.toThrow();
    expect(list.map((_, i) => nameAt(list, i))).toEqual(['a', 'b', 'c']);
  });
});

describe('updateTaskBody', () => {
  it('replaces the body but preserves name, position and id', () => {
    const list = sampleList();
    const newBody: Task = { wait: { seconds: 5 } };

    updateTaskBody(list, 'id-b', newBody);

    expect(nameAt(list, 1)).toBe('b');
    const updated = taskAt(list, 1);
    expect('wait' in updated).toBe(true);
    expect(updated.metadata?.__zigflow_id).toBe('id-b');
  });
});

describe('addTask', () => {
  it('appends with a fresh id by default', () => {
    const list = sampleList();
    const added = addTask(list, 'set');

    expect(list).toHaveLength(4);
    expect(nameAt(list, 3)).toBe(added.name);
    expect(taskAt(list, 3).metadata?.__zigflow_id).toBe(added.id);
    expect(added.id).not.toBe('');
    // The generated id is genuinely new.
    expect(['id-a', 'id-b', 'id-c']).not.toContain(added.id);
  });

  it('inserts after a given sibling', () => {
    const list = sampleList();
    const added = addTask(list, 'wait', { afterId: 'id-a' });

    expect(list.map((_, i) => nameAt(list, i))).toEqual([
      'a',
      added.name,
      'b',
      'c',
    ]);
  });

  it('accepts a non-colliding explicit name', () => {
    const list = sampleList();
    const added = addTask(list, 'set', { name: 'freshName' });
    expect(added.name).toBe('freshName');
    expect(nameAt(list, 3)).toBe('freshName');
  });

  it('rejects an explicit name that already exists in the list', () => {
    const list = sampleList();
    expect(() => addTask(list, 'set', { name: 'b' })).toThrow(
      DuplicateTaskNameError,
    );
    // Nothing was added on rejection.
    expect(list).toHaveLength(3);
  });
});

describe('removeTask', () => {
  it('removes only the target task', () => {
    const list = sampleList();
    removeTask(list, 'id-b');
    expect(list.map((_, i) => nameAt(list, i))).toEqual(['a', 'c']);
  });
});

describe('moveTask', () => {
  it('moves a task up, swapping with its predecessor', () => {
    const list = sampleList();
    expect(moveTask(list, 'id-b', 'up')).toBe(true);
    expect(list.map((_, i) => nameAt(list, i))).toEqual(['b', 'a', 'c']);
  });

  it('moves a task down, swapping with its successor', () => {
    const list = sampleList();
    expect(moveTask(list, 'id-b', 'down')).toBe(true);
    expect(list.map((_, i) => nameAt(list, i))).toEqual(['a', 'c', 'b']);
  });

  it('is a no-op at the boundaries', () => {
    const list = sampleList();
    expect(moveTask(list, 'id-a', 'up')).toBe(false);
    expect(moveTask(list, 'id-c', 'down')).toBe(false);
    expect(list.map((_, i) => nameAt(list, i))).toEqual(['a', 'b', 'c']);
  });
});

describe('addTask + ensureTaskIds for containers', () => {
  it("ids a new try task's seeded placeholders on a follow-up pass", () => {
    const wf = workflow();
    const added = addTask(wf.do, 'try');
    const tryTask = added.task;
    if (!('try' in tryTask)) {
      throw new Error('expected a try task');
    }

    // The container itself is identified immediately; its placeholders are not.
    expect(added.id).not.toBe('');
    expect(taskAt(tryTask.try, 0).metadata?.__zigflow_id).toBeUndefined();
    expect(taskAt(tryTask.catch.do, 0).metadata?.__zigflow_id).toBeUndefined();

    // A follow-up whole-tree pass fills them in (DESIGN.md §2.3).
    ensureTaskIds(wf);
    expect(typeof taskAt(tryTask.try, 0).metadata?.__zigflow_id).toBe('string');
    expect(typeof taskAt(tryTask.catch.do, 0).metadata?.__zigflow_id).toBe(
      'string',
    );
  });
});
