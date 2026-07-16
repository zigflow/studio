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
import type { Task, TaskList } from '../types/zigflow';
import type { FlowEdge, FlowGraph, FlowLayout, FlowNode } from './model';
import { taskKind } from './model';

/**
 * Pure projection from one scope's `TaskList` to canvas nodes + edges
 * (DESIGN.md §3). The tree stays authoritative: nothing here is written back, and
 * the derived `goto` edges in particular never touch the tree's `then` fields.
 */

/** Built-in `then` outcomes that are flow directives, not sibling-task gotos. */
const FLOW_DIRECTIVES: ReadonlySet<string> = new Set([
  'continue',
  'exit',
  'end',
]);

function nodeId(task: Task, index: number): string {
  const id = task.metadata?.__zigflow_id;
  // Post-load every task has an id (ensureTaskIds); fall back positionally so a
  // mid-edit workflow without ids still projects rather than throwing.
  return typeof id === 'string' && id !== '' ? id : `node-${index}`;
}

/** Project one scope into {@link FlowNode}s (array order = execution order). */
function toNodes(list: TaskList): FlowNode[] {
  const nodes: FlowNode[] = [];
  list.forEach((named, index) => {
    const entries = Object.entries(named);
    // A TaskList item is a single-key `{ name: task }` object per the schema.
    const entry = entries[0];
    if (entry === undefined) {
      return;
    }
    const [name, task] = entry;
    nodes.push({
      id: nodeId(task, index),
      name,
      kind: taskKind(task),
      task,
      index,
    });
  });
  return nodes;
}

/** Solid execution-order edges between consecutive nodes in a sequential scope. */
function sequenceEdges(nodes: FlowNode[]): FlowEdge[] {
  const edges: FlowEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const source = nodes[i];
    const target = nodes[i + 1];
    edges.push({
      id: `seq-${source.id}-${target.id}`,
      source: source.id,
      target: target.id,
      kind: 'sequence',
    });
  }
  return edges;
}

/**
 * Derived, informational `goto` edges: for each Switch case whose `then` names a
 * sibling in this scope (i.e. not a `continue`/`exit`/`end` directive), a dashed
 * edge to that sibling. Cases pointing at directives, or at names not present in
 * this scope, produce no edge.
 */
function gotoEdges(nodes: FlowNode[]): FlowEdge[] {
  const byName = new Map(nodes.map((node) => [node.name, node]));
  const edges: FlowEdge[] = [];

  for (const node of nodes) {
    const task = node.task;
    if (!('switch' in task)) {
      continue;
    }
    for (const caseItem of task.switch) {
      for (const [caseName, branch] of Object.entries(caseItem)) {
        const then = branch.then;
        if (typeof then !== 'string' || FLOW_DIRECTIVES.has(then)) {
          continue;
        }
        const target = byName.get(then);
        if (target === undefined) {
          continue;
        }
        edges.push({
          id: `goto-${node.id}-${caseName}-${target.id}`,
          source: node.id,
          target: target.id,
          kind: 'goto',
          label: caseName,
        });
      }
    }
  }
  return edges;
}

/**
 * Project a scope's `TaskList` into a {@link FlowGraph}.
 *
 * `sequential` (root, `do`/`for`/`try` bodies) stacks nodes in array order with
 * solid edges between consecutive tasks. `parallel` (`fork.branches`) has no
 * sequence edges — branches run concurrently. Both layouts include derived
 * `goto` edges from Switch cases.
 */
export function treeToGraph(list: TaskList, layout: FlowLayout): FlowGraph {
  const nodes = toNodes(list);
  const edges =
    layout === 'sequential'
      ? [...sequenceEdges(nodes), ...gotoEdges(nodes)]
      : gotoEdges(nodes);
  return { nodes, edges, layout };
}
