<script lang="ts">
  import { containerField } from '$lib/editor/drilldown';
  import { taskSubtitle } from '$lib/editor/subtitle';
  import type { SubtitleDescriptor } from '$lib/editor/subtitle';
  import { m } from '$lib/paraglide/messages';
  import { Handle, Position } from '@xyflow/svelte';
  import { getContext } from 'svelte';

  import {
    type CanvasActions,
    type TaskNodeData,
    canvasActionsKey,
  } from './canvas';
  import { kindLabel } from './labels';

  // SvelteFlow types node `data` as `any` at this boundary; narrow it once here.
  // `selected` is a built-in NodeProps field the canvas sets per selection state.
  let { data, selected = false }: { data: TaskNodeData; selected?: boolean } =
    $props();

  const actions = getContext<CanvasActions>(canvasActionsKey);

  const flow = $derived(data.flow);

  function subtitleText(desc: SubtitleDescriptor): string {
    switch (desc.key) {
      case 'call_http':
        return m.subtitle_call_http({
          method: desc.method,
          endpoint: desc.endpoint,
        });
      case 'call_activity':
        return m.subtitle_call_activity({ name: desc.name });
      case 'call_grpc':
        return m.subtitle_call_grpc({ method: desc.method });
      case 'wait':
        return m.subtitle_wait({ duration: desc.duration });
      case 'wait_until':
        return m.subtitle_wait_until({ time: desc.time });
      case 'for':
        return m.subtitle_for({ collection: desc.collection });
      case 'fork':
        return m.subtitle_fork({ count: String(desc.count) });
      case 'switch':
        return m.subtitle_switch({ count: String(desc.count) });
      case 'do':
        return m.subtitle_do({ count: String(desc.count) });
      case 'try':
        return m.subtitle_try();
      case 'none':
        return '';
      default: {
        const unreachable: never = desc;
        return String(unreachable);
      }
    }
  }

  const subtitle = $derived(subtitleText(taskSubtitle(flow.task)));

  // Buttons stop propagation so their action doesn't also trigger node-select.
  function act(fn: () => void) {
    return (event: MouseEvent) => {
      event.stopPropagation();
      fn();
    };
  }
</script>

<Handle type="target" position={Position.Top} isConnectable={false} />

<div class="task-node" class:selected>
  <div class="kind">{kindLabel(flow.kind)}</div>
  <div class="name">{flow.name}</div>
  {#if subtitle}
    <div class="subtitle">{subtitle}</div>
  {/if}

  <div class="controls">
    <button
      type="button"
      title={m.node_move_up()}
      aria-label={m.node_move_up()}
      disabled={data.first}
      onclick={act(() => actions.moveUp(flow.id))}>↑</button
    >
    <button
      type="button"
      title={m.node_move_down()}
      aria-label={m.node_move_down()}
      disabled={data.last}
      onclick={act(() => actions.moveDown(flow.id))}>↓</button
    >
    <button
      type="button"
      class="delete"
      title={m.node_delete()}
      aria-label={m.node_delete()}
      onclick={act(() => actions.remove(flow.id))}>✕</button
    >

    {#if flow.kind === 'try'}
      <!-- Try owns two child lists; give each its own drill affordance so the
           choice between `try` and `catch.do` is explicit (DESIGN.md §3). -->
      <button
        type="button"
        class="drill"
        onclick={act(() => actions.drill(flow, 'try'))}
        >{m.node_open_try()}</button
      >
      <button
        type="button"
        class="drill"
        onclick={act(() => actions.drill(flow, 'catch'))}
        >{m.node_open_catch()}</button
      >
    {:else if data.container}
      {@const field = containerField(flow.kind)}
      {#if field}
        <button
          type="button"
          class="drill"
          onclick={act(() => actions.drill(flow, field))}
          >{m.node_open()}</button
        >
      {/if}
    {/if}
  </div>
</div>

<Handle type="source" position={Position.Bottom} isConnectable={false} />

<style>
  .task-node {
    position: relative;
    width: 220px;
    padding: 0.6rem 0.75rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.5rem;
    background: #ffffff;
    box-shadow: 0 1px 2px rgb(15 23 42 / 0.08);
    font-family: ui-sans-serif, system-ui, sans-serif;
  }

  .task-node.selected {
    border-color: #4338ca;
    box-shadow: 0 0 0 2px #c7d2fe;
  }

  .kind {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #6366f1;
  }

  .name {
    margin-top: 0.1rem;
    font-size: 0.95rem;
    font-weight: 600;
    color: #0f172a;
    overflow-wrap: anywhere;
  }

  .subtitle {
    margin-top: 0.2rem;
    font-size: 0.78rem;
    color: #475569;
    overflow-wrap: anywhere;
  }

  .controls {
    margin-top: 0.5rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .controls button {
    padding: 0.1rem 0.4rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.25rem;
    background: #f8fafc;
    color: #334155;
    font: inherit;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .controls button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .controls button.delete {
    color: #b91c1c;
  }

  .controls button.drill {
    border-color: #6366f1;
    color: #4338ca;
  }
</style>
