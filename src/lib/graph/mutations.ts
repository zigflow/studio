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
import { createDefaultTask } from './defaults';
import type { TaskKind } from './model';

/**
 * Tree mutations (DESIGN.md §3). This module is the *only* place that changes the
 * workflow tree. Every function operates on a `TaskList` reference obtained from
 * `resolveScope` (or the root `do` list) — there is no separate "graph apply"
 * step. `ensureTaskIds`/`syncWorkflowType` additionally run from the load/save
 * API routes.
 */

/** Thrown when a mutation targets a task id that is not in the given list. */
export class TaskNotInListError extends Error {
  constructor(taskId: string) {
    super(`No task with id ${taskId} in the given list`);
    this.name = 'TaskNotInListError';
  }
}

/**
 * Thrown when a mutation would create two tasks with the same name in one scope.
 *
 * This is not a schema constraint (DESIGN.md §4) but the editor's own resolution
 * logic — `resolveScope`, `findById`, `siblingNames` — looks tasks up by name
 * within a scope, so a duplicate name in one `TaskList` actively breaks it.
 */
export class DuplicateTaskNameError extends Error {
  constructor(name: string) {
    super(`A task named "${name}" already exists in this list`);
    this.name = 'DuplicateTaskNameError';
  }
}

/**
 * Return the child task lists nested directly inside a task.
 *
 * Only `do`, `for`, `fork`, and `try` nest task lists inline (DESIGN.md §1.1).
 * `switch` deliberately nests nothing — its cases are flow directives/gotos, not
 * children — so it is absent here.
 */
function childTaskLists(task: Task): TaskList[] {
  const lists: TaskList[] = [];
  if ('do' in task && Array.isArray(task.do)) {
    lists.push(task.do);
  }
  if ('fork' in task && Array.isArray(task.fork?.branches)) {
    lists.push(task.fork.branches);
  }
  if ('try' in task) {
    if (Array.isArray(task.try)) {
      lists.push(task.try);
    }
    if (Array.isArray(task.catch?.do)) {
      lists.push(task.catch.do);
    }
  }
  return lists;
}

function ensureIdsInList(list: TaskList): void {
  for (const named of list) {
    for (const task of Object.values(named)) {
      const metadata = task.metadata ?? (task.metadata = {});
      if (
        typeof metadata.__zigflow_id !== 'string' ||
        metadata.__zigflow_id === ''
      ) {
        metadata.__zigflow_id = crypto.randomUUID();
      }
      for (const child of childTaskLists(task)) {
        ensureIdsInList(child);
      }
    }
  }
}

/**
 * Walk the whole tree once and assign `metadata.__zigflow_id` to any task missing
 * one (DESIGN.md §2.3). Tasks that already have an id are left untouched, so the
 * operation is idempotent. Mutates and returns `workflow`.
 */
export function ensureTaskIds(workflow: ZigflowWorkflow): ZigflowWorkflow {
  ensureIdsInList(workflow.do);
  return workflow;
}

/**
 * Derive `document.workflowType` from the name of the *first* entry in the root
 * `do` list (DESIGN.md §1.2). If the root list is empty there is no first entry,
 * so `workflowType` is left unchanged. Mutates and returns `workflow`.
 */
export function syncWorkflowType(workflow: ZigflowWorkflow): ZigflowWorkflow {
  const first = workflow.do[0];
  if (first === undefined) {
    return workflow;
  }
  const name = Object.keys(first)[0];
  if (name !== undefined) {
    workflow.document.workflowType = name;
  }
  return workflow;
}

// --- List-scoped mutations (operate on a resolved TaskList reference) --------

function taskOf(named: TaskList[number]): Task {
  return Object.values(named)[0];
}

function nameOf(named: TaskList[number]): string {
  return Object.keys(named)[0];
}

function idOf(task: Task): string | undefined {
  const id = task.metadata?.__zigflow_id;
  return typeof id === 'string' && id !== '' ? id : undefined;
}

function indexOfTask(list: TaskList, taskId: string): number {
  return list.findIndex((named) => idOf(taskOf(named)) === taskId);
}

/** Pick a name not already used in `list`, based on the task kind. */
function uniqueName(list: TaskList, kind: TaskKind): string {
  const taken = new Set(list.map(nameOf));
  if (!taken.has(kind)) {
    return kind;
  }
  let suffix = 1;
  while (taken.has(`${kind}${suffix}`)) {
    suffix += 1;
  }
  return `${kind}${suffix}`;
}

