<script lang="ts">
  import { taskSubtitle } from '$lib/editor/subtitle';
  import type { SubtitleDescriptor } from '$lib/editor/subtitle';
  import { m } from '$lib/paraglide/messages';
  import { Handle, Position } from '@xyflow/svelte';
  import { getContext } from 'svelte';

  import {
    type CanvasSelection,
    type TaskNodeData,
    canvasSelectionKey,
  } from './canvas';
  import { kindLabel } from './labels';

  // SvelteFlow types node `data` as `any` at this boundary; narrow it once here.
  let { data }: { data: TaskNodeData } = $props();

  // Selection highlight comes from the canvas context, not SvelteFlow's own
  // `selected` node prop — see CanvasSelection in canvas.ts for why (keeping it
  // off the `nodes` array is what makes double-click-to-drill work).
  const selection = getContext<CanvasSelection>(canvasSelectionKey);

  const flow = $derived(data.flow);
  const selected = $derived(flow.id === selection.id);

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
</script>

<Handle type="target" position={Position.Top} isConnectable={false} />

<!-- The card is purely informational (DESIGN.md §6): single-click selects the
     task and double-click drills into a container (both handled at the canvas
     level via SvelteFlow's node-click event, see Canvas.svelte). It renders
     kind, name, and subtitle only. -->
<div class="task-node" class:selected>
  <div class="kind">{kindLabel(flow.kind)}</div>
  <div class="name">{flow.name}</div>
  {#if subtitle}
    <div class="subtitle">{subtitle}</div>
  {/if}
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
</style>
