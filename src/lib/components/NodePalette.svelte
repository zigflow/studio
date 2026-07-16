<script lang="ts">
  import { TASK_KINDS } from '$lib/graph/model';
  import type { TaskKind } from '$lib/graph/model';
  import { m } from '$lib/paraglide/messages';

  import { kindLabel } from './labels';

  let { onadd }: { onadd: (kind: TaskKind) => void } = $props();

  let selected = $state<TaskKind>('call');

  function pick(value: string) {
    // The <select> only ever holds a TASK_KINDS value, so this narrowing is safe.
    if ((TASK_KINDS as readonly string[]).includes(value)) {
      selected = value as TaskKind;
    }
  }
</script>

<div class="palette">
  <label>
    <span>{m.palette_kind_label()}</span>
    <select value={selected} onchange={(e) => pick(e.currentTarget.value)}>
      {#each TASK_KINDS as kind (kind)}
        <option value={kind}>{kindLabel(kind)}</option>
      {/each}
    </select>
  </label>
  <button type="button" onclick={() => onadd(selected)}>
    {m.palette_add_button()}
  </button>
</div>

<style>
  .palette {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #e2e8f0;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 0.85rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  select {
    padding: 0.25rem 0.4rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.3rem;
    font: inherit;
  }

  button {
    padding: 0.3rem 0.7rem;
    border: 1px solid #6366f1;
    border-radius: 0.3rem;
    background: #eef2ff;
    color: #4338ca;
    font: inherit;
    cursor: pointer;
  }
</style>
