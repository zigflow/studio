<script lang="ts">
  import { browser } from '$app/environment';
  import type { FlowGraph } from '$lib/graph/model';
  import { m } from '$lib/paraglide/messages';
  import {
    Background,
    Controls,
    type Edge,
    type NodeTypes,
    SvelteFlow,
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import { setContext } from 'svelte';

  import { containerField } from '../editor/drilldown';
  import TaskNode from './TaskNode.svelte';
  import {
    type CanvasActions,
    type CanvasSelection,
    type TaskFlowNode,
    canvasSelectionKey,
    toFlowEdges,
    toFlowNodes,
  } from './canvas';

  type Props = {
    graph: FlowGraph;
    selectedId: string | null;
    actions: CanvasActions;
  };

  let { graph, selectedId, actions }: Props = $props();

  // Expose selection to the custom node via context so the highlight is a CSS
  // class toggle, not a `nodes` rebuild (see CanvasSelection in canvas.ts). The
  // getter keeps it reactive: TaskNode re-derives its `selected` when this moves.
  setContext<CanvasSelection>(canvasSelectionKey, {
    get id() {
      return selectedId;
    },
  });

  const nodeTypes: NodeTypes = { task: TaskNode };

  // Node clicks come through SvelteFlow's own event pipeline (a native DOM
  // handler on the card can't be used: SvelteFlow/d3-zoom stops `dblclick`
  // propagation before it reaches Svelte's delegated root, and the first click's
  // selection re-render replaces the card element mid-gesture). `event.detail` is
  // the click count, so a double-click (detail 2) drills into a container — an
  // accelerator for the inspector's Open button (DESIGN.md §6) — while a single
  // click selects. For `try`, `containerField` returns `'try'`, so double-click
  // opens the `try` body by default (catch stays an explicit inspector button);
  // non-container kinds have no field, so double-click just re-selects.
  function onNodeClick(event: MouseEvent | TouchEvent, node: TaskFlowNode) {
    const flow = node.data.flow;
    if (event.detail >= 2) {
      const field = containerField(flow.kind);
      if (field) {
        actions.drill(flow, field);
        return;
      }
    }
    actions.select(flow.id);
  }

  let nodes = $state.raw<TaskFlowNode[]>([]);
  let edges = $state.raw<Edge[]>([]);

  // Re-project only when the scope's graph changes — NOT on selection (that
  // rides the context above). The pure mappers in ./canvas build SvelteFlow's
  // node/edge shape; treeToGraph stays the source of truth.
  $effect(() => {
    nodes = toFlowNodes(graph);
    edges = toFlowEdges(graph);
  });
</script>

<div class="canvas" role="region" aria-label={m.canvas_region_label()}>
  {#if graph.nodes.length === 0}
    <p class="empty">{m.canvas_empty()}</p>
  {:else if browser}
    <SvelteFlow
      bind:nodes
      bind:edges
      {nodeTypes}
      fitView
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      onnodeclick={({ event, node }) => onNodeClick(event, node)}
      onpaneclick={() => actions.deselect()}
    >
      <Background />
      <Controls showLock={false} />
    </SvelteFlow>
  {/if}
</div>

<style>
  .canvas {
    position: relative;
    height: 100%;
    width: 100%;
    background: #f8fafc;
  }

  .empty {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    color: #64748b;
    font-family: ui-sans-serif, system-ui, sans-serif;
  }

  /* Distinguish derived goto edges from solid sequence edges (DESIGN.md §3). */
  .canvas :global(.svelte-flow__edge.goto .svelte-flow__edge-path) {
    stroke: #b45309;
    stroke-dasharray: 6 4;
  }
</style>
