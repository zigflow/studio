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

<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';
  import type { AssignmentValue, Node } from '$lib/tasks/model';
  import { ZIGFLOW_ID_KEY } from '$lib/tasks/model';

  import {
    type ValueOverride,
    coerceWithOverride,
    displayValue,
    inferOverride,
  } from '../node-editors/set-value';

  interface Props {
    node: Node;
    onupdate: (node: Node) => void;
  }

  let { node, onupdate }: Props = $props();

  // ---------------------------------------------------------------------------
  // `if` field
  // ---------------------------------------------------------------------------

  const ifValue = $derived(node.if ?? '');

  function handleIfChange(raw: string): void {
    const trimmed = raw.trim();
    onupdate({ ...node, if: trimmed || undefined } as Node);
  }

  // ---------------------------------------------------------------------------
  // `metadata` — key/value editor (JSON primitives only)
  // ---------------------------------------------------------------------------

  type MetaRecord = Record<string, AssignmentValue>;

  // Only show entries whose values are JSON primitives.
  // Objects/arrays from round-tripping are preserved in the IR but hidden here.
  function isPrimitive(v: unknown): v is AssignmentValue {
    return (
      v === null ||
      typeof v === 'string' ||
      typeof v === 'number' ||
      typeof v === 'boolean'
    );
  }

  const metaEntries = $derived(
    Object.entries(node.metadata ?? {}).filter(
      (entry): entry is [string, AssignmentValue] =>
        entry[0] !== ZIGFLOW_ID_KEY && isPrimitive(entry[1]),
    ),
  );

  // Per-row UI state — not persisted to the IR.
  let overrides = $state<Record<string, ValueOverride>>({});
  let valueErrors = $state<Record<string, string>>({});
  let keyErrors = $state<Record<string, string>>({});

  function getOverride(key: string, val: AssignmentValue): ValueOverride {
    return overrides[key] ?? inferOverride(val);
  }

  function emitMetadata(primitiveMeta: MetaRecord): void {
    // Preserve entries the editor doesn't show: non-primitive values AND the
    // internal ZIGFLOW_ID_KEY (a string, so not caught by the non-primitive
    // check alone). Without this, deleting the last visible row would wipe it.
    const original = node.metadata ?? {};
    const preserved = Object.fromEntries(
      Object.entries(original).filter(
        ([k, v]) => k === ZIGFLOW_ID_KEY || !isPrimitive(v),
      ),
    );
    const merged = { ...preserved, ...primitiveMeta };
    onupdate({
      ...node,
      metadata: Object.keys(merged).length === 0 ? undefined : merged,
    } as Node);
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  function handleKeyChange(
    index: number,
    oldKey: string,
    newKey: string,
  ): void {
    if (newKey === oldKey) return;

    // Duplicate key check — compare against all other entries at different indices.
    const isDuplicate = metaEntries.some(
      ([k], i) => k === newKey && i !== index,
    );
    if (isDuplicate) {
      keyErrors = { ...keyErrors, [oldKey]: 'errors.duplicateKey' };
      return;
    }

    // Clear state keyed to the old name.
    keyErrors = Object.fromEntries(
      Object.entries(keyErrors).filter(([k]) => k !== oldKey),
    );
    overrides = Object.fromEntries(
      Object.entries(overrides).filter(([k]) => k !== oldKey),
    );
    valueErrors = Object.fromEntries(
      Object.entries(valueErrors).filter(([k]) => k !== oldKey),
    );

    const next = Object.fromEntries(
      metaEntries.map(([k, v], i) => (i === index ? [newKey, v] : [k, v])),
    ) as MetaRecord;
    emitMetadata(next);
  }

  function handleValueChange(
    index: number,
    key: string,
    val: AssignmentValue,
    raw: string,
  ): void {
    const override = getOverride(key, val);
    const result = coerceWithOverride(raw, override);
    if (result.ok) {
      valueErrors = Object.fromEntries(
        Object.entries(valueErrors).filter(([k]) => k !== key),
      );
      const next = Object.fromEntries(
        metaEntries.map(([k, v], i) =>
          i === index ? [k, result.value] : [k, v],
        ),
      ) as MetaRecord;
      emitMetadata(next);
    } else {
      valueErrors = { ...valueErrors, [key]: result.errorKey };
    }
  }

  function handleOverrideChange(
    key: string,
    val: AssignmentValue,
    newOverride: ValueOverride,
  ): void {
    overrides = { ...overrides, [key]: newOverride };

    if (newOverride === 'null') {
      valueErrors = Object.fromEntries(
        Object.entries(valueErrors).filter(([k]) => k !== key),
      );
      emitMetadata(
        Object.fromEntries(
          metaEntries.map(([k, v]) => [k, k === key ? null : v]),
        ) as MetaRecord,
      );
      return;
    }

    const raw = displayValue(val);
    const result = coerceWithOverride(raw, newOverride);
    if (result.ok) {
      valueErrors = Object.fromEntries(
        Object.entries(valueErrors).filter(([k]) => k !== key),
      );
      emitMetadata(
        Object.fromEntries(
          metaEntries.map(([k, v]) => [k, k === key ? result.value : v]),
        ) as MetaRecord,
      );
    } else {
      valueErrors = { ...valueErrors, [key]: result.errorKey };
    }
  }

  function handleRemove(index: number, key: string): void {
    overrides = Object.fromEntries(
      Object.entries(overrides).filter(([k]) => k !== key),
    );
    valueErrors = Object.fromEntries(
      Object.entries(valueErrors).filter(([k]) => k !== key),
    );
    keyErrors = Object.fromEntries(
      Object.entries(keyErrors).filter(([k]) => k !== key),
    );
    emitMetadata(
      Object.fromEntries(
        metaEntries.filter((_, i) => i !== index),
      ) as MetaRecord,
    );
  }

  function handleAdd(): void {
    const meta = (node.metadata ?? {}) as MetaRecord;
    let i = 1;
    while (Object.prototype.hasOwnProperty.call(meta, `key${i}`)) i++;
    emitMetadata({ ...meta, [`key${i}`]: '' });
  }
</script>

<div class="common-fields">
  <h3 class="section-title">{t('inspector.common.title')}</h3>

  <!-- if -->
  <div class="field-row">
    <label class="field-label" for="common-if-input">
      {t('inspector.common.if.label')}
    </label>
    <input
      id="common-if-input"
      class="field-input"
      type="text"
      value={ifValue}
      oninput={(e) => handleIfChange(e.currentTarget.value)}
    />
  </div>

  <!-- metadata -->
  <p class="field-label">{t('inspector.common.metadata.title')}</p>

  {#if metaEntries.length > 0}
    <ul class="meta-list" role="list">
      {#each metaEntries as [key, val], i (i)}
        {@const override = getOverride(key, val)}
        {@const vError = valueErrors[key] ?? null}
        {@const kError = keyErrors[key] ?? null}
        <li class="meta-item">
          <!-- Row 1: key input + remove button -->
          <div class="meta-row meta-row--key">
            <input
              class="meta-input"
              class:meta-input--error={kError !== null}
              type="text"
              aria-label={t('inspector.common.metadata.keyLabel')}
              value={key}
              oninput={(e) => handleKeyChange(i, key, e.currentTarget.value)}
            />
            <button
              class="remove-btn"
              type="button"
              aria-label={t('inspector.common.metadata.removeRow')}
              onclick={() => handleRemove(i, key)}
            >
              ✕
            </button>
          </div>
          {#if kError !== null}
            <p class="meta-error" role="alert">{t(kError)}</p>
          {/if}
          <!-- Row 2: value input + type override select -->
          <div class="meta-row meta-row--value">
            <input
              class="meta-input"
              class:meta-input--error={vError !== null}
              type="text"
              aria-label={t('inspector.common.metadata.valueLabel')}
              value={displayValue(val)}
              disabled={override === 'null'}
              oninput={(e) =>
                handleValueChange(i, key, val, e.currentTarget.value)}
            />
            <select
              class="override-select"
              aria-label={t('inspector.common.metadata.overrideLabel', { key })}
              value={override}
              onchange={(e) =>
                handleOverrideChange(
                  key,
                  val,
                  e.currentTarget.value as ValueOverride,
                )}
            >
              <option value="auto"
                >{t('inspector.common.metadata.type.auto')}</option
              >
              <option value="string"
                >{t('inspector.common.metadata.type.string')}</option
              >
              <option value="number"
                >{t('inspector.common.metadata.type.number')}</option
              >
              <option value="boolean"
                >{t('inspector.common.metadata.type.boolean')}</option
              >
              <option value="null"
                >{t('inspector.common.metadata.type.null')}</option
              >
            </select>
          </div>
          {#if vError !== null}
            <p class="meta-error" role="alert">{t(vError)}</p>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <button class="add-btn" type="button" onclick={handleAdd}>
    {t('inspector.common.metadata.addRow')}
  </button>
</div>

<style>
  .common-fields {
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid #eee;
  }

  .section-title {
    margin: 0 0 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #444;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .field-row {
    margin-bottom: 0.75rem;
  }

  .field-label {
    display: block;
    font-size: 0.72rem;
    font-weight: 500;
    color: #666;
    margin: 0 0 0.3rem;
  }

  .field-input {
    width: 100%;
    padding: 0.2rem 0.375rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.78rem;
    font-family: monospace;
    color: #111;
    background: #fff;
    box-sizing: border-box;
  }

  .field-input:focus {
    outline: none;
    border-color: #1a56cc;
    box-shadow: 0 0 0 2px rgba(26, 86, 204, 0.15);
  }

  .meta-list {
    list-style: none;
    margin: 0 0 0.5rem;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .meta-row {
    display: grid;
    gap: 0.25rem;
    align-items: center;
  }

  .meta-row--key {
    grid-template-columns: 1fr 1.5rem;
  }

  .meta-row--value {
    grid-template-columns: 1fr auto;
  }

  .meta-input {
    padding: 0.2rem 0.375rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.78rem;
    font-family: monospace;
    color: #111;
    background: #fff;
    min-width: 0;
  }

  .meta-input:focus {
    outline: none;
    border-color: #1a56cc;
    box-shadow: 0 0 0 2px rgba(26, 86, 204, 0.15);
  }

  .meta-input--error {
    border-color: #c0392b;
    background: #fff8f8;
  }

  .meta-input--error:focus {
    border-color: #c0392b;
    box-shadow: 0 0 0 2px rgba(192, 57, 43, 0.15);
  }

  .meta-input:disabled {
    background: #f5f5f5;
    color: #999;
    cursor: not-allowed;
  }

  .override-select {
    padding: 0.2rem 0.2rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.72rem;
    font-family: inherit;
    color: #555;
    background: #fff;
    cursor: pointer;
    max-width: 4.5rem;
  }

  .override-select:focus {
    outline: none;
    border-color: #1a56cc;
  }

  .meta-error {
    margin: 0;
    font-size: 0.7rem;
    color: #c0392b;
    padding-left: 0.2rem;
  }

  .remove-btn {
    padding: 0;
    width: 1.5rem;
    height: 1.5rem;
    background: transparent;
    border: 1px solid #e0a0a0;
    border-radius: 4px;
    color: #c0392b;
    font-size: 0.65rem;
    cursor: pointer;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .remove-btn:hover {
    background: #fff0f0;
  }

  .add-btn {
    width: 100%;
    padding: 0.3rem 0.5rem;
    background: transparent;
    border: 1px dashed #aaa;
    border-radius: 4px;
    color: #555;
    font-size: 0.78rem;
    cursor: pointer;
    text-align: center;
  }

  .add-btn:hover {
    border-color: #1a56cc;
    color: #1a56cc;
    background: #f0f4ff;
  }
</style>
