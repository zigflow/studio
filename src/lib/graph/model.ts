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
import type { Task } from '../types/zigflow';

/**
 * Graph ↔ tree projection model (DESIGN.md §3).
 *
 * The canonical model is the `ZigflowWorkflow` tree; these types describe the
 * *projection* of a single scope (one `TaskList`) onto the flat node/edge shape
 * a canvas renders. They carry no layout coordinates — position is derived from
 * array order at render time (§3, "Reordering is explicit").
 */

/** The 11 Zigflow task kinds, in schema declaration order. */
export const TASK_KINDS = [
  'call',
  'do',
  'for',
  'fork',
  'listen',
  'raise',
  'run',
  'set',
  'switch',
  'try',
  'wait',
] as const;

/** The kind of a task, i.e. which task-type key it carries. */
export type TaskKind = (typeof TASK_KINDS)[number];

/**
 * Classify a task by the discriminant key it carries (DESIGN.md §2.1: the union
 * is structural, not tagged). `for`/`try` also contain a `do`/`try` list, so
 * their unique keys are checked before the bare `do` fallback.
 */
export function taskKind(task: Task): TaskKind {
  if ('call' in task) return 'call';
  if ('for' in task) return 'for';
  if ('fork' in task) return 'fork';
  if ('listen' in task) return 'listen';
  if ('raise' in task) return 'raise';
  if ('run' in task) return 'run';
  if ('set' in task) return 'set';
  if ('switch' in task) return 'switch';
  if ('try' in task) return 'try';
  if ('wait' in task) return 'wait';
  if ('do' in task) return 'do';
  throw new Error('Task carries no recognised task-kind key');
}

/**
 * Which nested `TaskList` inside a container task a scope step descends into.
 *
 * - `do` — the body of a `do` or `for` task
 * - `branches` — a `fork`'s concurrent branches
 * - `try` — the guarded body of a `try` task
 * - `catch` — a `try`'s `catch.do` handler body
 */
export type ScopeField = 'do' | 'branches' | 'try' | 'catch';

/**
 * One step of a {@link ScopePath}: the container task drilled into, its display
 * label (task name, for the breadcrumb), and which of its nested lists is shown.
 * `taskId` is the container's `__zigflow_id` — resolution is by id, not name, so
 * it survives renames.
 */
export interface ScopeStep {
  taskId: string;
  label: string;
  field: ScopeField;
}

/**
 * Locates which `TaskList` is currently on screen, as a path from the workflow
 * root. An empty path is the root `do` list.
 */
export type ScopePath = ScopeStep[];

/**
 * How a scope's nodes are arranged (DESIGN.md §3):
 * - `sequential` — vertical chain with solid execution-order edges (`do`/`for`/
 *   `try` bodies).
 * - `parallel` — horizontal lanes, no sequence edges (`fork.branches`).
 * - `independent` — the root scope: top-level workflows are independent (§1.2),
 *   so nodes render with **no edges and no connection handles**; array order is
 *   meaningful only for the `workflowType` derivation, never execution order.
 */
export type FlowLayout = 'sequential' | 'parallel' | 'independent';

/** A projected task, ready for a canvas to render. */
export interface FlowNode {
  /** The task's `__zigflow_id` (or a positional fallback if none is assigned). */
  id: string;
  /** The task's name — its key within the `TaskList`. */
  name: string;
  /** The task kind, for glyph/subtitle selection. */
  kind: TaskKind;
  /** The task body itself, for the inspector and subtitle rendering. */
  task: Task;
  /** Position within the scope's list (array order = execution order). */
  index: number;
}

/** A `sequence` edge is solid execution order; a `goto` edge is a dashed jump. */
export type FlowEdgeKind = 'sequence' | 'goto';

/** A projected edge between two {@link FlowNode}s in the same scope. */
export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  kind: FlowEdgeKind;
  /** For `goto` edges, the Switch case name that produced the jump. */
  label?: string;
}

/** The full projection of one scope: nodes, edges, and the layout to use. */
export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
  layout: FlowLayout;
}

/**
 * The root scope (empty path) is `independent` — top-level workflows don't run
 * in sequence (§1.2). Fork branches render as parallel lanes; every other scope
 * is sequential.
 */
export function layoutForScope(path: ScopePath): FlowLayout {
  if (path.length === 0) {
    return 'independent';
  }
  const last = path.at(-1);
  return last?.field === 'branches' ? 'parallel' : 'sequential';
}
