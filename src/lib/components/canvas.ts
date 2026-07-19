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
 * Node-level edit intents. The canvas turns a single node click into `select`,
 * a double click into `drill` (an accelerator for the inspector's Open button,
 * DESIGN.md §6), and pane clicks into `deselect`. The inspector dispatches the
 * rest (move, delete, drill-in) for the selected task. Editing itself happens in
 * the page's mutation handlers (DESIGN.md §3), so this mapping stays pure and
 * never closes over page state.
 */
export interface CanvasActions {
  select(id: string): void;
  deselect(): void;
  drill(node: FlowNode, field: ScopeField): void;
  moveUp(id: string): void;
  moveDown(id: string): void;
  remove(id: string): void;
}

/**
 * The currently-selected node id, exposed to custom nodes via Svelte context.
 *
 * Selection drives only a CSS highlight, so it is deliberately kept *out* of the
 * SvelteFlow `nodes` array: re-projecting nodes on every selection change
 * recreated the card DOM mid-gesture, which broke the double-click-to-drill
 * accelerator (the second click landed on a fresh element). Reading the id
 * through a reactive getter toggles the `.selected` class in place instead, so
 * the node element is stable across selection. `nodes` now changes only when the
 * scope's graph does.
 */
export interface CanvasSelection {
  readonly id: string | null;
}

/** Svelte context key for {@link CanvasSelection}. */
export const canvasSelectionKey = Symbol('zigflow.canvasSelection');

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
