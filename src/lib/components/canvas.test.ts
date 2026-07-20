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

import type { FlowGraph } from '../graph/model';
import { nodePosition, toFlowEdges, toFlowNodes } from './canvas';

const graph = (layout: FlowGraph['layout']): FlowGraph => ({
  layout,
  nodes: [
    { id: 'a', name: 'route', kind: 'switch', task: { switch: [] }, index: 0 },
    { id: 'b', name: 'body', kind: 'do', task: { do: [] }, index: 1 },
  ],
  edges: [
    { id: 'seq', source: 'a', target: 'b', kind: 'sequence' },
    { id: 'go', source: 'a', target: 'b', kind: 'goto', label: 'case1' },
  ],
});

describe('nodePosition', () => {
  it('stacks vertically for sequential and horizontally for parallel', () => {
    expect(nodePosition(0, 'sequential')).toEqual({ x: 0, y: 0 });
    expect(nodePosition(2, 'sequential')).toMatchObject({ x: 0 });
    expect(nodePosition(2, 'sequential').y).toBeGreaterThan(0);

    expect(nodePosition(0, 'parallel')).toEqual({ x: 0, y: 0 });
    expect(nodePosition(2, 'parallel')).toMatchObject({ y: 0 });
    expect(nodePosition(2, 'parallel').x).toBeGreaterThan(0);
  });
});

describe('toFlowNodes', () => {
  it('positions nodes by layout and flags containers', () => {
    const nodes = toFlowNodes(graph('sequential'));
    expect(nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(nodes.every((n) => n.draggable === false)).toBe(true);

    // switch is not a container; do is.
    expect(nodes[0].data.container).toBe(false);
    expect(nodes[1].data.container).toBe(true);

    // first/last flags drive move-up/move-down enablement.
    expect(nodes[0].data.first).toBe(true);
    expect(nodes[0].data.last).toBe(false);
    expect(nodes[1].data.first).toBe(false);
    expect(nodes[1].data.last).toBe(true);

    // sequential → vertical offset by index.
    expect(nodes[0].position).toEqual({ x: 0, y: 0 });
    expect(nodes[1].position.y).toBeGreaterThan(0);

    // sequential nodes carry connection handles.
    expect(nodes.every((n) => n.data.showHandles)).toBe(true);
  });

  it('suppresses handles for the root independent layout', () => {
    // Root: no edges between independent top-level workflows, so no handles.
    const nodes = toFlowNodes(graph('independent'));
    expect(nodes.every((n) => n.data.showHandles === false)).toBe(true);
    // Still stacked vertically as plain cards.
    expect(nodes[0].position).toEqual({ x: 0, y: 0 });
    expect(nodes[1].position.y).toBeGreaterThan(0);
  });

  it('lays fork branches out horizontally in parallel layout', () => {
    const nodes = toFlowNodes(graph('parallel'));
    expect(nodes[0].position).toEqual({ x: 0, y: 0 });
    expect(nodes[1].position.x).toBeGreaterThan(0);
    expect(nodes[1].position.y).toBe(0);
  });
});

describe('toFlowEdges', () => {
  it('styles sequence edges solid and goto edges dashed/animated', () => {
    const edges = toFlowEdges(graph('sequential'));
    const seq = edges.find((e) => e.id === 'seq');
    const goto = edges.find((e) => e.id === 'go');

    expect(seq?.type).toBe('smoothstep');
    expect(seq?.animated).toBe(false);
    expect(seq?.class).toBe('sequence');
    expect(seq?.style).not.toContain('dasharray');

    expect(goto?.type).toBe('bezier');
    expect(goto?.animated).toBe(true);
    expect(goto?.class).toBe('goto');
    expect(goto?.style).toContain('dasharray');
    expect(goto?.label).toBe('case1');
  });
});
