<!--
  ~ Copyright 2025 - 2026 Zigflow authors <https://github.com/zigflow/studio/graphs/contributors>
  ~
  ~ Licensed under the Apache License, Version 2.0 (the "License");
  ~ you may not use this file except in compliance with the License.
  ~ You may obtain a copy of the License at
  ~
  ~     http://www.apache.org/licenses/LICENSE-2.0
  ~
  ~ Unless required by applicable law or agreed to in writing, software
  ~ distributed under the License is distributed on an "AS IS" BASIS,
  ~ WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  ~ See the License for the specific language governing permissions and
  ~ limitations under the License.
  -->

<!--
  Two-part value selector: [ Source ▼ ] [ Value input ]

  Source modes:
    input      — dropdown of input schema paths → stored as ${ $input.<path> }
    literal    — plain text input              → stored verbatim
    expression — text input                   → stored verbatim (full ${ } allowed)
-->

<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';

  import {
    type ValueSource,
    buildInputValue,
    detectSource,
    parseInputPath,
    resolveInputPathType,
  } from './value-source';

  interface Props {
    /** The stored value string (e.g. `${ $input.items }` or `"hello"`). */
    value: string;
    /** Flat dot-notation paths extracted from the input schema. */
    inputPaths: string[];
    /** Emitted whenever the stored value changes. */
    onchange: (value: string) => void;
    /** Optional aria-label for the value input / select. */
    ariaLabel?: string;
    /**
     * Raw JSON Schema document from `workflowFile.input.schema.document`.
     * When provided and source is `input`, a read-only type hint is shown.
     */
    schemaDocument?: Record<string, unknown>;
  }

  let {
    value,
    inputPaths,
    onchange,
    ariaLabel = '',
    schemaDocument,
  }: Props = $props();

  // ---------------------------------------------------------------------------
  // Derive initial source + inner value from the incoming stored value.
  // Re-derived whenever `value` changes from the outside (e.g. on reload).
  // ---------------------------------------------------------------------------

  // Initialize with defaults; $effect below sets real values on first run
  // and re-syncs whenever the parent `value` prop changes.
  let source = $state<ValueSource>('literal');
  let innerValue = $state('');

  // Sync local state from the external `value` prop.
  // Only reads `value` (the prop) — no circular dependency.
  $effect(() => {
    const newSource = detectSource(value);
    source = newSource;
    innerValue = newSource === 'input' ? parseInputPath(value) : value;
  });

  // Read-only type hint: only shown when source is input and schema is available.
  const typeHint = $derived(
    source === 'input' && schemaDocument != null && innerValue !== ''
      ? resolveInputPathType(schemaDocument, innerValue)
      : null,
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleSourceChange(newSource: ValueSource): void {
    source = newSource;
    // Reset inner value and emit a sensible stored value.
    if (newSource === 'input') {
      const firstPath = inputPaths[0] ?? '';
      innerValue = firstPath;
      onchange(firstPath ? buildInputValue(firstPath) : '');
    } else {
      innerValue = '';
      onchange('');
    }
  }

  function handleInputPathChange(path: string): void {
    innerValue = path;
    onchange(path ? buildInputValue(path) : '');
  }

  function handleTextChange(text: string): void {
    innerValue = text;
    onchange(text);
  }
</script>

<div class="vss">
  <select
    class="vss-source"
    aria-label={t('valueSource.sourceLabel')}
    value={source}
    onchange={(e) => handleSourceChange(e.currentTarget.value as ValueSource)}
  >
    <option value="input">{t('valueSource.input')}</option>
    <option value="literal">{t('valueSource.literal')}</option>
    <option value="expression">{t('valueSource.expression')}</option>
  </select>

  {#if source === 'input'}
    {#if inputPaths.length === 0}
      <span class="vss-no-paths">{t('valueSource.noInputPaths')}</span>
    {:else}
      <select
        class="vss-value vss-value--select"
        aria-label={ariaLabel || t('valueSource.valueLabel')}
        value={innerValue}
        onchange={(e) => handleInputPathChange(e.currentTarget.value)}
      >
        {#each inputPaths as path (path)}
          <option value={path}>{path}</option>
        {/each}
      </select>
      {#if typeHint !== null}
        <span class="vss-type-hint" aria-hidden="true"
          >({t(`input.type.${typeHint}`)})</span
        >
      {/if}
    {/if}
  {:else}
    <input
      class="vss-value vss-value--text"
      type="text"
      aria-label={ariaLabel || t('valueSource.valueLabel')}
      value={innerValue}
      oninput={(e) => handleTextChange(e.currentTarget.value)}
    />
  {/if}
</div>

<style>
  .vss {
    display: flex;
    gap: 0.375rem;
    align-items: center;
    width: 100%;
  }

  .vss-source {
    flex-shrink: 0;
    padding: 0.2rem 0.375rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.78rem;
    color: #444;
    background: #fafafa;
    cursor: pointer;
  }

  .vss-source:focus {
    outline: none;
    border-color: #1a56cc;
    box-shadow: 0 0 0 2px rgba(26, 86, 204, 0.15);
  }

  .vss-value {
    flex: 1;
    min-width: 0;
    padding: 0.2rem 0.375rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.78rem;
    box-sizing: border-box;
  }

  .vss-value--text {
    font-family: monospace;
    color: #111;
    background: #fff;
  }

  .vss-value--select {
    color: #111;
    background: #fff;
    cursor: pointer;
  }

  .vss-value:focus {
    outline: none;
    border-color: #1a56cc;
    box-shadow: 0 0 0 2px rgba(26, 86, 204, 0.15);
  }

  .vss-no-paths {
    flex: 1;
    font-size: 0.75rem;
    color: #999;
    font-style: italic;
    padding: 0.2rem 0;
  }

  .vss-type-hint {
    flex-shrink: 0;
    font-size: 0.72rem;
    color: #888;
    white-space: nowrap;
  }
</style>
