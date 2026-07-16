<script lang="ts">
  import type { RenameOutcome } from '$lib/editor/commands';
  import type { TaskKind } from '$lib/graph/model';
  import { m } from '$lib/paraglide/messages';
  import type { Task } from '$lib/types/zigflow';
  import { untrack } from 'svelte';

  import CallHttpForm from './forms/CallHttpForm.svelte';
  import ForForm from './forms/ForForm.svelte';
  import SetForm from './forms/SetForm.svelte';
  import SwitchForm from './forms/SwitchForm.svelte';
  import WaitForm from './forms/WaitForm.svelte';
  import { kindLabel } from './labels';

  type Props = {
    name: string;
    task: Task;
    kind: TaskKind;
    siblingNames: string[];
    renameError: RenameOutcome | null;
    onrename: (newName: string) => void;
    onpatch: (task: Task) => void;
  };

  let {
    name,
    task,
    kind,
    siblingNames,
    renameError,
    onrename,
    onpatch,
  }: Props = $props();

  // Local edit buffer for the name; committed on blur/Enter so we don't rename on
  // every keystroke. Snapshotted once (the parent keys this component by node id);
  // a rejected rename keeps the user's typed value so they can fix it.
  let nameInput = $state(untrack(() => name));
</script>

<div class="inspector">
  <h2>{m.inspector_heading()}</h2>

  <label>
    <span>{m.inspector_name_label()}</span>
    <input
      value={nameInput}
      oninput={(e) => (nameInput = e.currentTarget.value)}
      onchange={() => onrename(nameInput)}
    />
  </label>
  {#if renameError === 'duplicate'}
    <p class="error">{m.inspector_rename_error_duplicate()}</p>
  {:else if renameError === 'empty'}
    <p class="error">{m.inspector_rename_error_empty()}</p>
  {/if}

  <p class="kind-row">{m.inspector_kind_label()}: {kindLabel(kind)}</p>

  {#if 'call' in task && task.call === 'http'}
    <CallHttpForm {task} onchange={onpatch} />
  {:else if 'set' in task && typeof task.set === 'object' && task.set !== null}
    <SetForm {task} onchange={onpatch} />
  {:else if 'wait' in task}
    <WaitForm {task} onchange={onpatch} />
  {:else if 'for' in task}
    <ForForm {task} onchange={onpatch} />
  {:else if 'switch' in task}
    <SwitchForm {task} {siblingNames} onchange={onpatch} />
  {:else if 'fork' in task || 'try' in task || 'do' in task}
    <p class="hint">{m.inspector_subcanvas_hint()}</p>
  {:else}
    <p class="hint">{m.inspector_fallback_hint()}</p>
    <pre>{JSON.stringify(task, null, 2)}</pre>
  {/if}
</div>

<style>
  .inspector {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-family: ui-sans-serif, system-ui, sans-serif;
  }

  h2 {
    margin: 0;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
  }

  .kind-row {
    margin: 0;
    font-size: 0.8rem;
    color: #475569;
  }

  .error {
    margin: 0;
    color: #b91c1c;
    font-size: 0.8rem;
  }

  .hint {
    margin: 0;
    color: #64748b;
    font-size: 0.85rem;
  }

  pre {
    margin: 0;
    padding: 0.5rem;
    background: #f1f5f9;
    border-radius: 0.4rem;
    font-size: 0.75rem;
    overflow: auto;
  }

  :global(.inspector label) {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.8rem;
    color: #334155;
  }

  :global(.inspector input),
  :global(.inspector select) {
    padding: 0.3rem 0.4rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.3rem;
    font: inherit;
    font-size: 0.85rem;
  }

  :global(.inspector fieldset) {
    border: 1px solid #e2e8f0;
    border-radius: 0.4rem;
    margin: 0;
  }

  :global(.inspector .radio) {
    flex-direction: row;
    align-items: center;
    gap: 0.3rem;
  }
</style>
