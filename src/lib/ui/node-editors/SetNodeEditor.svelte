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
  import type {
    AssignmentValue,
    Node,
    SetConfig,
    TaskNode,
  } from '$lib/tasks/model';

  import {
    type ValueOverride,
    coerceWithOverride,
    displayValue,
    inferOverride,
  } from './set-value';

  interface Props {
    node: Node;
    onupdate: (node: Node) => void;
  }

  let { node, onupdate }: Props = $props();

  // Safe narrowing: registry guarantees this editor only receives set nodes.
  const setNode = $derived(node as TaskNode);
  const config = $derived(setNode.config as SetConfig);
  const entries = $derived(Object.entries(config.assignments));

  // ---------------------------------------------------------------------------
  // Per-row UI state (not persisted to IR)
  // ---------------------------------------------------------------------------

  // Override mode keyed by assignment key name.
  let overrides = $state<Record<string, ValueOverride>>({});

  // Validation error keyed by assignment key name. Holds an i18n key on error.
  let errors = $state<Record<string, string>>({});

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function getOverride(key: string, val: AssignmentValue): ValueOverride {
    return overrides[key] ?? inferOverride(val);
  }

  function emitAssignments(assignments: SetConfig['assignments']): void {
    onupdate({ ...setNode, config: { ...config, assignments } });
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  function handleKeyChange(
    index: number,
    oldKey: string,
    newKey: string,
  ): void {
    const next = Object.fromEntries(
      entries.map(([k, v], i) => (i === index ? [newKey, v] : [k, v])),
    );
    // Drop override and error for the old key so the new key inherits a fresh
    // inferred override (value unchanged, so inference is stable).
    if (oldKey !== newKey) {
      overrides = Object.fromEntries(
        Object.entries(overrides).filter(([k]) => k !== oldKey),
      );
      errors = Object.fromEntries(
        Object.entries(errors).filter(([k]) => k !== oldKey),
      );
    }
    emitAssignments(next);
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
      errors = Object.fromEntries(
        Object.entries(errors).filter(([k]) => k !== key),
      );
      const next = Object.fromEntries(
        entries.map(([k, v], i) => (i === index ? [k, result.value] : [k, v])),
      );
      emitAssignments(next);
    } else {
      errors = { ...errors, [key]: result.errorKey };
      // Do not emit: keep the last valid value in the IR.
    }
  }

  function handleOverrideChange(
    key: string,
    val: AssignmentValue,
    newOverride: ValueOverride,
  ): void {
    overrides = { ...overrides, [key]: newOverride };

    if (newOverride === 'null') {
      // Null override: store null immediately, clear any error.
      errors = Object.fromEntries(
        Object.entries(errors).filter(([k]) => k !== key),
      );
      emitAssignments(
        Object.fromEntries(entries.map(([k, v]) => [k, k === key ? null : v])),
      );
      return;
    }

    // Re-validate the currently displayed value under the new override.
    const raw = displayValue(val);
    const result = coerceWithOverride(raw, newOverride);
    if (result.ok) {
      errors = Object.fromEntries(
        Object.entries(errors).filter(([k]) => k !== key),
      );
      emitAssignments(
        Object.fromEntries(
          entries.map(([k, v]) => [k, k === key ? result.value : v]),
        ),
      );
    } else {
      errors = { ...errors, [key]: result.errorKey };
      // Keep existing IR value; error guides the user to fix the input.
    }
  }

  function handleRemove(index: number, key: string): void {
    const next = Object.fromEntries(entries.filter((_, i) => i !== index));
    overrides = Object.fromEntries(
      Object.entries(overrides).filter(([k]) => k !== key),
    );
    errors = Object.fromEntries(
      Object.entries(errors).filter(([k]) => k !== key),
    );
    emitAssignments(next);
  }

  function handleAdd(): void {
    let i = 1;
    while (Object.prototype.hasOwnProperty.call(config.assignments, `var${i}`))
      i++;
    emitAssignments({ ...config.assignments, [`var${i}`]: '' });
  }
</script>

<div class="node-editor">
  <h3 class="editor-title">{t('inspector.set.title')}</h3>

  {#if entries.length > 0}
    <ul class="assignments-list" role="list">
      {#each entries as [key, val], i (i)}
        {@const override = getOverride(key, val)}
        {@const error = errors[key] ?? null}
        <li class="assignment-item">
          <!-- Row 1: key input + remove button -->
          <div class="assignment-row assignment-row--key">
            <input
              class="assignment-input"
              type="text"
              aria-label={t('inspector.set.keyLabel')}
              value={key}
              oninput={(e) => handleKeyChange(i, key, e.currentTarget.value)}
            />
            <button
              class="remove-btn"
              type="button"
              aria-label={t('inspector.set.removeRow')}
              onclick={() => handleRemove(i, key)}
            >
              ✕
            </button>
          </div>
          <!-- Row 2: value input + type override select -->
          <div class="assignment-row assignment-row--value">
            <input
              class="assignment-input"
              class:assignment-input--error={error !== null}
              type="text"
              aria-label={t('inspector.set.valueLabel')}
              value={displayValue(val)}
              disabled={override === 'null'}
              oninput={(e) =>
                handleValueChange(i, key, val, e.currentTarget.value)}
            />
            <select
              class="override-select"
              aria-label={t('inspector.set.overrideLabel', { key })}
              value={override}
              onchange={(e) =>
                handleOverrideChange(
                  key,
                  val,
                  e.currentTarget.value as ValueOverride,
                )}
            >
              <option value="auto">{t('inspector.set.overrideAuto')}</option>
              <option value="string">{t('inspector.set.overrideString')}</option
              >
              <option value="number">{t('inspector.set.overrideNumber')}</option
              >
              <option value="boolean"
                >{t('inspector.set.overrideBoolean')}</option
              >
              <option value="null">{t('inspector.set.overrideNull')}</option>
            </select>
          </div>
          <!-- Row 3: validation error (shown only when input is invalid) -->
          {#if error !== null}
            <p class="assignment-error" role="alert">{t(error)}</p>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <button class="add-btn" type="button" onclick={handleAdd}>
    {t('inspector.set.addRow')}
  </button>
</div>

<style>
  .node-editor {
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid #eee;
  }

  .editor-title {
    margin: 0 0 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #444;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .assignments-list {
    list-style: none;
    margin: 0 0 0.5rem;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .assignment-item {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .assignment-row {
    display: grid;
    gap: 0.25rem;
    align-items: center;
  }

  .assignment-row--key {
    grid-template-columns: 1fr 1.5rem;
  }

  .assignment-row--value {
    grid-template-columns: 1fr auto;
  }

  .assignment-input {
    padding: 0.2rem 0.375rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.78rem;
    font-family: monospace;
    color: #111;
    background: #fff;
    min-width: 0;
  }

  .assignment-input:focus {
    outline: none;
    border-color: #1a56cc;
    box-shadow: 0 0 0 2px rgba(26, 86, 204, 0.15);
  }

  .assignment-input--error {
    border-color: #c0392b;
    background: #fff8f8;
  }

  .assignment-input--error:focus {
    border-color: #c0392b;
    box-shadow: 0 0 0 2px rgba(192, 57, 43, 0.15);
  }

  .assignment-input:disabled {
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

  .assignment-error {
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