/**
 * Rename a task in place, changing only its key. The task body and its
 * `__zigflow_id` are untouched, and its position in the list is preserved.
 *
 * Throws {@link DuplicateTaskNameError} if another task in this list already has
 * `newName` (renaming a task to its own current name is a no-op, not a clash).
 */
export function renameTask(
  list: TaskList,
  taskId: string,
  newName: string,
): void {
  const index = indexOfTask(list, taskId);
  if (index === -1) {
    throw new TaskNotInListError(taskId);
  }
  if (list.some((named, i) => i !== index && nameOf(named) === newName)) {
    throw new DuplicateTaskNameError(newName);
  }
  const task = taskOf(list[index]);
  list[index] = { [newName]: task };
}

/**
 * Replace a task's body while keeping its name, position, and identity. The
 * `__zigflow_id` from the existing task is carried onto `newBody`, so editing a
 * body (e.g. via the inspector) never drops node identity.
 */
export function updateTaskBody(
  list: TaskList,
  taskId: string,
  newBody: Task,
): void {
  const index = indexOfTask(list, taskId);
  if (index === -1) {
    throw new TaskNotInListError(taskId);
  }
  const name = nameOf(list[index]);
  const existingId = idOf(taskOf(list[index]));
  if (existingId !== undefined) {
    newBody.metadata = { ...newBody.metadata, __zigflow_id: existingId };
  }
  list[index] = { [name]: newBody };
}

/** The task created by {@link addTask}. */
export interface AddedTask {
  name: string;
  id: string;
  task: Task;
}

/** Where to place a newly added task, and what to name it. */
export interface AddTaskOptions {
  /** Explicit name; otherwise a unique name is derived from the kind. */
  name?: string;
  /** Insert immediately after the sibling with this id; otherwise append. */
  afterId?: string;
}

/**
 * Add a task of `kind` (body from {@link createDefaultTask}) to `list`, assigning
 * it a fresh `__zigflow_id` and a unique name. Appends by default, or inserts
 * after `afterId`.
 *
 * Only the new task's own id is assigned here. If its default body carries
 * pre-seeded children (e.g. a `try`'s placeholder steps), those get ids from a
 * follow-up `ensureTaskIds(workflow)` pass, per DESIGN.md §2.3 — adding a
 * container mid-session needs that pass, not just the on-load one.
 *
 * Throws {@link DuplicateTaskNameError} if an explicit `name` already exists in
 * this list. Derived names never clash, since {@link uniqueName} skips taken ones.
 */
export function addTask(
  list: TaskList,
  kind: TaskKind,
  options: AddTaskOptions = {},
): AddedTask {
  const task = createDefaultTask(kind);
  const id = crypto.randomUUID();
  task.metadata = { ...task.metadata, __zigflow_id: id };

  const name = options.name ?? uniqueName(list, kind);
  if (list.some((named) => nameOf(named) === name)) {
    throw new DuplicateTaskNameError(name);
  }
  const entry = { [name]: task };

  if (options.afterId !== undefined) {
    const afterIndex = indexOfTask(list, options.afterId);
    if (afterIndex === -1) {
      throw new TaskNotInListError(options.afterId);
    }
    list.splice(afterIndex + 1, 0, entry);
  } else {
    list.push(entry);
  }

  return { name, id, task };
}

/** Remove the task with the given id from `list`. Throws if it is not present. */
export function removeTask(list: TaskList, taskId: string): void {
  const index = indexOfTask(list, taskId);
  if (index === -1) {
    throw new TaskNotInListError(taskId);
  }
  list.splice(index, 1);
}

/**
 * Move a task one position up or down within `list`, swapping with its neighbour.
 * Returns `false` (a no-op) at the boundaries — moving the first task up or the
 * last task down. Throws if the id is not in the list.
 */
export function moveTask(
  list: TaskList,
  taskId: string,
  direction: 'up' | 'down',
): boolean {
  const index = indexOfTask(list, taskId);
  if (index === -1) {
    throw new TaskNotInListError(taskId);
  }
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= list.length) {
    return false;
  }
  const moved = list[index];
  list[index] = list[target];
  list[target] = moved;
  return true;
}
