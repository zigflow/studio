<script lang="ts">
  import { isInvalidJsonField } from '$lib/editor/formValues';
  import { m } from '$lib/paraglide/messages';
  import type { SetTask } from '$lib/types/zigflow';
  import { untrack } from 'svelte';

  import {
    type SetValueEntry,
    type SetValueType,
    coerceSetValueForType,
    readSetEntries,
    writeSetTask,
  } from './setForm';

  let { task, onchange }: { task: SetTask; onchange: (t: SetTask) => void } =
    $props();

  // Snapshot the initial object-form entries; parent re-keys on selection. Local
  // state lets in-progress rows (blank key/value) exist before they're valid.
  let entries = $state<SetValueEntry[]>(
    untrack(() =>
      readSetEntries(
        typeof task.set === 'object' && task.set !== null ? task.set : {},
      ),
    ),
  );

  // Explicit label lookup — never a dynamic `m[key]()`, which defeats
  // Paraglide's tree-shaking (DESIGN.md §6).
  const typeOptions: ReadonlyArray<[SetValueType, () => string]> = [
    ['string', m.form_set_type_string],
    ['boolean', m.form_set_type_boolean],
    ['number', m.form_set_type_number],
    ['null', m.form_set_type_null],
    ['json', m.form_set_type_json],
  ];

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
  function updateType(index: number, type: SetValueType) {
    // Re-render the value input for the new type, converting the current value
    // where sensible (else the type's default) — see coerceSetValueForType.
    entries[index].value = coerceSetValueForType(
      entries[index].value,
      entries[index].type,
      type,
    );
    entries[index].type = type;
    emit();
  }
  function addEntry() {
    entries.push({ key: '', type: 'string', value: '' });
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
      <span>{m.form_set_type()}</span>
      <select
        value={entry.type}
        onchange={(e) =>
          updateType(index, e.currentTarget.value as SetValueType)}
      >
        {#each typeOptions as [value, label] (value)}
          <option {value}>{label()}</option>
        {/each}
      </select>
    </label>
    {#if entry.type !== 'null'}
      <!-- A `null` entry has no editable value; the type itself is the value. -->
      <label>
        <span>{m.form_set_value()}</span>
        {#if entry.type === 'boolean'}
          <select
            value={entry.value}
            onchange={(e) => updateValue(index, e.currentTarget.value)}
          >
            <option value="true">{m.form_set_bool_true()}</option>
            <option value="false">{m.form_set_bool_false()}</option>
          </select>
        {:else if entry.type === 'number'}
          <input
            type="number"
            value={entry.value}
            oninput={(e) => updateValue(index, e.currentTarget.value)}
          />
        {:else if entry.type === 'json'}
          <textarea
            rows="3"
            value={entry.value}
            oninput={(e) => updateValue(index, e.currentTarget.value)}
          ></textarea>
        {:else}
          <input
            value={entry.value}
            oninput={(e) => updateValue(index, e.currentTarget.value)}
          />
        {/if}
      </label>
      {#if entry.type === 'json' && isInvalidJsonField(entry.value)}
        <p class="error">{m.inspector_json_error()}</p>
      {/if}
    {/if}
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
  /* Stack Key/Type/Value/remove vertically (label above field) so the row never
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

  /* JSON editor for `json` values — matches the input styling supplied by
     the inspector's global rules, which don't cover `textarea`. */
  textarea {
    padding: 0.3rem 0.4rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.3rem;
    font: inherit;
    font-size: 0.85rem;
    resize: vertical;
  }

  .error {
    margin: 0;
    color: #b91c1c;
    font-size: 0.8rem;
  }
</style>
