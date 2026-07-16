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

import type { TaskList } from '../types/zigflow';
import { treeToGraph } from './treeToGraph';

function threeStep(): TaskList {
  return [
    { one: { set: { v: 1 }, metadata: { __zigflow_id: 'id-1' } } },
    { two: { set: { v: 2 }, metadata: { __zigflow_id: 'id-2' } } },
    { three: { set: { v: 3 }, metadata: { __zigflow_id: 'id-3' } } },
  ];
}

describe('treeToGraph — sequential', () => {
  it('produces one node per task in array order', () => {
    const graph = treeToGraph(threeStep(), 'sequential');
    expect(graph.nodes.map((n) => n.name)).toEqual(['one', 'two', 'three']);
    expect(graph.nodes.map((n) => n.index)).toEqual([0, 1, 2]);
    expect(graph.nodes.every((n) => n.kind === 'set')).toBe(true);
  });

  it('links consecutive nodes with solid sequence edges', () => {
    const graph = treeToGraph(threeStep(), 'sequential');
    const seq = graph.edges.filter((e) => e.kind === 'sequence');
    expect(seq).toHaveLength(2);
    expect(seq.map((e) => [e.source, e.target])).toEqual([
      ['id-1', 'id-2'],
      ['id-2', 'id-3'],
    ]);
  });
});

describe('treeToGraph — parallel', () => {
  it('produces nodes but no sequence edges between fork branches', () => {
    const graph = treeToGraph(threeStep(), 'parallel');
    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges.filter((e) => e.kind === 'sequence')).toHaveLength(0);
  });
});

describe('treeToGraph — goto edges', () => {
  it('derives a goto edge for a Switch case naming a sibling', () => {
    const list: TaskList = [
      {
        route: {
          switch: [
            { toShip: { when: '${ .ok }', then: 'ship' } },
            { fallthrough: { then: 'continue' } },
          ],
          metadata: { __zigflow_id: 'id-switch' },
        },
      },
      {
        ship: { set: { shipped: true }, metadata: { __zigflow_id: 'id-ship' } },
      },
    ];

    const graph = treeToGraph(list, 'sequential');
    const gotos = graph.edges.filter((e) => e.kind === 'goto');
    expect(gotos).toHaveLength(1);
    expect(gotos[0].source).toBe('id-switch');
    expect(gotos[0].target).toBe('id-ship');
    expect(gotos[0].label).toBe('toShip');
  });

  it('does not derive goto edges for continue/exit/end directives', () => {
    const list: TaskList = [
      {
        route: {
          switch: [
            { a: { then: 'continue' } },
            { b: { then: 'exit' } },
            { c: { then: 'end' } },
          ],
          metadata: { __zigflow_id: 'id-switch' },
        },
      },
      { other: { set: { v: 1 }, metadata: { __zigflow_id: 'id-other' } } },
    ];

    const graph = treeToGraph(list, 'sequential');
    expect(graph.edges.filter((e) => e.kind === 'goto')).toHaveLength(0);
  });
});
