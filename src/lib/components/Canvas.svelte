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
  import { setContext, untrack } from 'svelte';

  import TaskNode from './TaskNode.svelte';
  import {
    type CanvasActions,
    type TaskFlowNode,
    canvasActionsKey,
    toFlowEdges,
    toFlowNodes,
  } from './canvas';

  type Props = {
    graph: FlowGraph;
    selectedId: string | null;
    actions: CanvasActions;
  };

  let { graph, selectedId, actions }: Props = $props();

  // Node-card buttons dispatch edit intents through this context (see canvas.ts).
  // The page provides a single stable `actions` object, so snapshotting it once is
  // correct.
  setContext<CanvasActions>(
    canvasActionsKey,
    untrack(() => actions),
  );

  const nodeTypes: NodeTypes = { task: TaskNode };

  let nodes = $state.raw<TaskFlowNode[]>([]);
  let edges = $state.raw<Edge[]>([]);

  // Re-project whenever the scope's graph or the selection changes. The pure
  // mappers in ./canvas build SvelteFlow's node/edge shape; treeToGraph stays the
  // source of truth.
  $effect(() => {
    nodes = toFlowNodes(graph).map((node) => ({
      ...node,
      selected: node.id === selectedId,
    }));
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
      onnodeclick={({ node }) => actions.select(node.data.flow.id)}
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
