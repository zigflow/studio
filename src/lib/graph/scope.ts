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
import type { Task, TaskList, ZigflowWorkflow } from '../types/zigflow';
import type { ScopeField, ScopePath } from './model';

/**
 * Scope resolution (DESIGN.md §3).
 *
 * A `ScopePath` names a nested `TaskList` by walking container tasks from the
 * root. `resolveScope` turns that path into a live reference to the target list
 * plus a setter that writes a replacement back into the tree. All tree mutations
 * operate on the reference this returns — there is no separate "graph apply".
 */

/**
 * Thrown when a `ScopePath` can no longer be resolved — e.g. a container task in
 * the path was deleted, or no longer has the nested list the path expects.
 * Callers are expected to catch this and fall back to the root scope rather than
 * crash (DESIGN.md §3).
 */
export class ScopeResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScopeResolutionError';
  }
}

/** A resolved scope: the target list, and a setter that replaces it in the tree. */
export interface ResolvedScope {
  list: TaskList;
  setList(next: TaskList): void;
}

function taskIdOf(task: Task): string | undefined {
  const id = task.metadata?.__zigflow_id;
  return typeof id === 'string' && id !== '' ? id : undefined;
}

/** Read the nested list a scope step descends into, or throw if absent. */
function childList(task: Task, field: ScopeField, taskId: string): TaskList {
  switch (field) {
    case 'do':
      if ('do' in task) return task.do;
      break;
    case 'branches':
      if ('fork' in task) return task.fork.branches;
      break;
    case 'try':
      if ('try' in task) return task.try;
      break;
    case 'catch':
      if ('try' in task) return task.catch.do;
      break;
  }
  throw new ScopeResolutionError(
    `Task ${taskId} has no "${field}" task list to drill into`,
  );
}

/** Write a replacement list back into the nested position a step descends into. */
function setChildList(task: Task, field: ScopeField, next: TaskList): void {
  switch (field) {
    case 'do':
      if ('do' in task) {
        task.do = next;
        return;
      }
      break;
    case 'branches':
      if ('fork' in task) {
        task.fork.branches = next;
        return;
      }
      break;
    case 'try':
      if ('try' in task) {
        task.try = next;
        return;
      }
      break;
    case 'catch':
      if ('try' in task) {
        task.catch.do = next;
        return;
      }
      break;
  }
  throw new ScopeResolutionError(
    `Cannot write "${field}" task list on this task`,
  );
}

/** Find the task with the given id directly within a list (not recursive). */
function findInList(list: TaskList, taskId: string): Task | undefined {
  for (const named of list) {
    for (const task of Object.values(named)) {
      if (taskIdOf(task) === taskId) {
        return task;
      }
    }
  }
  return undefined;
}

/**
 * Walk a `ScopePath` from the root and return the target `TaskList` plus a setter.
 * An empty path resolves to the workflow root `do` list. Throws
 * {@link ScopeResolutionError} if any step no longer resolves.
 */
export function resolveScope(
  workflow: ZigflowWorkflow,
  path: ScopePath,
): ResolvedScope {
  let list: TaskList = workflow.do;
  let setList: (next: TaskList) => void = (next) => {
    workflow.do = next;
  };

  for (const step of path) {
    const task = findInList(list, step.taskId);
    if (task === undefined) {
      throw new ScopeResolutionError(
        `Scope step "${step.label}" (${step.taskId}) no longer exists`,
      );
    }
    list = childList(task, step.field, step.taskId);
    setList = (next) => setChildList(task, step.field, next);
  }

  return { list, setList };
}

/**
 * The task names visible to a `then` jump within a scope — every sibling name in
 * the list, in order (used to populate Switch `then` dropdowns, DESIGN.md §3).
 * Pass `excludeId` to drop the task doing the jumping from its own options.
 */
export function siblingNames(list: TaskList, excludeId?: string): string[] {
  const names: string[] = [];
  for (const named of list) {
    for (const [name, task] of Object.entries(named)) {
      if (excludeId !== undefined && taskIdOf(task) === excludeId) {
        continue;
      }
      names.push(name);
    }
  }
  return names;
}

/** A task located anywhere in the tree, with the name it is filed under. */
export interface FoundTask {
  name: string;
  task: Task;
}

/** Which nested lists a task contains, for the recursive walk in `findById`. */
function nestedLists(task: Task): TaskList[] {
  const lists: TaskList[] = [];
  if ('do' in task) lists.push(task.do);
  if ('fork' in task) lists.push(task.fork.branches);
  if ('try' in task) {
    lists.push(task.try);
    lists.push(task.catch.do);
  }
  return lists;
}

/**
 * Find a task by `__zigflow_id` anywhere in the tree, returning it with its name,
 * or `undefined` if no task carries that id.
 */
export function findById(
  workflow: ZigflowWorkflow,
  taskId: string,
): FoundTask | undefined {
  const walk = (list: TaskList): FoundTask | undefined => {
    for (const named of list) {
      for (const [name, task] of Object.entries(named)) {
        if (taskIdOf(task) === taskId) {
          return { name, task };
        }
        for (const child of nestedLists(task)) {
          const found = walk(child);
          if (found !== undefined) {
            return found;
          }
        }
      }
    }
    return undefined;
  };
  return walk(workflow.do);
}
