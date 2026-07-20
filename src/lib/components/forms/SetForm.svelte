<script lang="ts">
  import { readSetEntries, writeSetTask } from '$lib/editor/inspectorForms';
  import type { SetEntry } from '$lib/editor/inspectorForms';
  import { m } from '$lib/paraglide/messages';
  import type { SetTask } from '$lib/types/zigflow';
  import { untrack } from 'svelte';

  let { task, onchange }: { task: SetTask; onchange: (t: SetTask) => void } =
    $props();

  // Snapshot the initial object-form entries; parent re-keys on selection. Local
  // state lets in-progress rows (blank key/value) exist before they're valid.
  let entries = $state<SetEntry[]>(
    untrack(() =>
      readSetEntries(
        typeof task.set === 'object' && task.set !== null ? task.set : {},
      ),
    ),
  );

  function emit() {
    onchange(writeSetTask(task, entries));
  }

  function updateKey(index: number, value: string) {
    entries[index].key = value;
    emit();
  }
  function updateValue(index: number, value: string) {
    entries[index].value = value;
    emit();
  }
  function addEntry() {
    entries.push({ key: '', value: '' });
    emit();
  }
  function removeEntry(index: number) {
    entries.splice(index, 1);
    emit();
  }
</script>

{#if entries.length === 0}
  <p class="hint">{m.form_set_empty()}</p>
{/if}

{#each entries as entry, index (index)}
  <div class="entry">
    <label>
      <span>{m.form_set_key()}</span>
      <input
        value={entry.key}
        oninput={(e) => updateKey(index, e.currentTarget.value)}
      />
    </label>
    <label>
      <span>{m.form_set_value()}</span>
      <input
        value={entry.value}
        oninput={(e) => updateValue(index, e.currentTarget.value)}
      />
    </label>
    <button
      type="button"
      title={m.form_set_remove()}
      aria-label={m.form_set_remove()}
      onclick={() => removeEntry(index)}>✕</button
    >
  </div>
{/each}

<button type="button" onclick={addEntry}>{m.form_set_add()}</button>

<style>
  /* Stack Key/Value/remove vertically (label above field) so the row never
     overflows the fixed-width inspector panel — mirrors SwitchForm's `.case`
     convention for a repeated group of fields. */
  .entry {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.5rem;
    margin-bottom: 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.4rem;
  }
</style>
