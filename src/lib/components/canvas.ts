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
import type { Edge, Node } from '@xyflow/svelte';

import { isContainerKind } from '../editor/drilldown';
import type {
  FlowGraph,
  FlowLayout,
  FlowNode,
  ScopeField,
} from '../graph/model';

/**
 * Maps a {@link FlowGraph} (the pure §3 projection) onto the node/edge shape
 * SvelteFlow renders. Layout coordinates and edge styling live here, not in the
 * workflow model: positions are derived from array order and never persisted
 * (AGENTS "Editor architecture" — layout/selection are UI concerns). Kept as pure
 * functions so the mapping is unit-testable without a browser or SvelteFlow.
 */

/** The `data` payload carried by each SvelteFlow node. */
export interface TaskNodeData {
  flow: FlowNode;
  /** Whether the node can be drilled into a sub-canvas (container kinds). */
  container: boolean;
  /** First in its scope — used to disable "move up". */
  first: boolean;
  /** Last in its scope — used to disable "move down". */
  last: boolean;
  [key: string]: unknown;
}

export type TaskFlowNode = Node<TaskNodeData, 'task'>;

/**
 * Node-level edit intents, provided by the canvas via Svelte context so a custom
 * node's inline controls can dispatch them without the pure {@link toFlowNodes}
 * mapping needing to close over page state. The canvas turns whole-node clicks
 * into `select`/pane clicks into `deselect`; the buttons on the card call the
 * rest. Editing itself happens in the page's mutation handlers (DESIGN.md §3).
 */
export interface CanvasActions {
  select(id: string): void;
  deselect(): void;
  drill(node: FlowNode, field: ScopeField): void;
  moveUp(id: string): void;
  moveDown(id: string): void;
  remove(id: string): void;
}

/** Svelte context key for {@link CanvasActions}. */
export const canvasActionsKey = Symbol('zigflow.canvasActions');

const NODE_STRIDE_Y = 132;
const NODE_STRIDE_X = 260;

const SEQUENCE_EDGE_STYLE = 'stroke:#94a3b8;';
const GOTO_EDGE_STYLE = 'stroke:#b45309;stroke-dasharray:6 4;';

/**
 * Position a node from its array index. `sequential` stacks vertically (execution
 * order); `parallel` (fork branches) lays lanes out horizontally, since branches
 * run concurrently rather than in sequence.
 */
export function nodePosition(
  index: number,
  layout: FlowLayout,
): { x: number; y: number } {
  return layout === 'parallel'
    ? { x: index * NODE_STRIDE_X, y: 0 }
    : { x: 0, y: index * NODE_STRIDE_Y };
}

/** Project the graph's nodes into positioned SvelteFlow nodes. */
export function toFlowNodes(graph: FlowGraph): TaskFlowNode[] {
  const lastIndex = graph.nodes.length - 1;
  return graph.nodes.map((node) => ({
    id: node.id,
    type: 'task',
    position: nodePosition(node.index, graph.layout),
    data: {
      flow: node,
      container: isContainerKind(node.kind),
      first: node.index === 0,
      last: node.index === lastIndex,
    },
    draggable: false,
  }));
}

/**
 * Project the graph's edges. Solid `sequence` edges use a smooth step path; the
 * derived, informational `goto` edges (§3) are dashed, animated, and carry the
 * Switch case name as their label.
 */
export function toFlowEdges(graph: FlowGraph): Edge[] {
  return graph.edges.map((edge) => {
    const isGoto = edge.kind === 'goto';
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: isGoto ? 'bezier' : 'smoothstep',
      animated: isGoto,
      label: edge.label,
      class: edge.kind,
      style: isGoto ? GOTO_EDGE_STYLE : SEQUENCE_EDGE_STYLE,
    };
  });
}
