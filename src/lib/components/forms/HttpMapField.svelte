<script lang="ts">
  import { m } from '$lib/paraglide/messages';
  import { untrack } from 'svelte';

  import {
    type KeyValueEntry,
    type StringMap,
    entriesToMap,
    isMapField,
    mapToEntries,
  } from './callHttpForm';

  // Shared editor for `call: http`'s `headers` and `query` — structurally
  // identical (a name→string map, or a single whole-value runtime expression).
  let {
    label,
    value,
    onchange,
  }: {
    label: string;
    value: StringMap | string | undefined;
    onchange: (value: StringMap | string | undefined) => void;
  } = $props();

  // A whole-value runtime expression has no structured editor here — shown
  // read-only (edited in YAML), the same fallback a set-expression gets. The
  // map-vs-expression split mirrors set's `isSetObjectForm` (see `isMapField`).
  const expression = $derived(typeof value === 'string' ? value : null);

  // Local editable rows, seeded once from the loaded map (the inspector re-keys
  // per selection, so this reinitialises on reselect). Blank rows may exist
  // before they're valid; the key/value/add/remove interaction mirrors SetForm.
  let entries = $state<KeyValueEntry[]>(
    untrack(() => (isMapField(value) ? mapToEntries(value) : [])),
  );

  function emit() {
    onchange(entriesToMap(entries));
  }
  function updateKey(index: number, key: string) {
    entries[index].key = key;
    emit();
  }
  function updateValue(index: number, entryValue: string) {
    entries[index].value = entryValue;
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

<fieldset>
  <legend>{label}</legend>
  {#if expression !== null}
    <p class="hint">{m.form_http_map_expression()}</p>
    <pre>{expression}</pre>
  {:else}
    {#each entries as entry, index (index)}
      <div class="entry">
        <label>
          <span>{m.form_http_map_name()}</span>
          <input
            value={entry.key}
            oninput={(e) => updateKey(index, e.currentTarget.value)}
          />
        </label>
        <label>
          <span>{m.form_http_map_value()}</span>
          <input
            value={entry.value}
            oninput={(e) => updateValue(index, e.currentTarget.value)}
          />
        </label>
        <button
          type="button"
          title={m.form_http_map_remove()}
          aria-label={m.form_http_map_remove()}
          onclick={() => removeEntry(index)}>✕</button
        >
      </div>
    {/each}
    <button type="button" onclick={addEntry}>{m.form_http_map_add()}</button>
  {/if}
</fieldset>

<style>
  fieldset {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.5rem;
  }

  legend {
    padding: 0 0.25rem;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #64748b;
  }

  /* Stack name/value/remove vertically so a row never overflows the fixed-width
     inspector panel — mirrors SetForm's `.entry` convention. */
  .entry {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.5rem;
    margin-bottom: 0.3rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.4rem;
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
</style>
