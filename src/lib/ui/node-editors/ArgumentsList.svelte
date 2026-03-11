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

<!-- Reusable typed-argument list. -->
<!-- Renders a list of ActivityArg values with type-override selects, -->
<!-- move-up/down, and remove controls, plus an "Add argument" button. -->
<!-- The parent is responsible for rendering the section title/subtitle. -->

<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';
  import {
    type ActivityArg,
    type ActivityScalarArg,
    isActivityComplexArg,
  } from '$lib/tasks/model';

  import {
    type ValueOverride,
    coerceWithOverride,
    displayValue,
    inferOverride,
  } from './set-value';

  // Expression arguments are stored as plain strings; this is a display hint.
  type ArgOverride = ValueOverride | 'expression';

  interface Props {
    args: ActivityArg[];
    /** Already-translated label for the "+ Add argument" button. */
    addLabel: string;
    onchange: (args: ActivityArg[]) => void;
  }

  let { args, addLabel, onchange }: Props = $props();

  // ---------------------------------------------------------------------------
  // Per-row UI state (not persisted to IR)
  // ---------------------------------------------------------------------------

  let overrides = $state<Record<number, ArgOverride>>({});
  let argErrors = $state<Record<number, string>>({});

  // ---------------------------------------------------------------------------
  // Override helpers
  // ---------------------------------------------------------------------------

  function getOverride(index: number, val: ActivityScalarArg): ArgOverride {
    return overrides[index] ?? inferArgOverride(val);
  }

  function inferArgOverride(val: ActivityScalarArg): ArgOverride {
    if (typeof val === 'string' && isExpression(val)) return 'auto';
    return inferOverride(val);
  }

  function isExpression(s: string): boolean {
    const trimmed = s.trim();
    return trimmed.startsWith('${') && trimmed.endsWith('}');
  }

  // ---------------------------------------------------------------------------
  // Parse helpers
  // ---------------------------------------------------------------------------

  type ArgParseResult =
    | { ok: true; value: ActivityScalarArg }
    | { ok: false; errorKey: string };

  function parseArgValue(raw: string, override: ArgOverride): ArgParseResult {
    if (override === 'expression') {
      return { ok: true, value: raw };
    }
    const result = coerceWithOverride(raw, override);
    if (result.ok) return { ok: true, value: result.value };
    return { ok: false, errorKey: result.errorKey };
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  function handleValueChange(index: number, raw: string): void {
    const existing = args[index];
    if (existing === undefined || isActivityComplexArg(existing)) return;

    const override = getOverride(index, existing);
    const result = parseArgValue(raw, override);
    if (result.ok) {
      argErrors = Object.fromEntries(
        Object.entries(argErrors).filter(([k]) => Number(k) !== index),
      );
      onchange(args.map((a, i) => (i === index ? result.value : a)));
    } else {
      argErrors = { ...argErrors, [index]: result.errorKey };
    }
  }

  function handleOverrideChange(index: number, newOverride: ArgOverride): void {
    overrides = { ...overrides, [index]: newOverride };

    const existing = args[index];
    if (existing === undefined || isActivityComplexArg(existing)) return;

    if (newOverride === 'null') {
      argErrors = Object.fromEntries(
        Object.entries(argErrors).filter(([k]) => Number(k) !== index),
      );
      onchange(args.map((a, i) => (i === index ? null : a)));
      return;
    }

    if (newOverride === 'expression') {
      argErrors = Object.fromEntries(
        Object.entries(argErrors).filter(([k]) => Number(k) !== index),
      );
      onchange(args.map((a, i) => (i === index ? displayValue(existing) : a)));
      return;
    }

    const raw = displayValue(existing);
    const result = parseArgValue(raw, newOverride);
    if (result.ok) {
      argErrors = Object.fromEntries(
        Object.entries(argErrors).filter(([k]) => Number(k) !== index),
      );
      onchange(args.map((a, i) => (i === index ? result.value : a)));
    } else {
      argErrors = { ...argErrors, [index]: result.errorKey };
    }
  }

  function handleRemove(index: number): void {
    overrides = Object.fromEntries(
      Object.entries(overrides)
        .filter(([k]) => Number(k) !== index)
        .map(([k, v]) => [Number(k) > index ? Number(k) - 1 : k, v]),
    );
    argErrors = Object.fromEntries(
      Object.entries(argErrors)
        .filter(([k]) => Number(k) !== index)
        .map(([k, v]) => [Number(k) > index ? Number(k) - 1 : k, v]),
    );
    onchange(args.filter((_, i) => i !== index));
  }

  function handleMoveUp(index: number): void {
    if (index === 0) return;
    const next = [...args];
    [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
    const prevOvr = overrides[index - 1];
    const curOvr = overrides[index];
    const newOverrides = { ...overrides };
    if (curOvr !== undefined) newOverrides[index - 1] = curOvr;
    else delete newOverrides[index - 1];
    if (prevOvr !== undefined) newOverrides[index] = prevOvr;
    else delete newOverrides[index];
    overrides = newOverrides;
    onchange(next);
  }

  function handleMoveDown(index: number): void {
    if (index >= args.length - 1) return;
    const next = [...args];
    [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
    const nextOvr = overrides[index + 1];
    const curOvr = overrides[index];
    const newOverrides = { ...overrides };
    if (nextOvr !== undefined) newOverrides[index] = nextOvr;
    else delete newOverrides[index];
    if (curOvr !== undefined) newOverrides[index + 1] = curOvr;
    else delete newOverrides[index + 1];
    overrides = newOverrides;
    onchange(next);
  }

  function handleAdd(): void {
    onchange([...args, '']);
  }
</script>

{#if args.length > 0}
  <ul class="arg-list" role="list">
    {#each args as arg, i (i)}
      <li class="arg-item">
        {#if isActivityComplexArg(arg)}
          <!-- Complex value: read-only display -->
          <div class="arg-row">
            <span class="arg-complex-hint">
              {t('inspector.callActivity.arguments.complexHint')}
            </span>
            <div class="arg-controls">
              <button
                class="move-btn"
                type="button"
                aria-label={t('inspector.callActivity.arguments.moveUp')}
                disabled={i === 0}
                onclick={() => handleMoveUp(i)}>↑</button
              >
              <button
                class="move-btn"
                type="button"
                aria-label={t('inspector.callActivity.arguments.moveDown')}
                disabled={i === args.length - 1}
                onclick={() => handleMoveDown(i)}>↓</button
              >
              <button
                class="remove-btn"
                type="button"
                aria-label={t('inspector.callActivity.arguments.removeRow')}
                onclick={() => handleRemove(i)}>✕</button
              >
            </div>
          </div>
        {:else}
          {@const override = getOverride(i, arg)}
          {@const error = argErrors[i] ?? null}
          <div class="arg-row">
            <input
              class="arg-input"
              class:arg-input--error={error !== null}
              class:arg-input--expression={override === 'auto' &&
                typeof arg === 'string' &&
                isExpression(arg)}
              type="text"
              aria-label={t('inspector.callActivity.arguments.valueLabel')}
              value={displayValue(arg)}
              disabled={override === 'null'}
              oninput={(e) => handleValueChange(i, e.currentTarget.value)}
            />
            <select
              class="override-select"
              aria-label={t('inspector.callActivity.arguments.typeLabel', {
                index: i + 1,
              })}
              value={override}
              onchange={(e) =>
                handleOverrideChange(i, e.currentTarget.value as ArgOverride)}
            >
              <option value="auto"
                >{t('inspector.callActivity.arguments.overrideAuto')}</option
              >
              <option value="string"
                >{t('inspector.callActivity.arguments.overrideString')}</option
              >
              <option value="number"
                >{t('inspector.callActivity.arguments.overrideNumber')}</option
              >
              <option value="boolean"
                >{t('inspector.callActivity.arguments.overrideBoolean')}</option
              >
              <option value="null"
                >{t('inspector.callActivity.arguments.overrideNull')}</option
              >
              <option value="expression"
                >{t(
                  'inspector.callActivity.arguments.overrideExpression',
                )}</option
              >
            </select>
            <div class="arg-controls">
              <button
                class="move-btn"
                type="button"
                aria-label={t('inspector.callActivity.arguments.moveUp')}
                disabled={i === 0}
                onclick={() => handleMoveUp(i)}>↑</button
              >
              <button
                class="move-btn"
                type="button"
                aria-label={t('inspector.callActivity.arguments.moveDown')}
                disabled={i === args.length - 1}
                onclick={() => handleMoveDown(i)}>↓</button
              >
              <button
                class="remove-btn"
                type="button"
                aria-label={t('inspector.callActivity.arguments.removeRow')}
                onclick={() => handleRemove(i)}>✕</button
              >
            </div>
          </div>
          {#if error !== null}
            <p class="arg-error" role="alert">{t(error)}</p>
          {/if}
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<button class="add-btn" type="button" onclick={handleAdd}>
  {addLabel}
</button>

<style>
  .arg-list {
    list-style: none;
    margin: 0 0 0.375rem;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .arg-item {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .arg-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 0.25rem;
    align-items: center;
  }

  .arg-input {
    padding: 0.2rem 0.375rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.78rem;
    font-family: monospace;
    color: #111;
    background: #fff;
    min-width: 0;
  }

  .arg-input:focus {
    outline: none;
    border-color: #1a56cc;
    box-shadow: 0 0 0 2px rgba(26, 86, 204, 0.15);
  }

  .arg-input--error {
    border-color: #c0392b;
    background: #fff8f8;
  }

  .arg-input--error:focus {
    border-color: #c0392b;
    box-shadow: 0 0 0 2px rgba(192, 57, 43, 0.15);
  }

  .arg-input:disabled {
    background: #f5f5f5;
    color: #999;
    cursor: not-allowed;
  }

  .arg-input--expression {
    color: #1a56cc;
    font-style: italic;
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
    max-width: 5.5rem;
  }

  .override-select:focus {
    outline: none;
    border-color: #1a56cc;
  }

  .arg-controls {
    display: flex;
    gap: 0.15rem;
  }

  .move-btn {
    padding: 0;
    width: 1.4rem;
    height: 1.4rem;
    background: transparent;
    border: 1px solid #ddd;
    border-radius: 4px;
    color: #555;
    font-size: 0.65rem;
    cursor: pointer;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .move-btn:hover:not(:disabled) {
    border-color: #1a56cc;
    color: #1a56cc;
    background: #f0f4ff;
  }

  .move-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .remove-btn {
    padding: 0;
    width: 1.4rem;
    height: 1.4rem;
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

  .arg-complex-hint {
    font-size: 0.72rem;
    font-style: italic;
    color: #888;
    padding: 0.2rem 0.375rem;
    background: #f8f8f8;
    border: 1px solid #e8e8e8;
    border-radius: 4px;
  }

  .arg-error {
    margin: 0;
    font-size: 0.7rem;
    color: #c0392b;
    padding-left: 0.2rem;
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
