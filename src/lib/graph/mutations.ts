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

/**
 * Tree mutations (DESIGN.md §3). This module is the *only* place that changes the
 * workflow tree. The graph/UI-facing mutations (rename/add/remove/move/...) arrive
 * in a later step; the two functions here have no UI dependency, so they live here
 * now and are called from the load/save API routes.
 */

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
