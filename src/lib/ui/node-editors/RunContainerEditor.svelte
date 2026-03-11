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
    ActivityArg,
    AssignmentValue,
    Node,
    RunContainerConfig,
    TaskNode,
  } from '$lib/tasks/model';

  import ArgumentsList from './ArgumentsList.svelte';
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

  const taskNode = $derived(node as TaskNode);
  const config = $derived(taskNode.config as RunContainerConfig);
  const args = $derived(config.arguments ?? []);
  const envEntries = $derived(Object.entries(config.environment ?? {}));

  // ---------------------------------------------------------------------------
  // Env var UI state
  // ---------------------------------------------------------------------------

  let envOverrides = $state<Record<string, ValueOverride>>({});
  let envErrors = $state<Record<string, string>>({});

  function getEnvOverride(key: string, val: AssignmentValue): ValueOverride {
    return envOverrides[key] ?? inferOverride(val);
  }

  // ---------------------------------------------------------------------------
  // Emit helpers
  // ---------------------------------------------------------------------------

  function emit(updates: Partial<Omit<RunContainerConfig, 'kind'>>): void {
    onupdate({ ...taskNode, config: { ...config, ...updates } });
  }

  function emitEnv(env: Record<string, AssignmentValue>): void {
    emit({ environment: Object.keys(env).length === 0 ? undefined : env });
  }

  // ---------------------------------------------------------------------------
  // Handlers — image
  // ---------------------------------------------------------------------------

  let imageError = $state(false);

  function handleImageChange(value: string): void {
    if (value.trim() === '') {
      imageError = true;
    } else {
      imageError = false;
      emit({ image: value });
    }
  }

  // ---------------------------------------------------------------------------
  // Handlers — environment variables
  // ---------------------------------------------------------------------------

  function handleEnvKeyChange(
    index: number,
    oldKey: string,
    newKey: string,
  ): void {
    if (newKey === oldKey) return;
    const next = Object.fromEntries(
      envEntries.map(([k, v], i) => (i === index ? [newKey, v] : [k, v])),
    );
    envOverrides = Object.fromEntries(
      Object.entries(envOverrides).filter(([k]) => k !== oldKey),
    );
    envErrors = Object.fromEntries(
      Object.entries(envErrors).filter(([k]) => k !== oldKey),
    );
    emitEnv(next);
  }

  function handleEnvValueChange(
    index: number,
    key: string,
    val: AssignmentValue,
    raw: string,
  ): void {
    const override = getEnvOverride(key, val);
    const result = coerceWithOverride(raw, override);
    if (result.ok) {
      envErrors = Object.fromEntries(
        Object.entries(envErrors).filter(([k]) => k !== key),
      );
      const next = Object.fromEntries(
        envEntries.map(([k, v], i) =>
          i === index ? [k, result.value] : [k, v],
        ),
      );
      emitEnv(next);
    } else {
      envErrors = { ...envErrors, [key]: result.errorKey };
    }
  }

  function handleEnvOverrideChange(
    key: string,
    val: AssignmentValue,
    newOverride: ValueOverride,
  ): void {
    envOverrides = { ...envOverrides, [key]: newOverride };
    if (newOverride === 'null') {
      envErrors = Object.fromEntries(
        Object.entries(envErrors).filter(([k]) => k !== key),
      );
      emitEnv(
        Object.fromEntries(
          envEntries.map(([k, v]) => [k, k === key ? null : v]),
        ),
      );
      return;
    }
    const raw = displayValue(val);
    const result = coerceWithOverride(raw, newOverride);
    if (result.ok) {
      envErrors = Object.fromEntries(
        Object.entries(envErrors).filter(([k]) => k !== key),
      );
      emitEnv(
        Object.fromEntries(
          envEntries.map(([k, v]) => [k, k === key ? result.value : v]),
        ),
      );
    } else {
      envErrors = { ...envErrors, [key]: result.errorKey };
    }
  }

  function handleEnvRemove(index: number, key: string): void {
    const next = Object.fromEntries(envEntries.filter((_, i) => i !== index));
    envOverrides = Object.fromEntries(
      Object.entries(envOverrides).filter(([k]) => k !== key),
    );
    envErrors = Object.fromEntries(
      Object.entries(envErrors).filter(([k]) => k !== key),
    );
    emitEnv(next);
  }

  function handleEnvAdd(): void {
    const existing = config.environment ?? {};
    let i = 1;
    while (Object.prototype.hasOwnProperty.call(existing, `VAR${i}`)) i++;
    emitEnv({ ...existing, [`VAR${i}`]: '' });
  }

  // ---------------------------------------------------------------------------
  // Handlers — other fields
  // ---------------------------------------------------------------------------

  function handleWorkingDirChange(value: string): void {
    emit({ workingDirectory: value || undefined });
  }

  function handleLifetimeChange(value: string): void {
    emit({ lifetime: value as RunContainerConfig['lifetime'] });
  }

  function handleAwaitChange(value: boolean): void {
    emit({ await: value });
  }

  function handleRemovePorts(): void {
    emit({ ports: undefined });
  }
</script>

<div class="node-editor">
  <h3 class="editor-title">{t('inspector.run.container.title')}</h3>

  <!-- Ports warning (non-blocking) -->
  {#if config.ports !== undefined}
    <div class="ports-warning" role="alert">
      <p class="ports-warning-text">
        {t('inspector.run.container.ports.warning')}
      </p>
      <button
        class="remove-ports-btn"
        type="button"
        onclick={handleRemovePorts}
      >
        {t('inspector.run.container.ports.removePorts')}
      </button>
    </div>
  {/if}

  <!-- Image -->
  <div class="field-row">
    <label class="field-label" for="rc-image">
      {t('inspector.run.container.image.label')}
    </label>
    <input
      id="rc-image"
      class="field-input"
      class:field-input--error={imageError}
      type="text"
      aria-label={t('inspector.run.container.image.label')}
      value={config.image}
      oninput={(e) => handleImageChange(e.currentTarget.value)}
    />
    {#if imageError}
      <p class="field-error" role="alert">
        {t('inspector.run.container.image.required')}
      </p>
    {/if}
  </div>

  <!-- Working directory -->
  <div class="field-row">
    <label class="field-label" for="rc-workdir">
      {t('inspector.run.container.workingDirectory.label')}
    </label>
    <input
      id="rc-workdir"
      class="field-input"
      type="text"
      aria-label={t('inspector.run.container.workingDirectory.label')}
      value={config.workingDirectory ?? ''}
      oninput={(e) => handleWorkingDirChange(e.currentTarget.value)}
    />
  </div>

  <!-- Lifetime -->
  <div class="field-row">
    <label class="field-label" for="rc-lifetime">
      {t('inspector.run.container.lifetime.label')}
    </label>
    <select
      id="rc-lifetime"
      class="field-select"
      aria-label={t('inspector.run.container.lifetime.label')}
      value={config.lifetime ?? 'always'}
      onchange={(e) => handleLifetimeChange(e.currentTarget.value)}
    >
      <option value="always"
        >{t('inspector.run.container.lifetime.always')}</option
      >
      <option value="onSuccess">
        {t('inspector.run.container.lifetime.onSuccess')}
      </option>
      <option value="onError">
        {t('inspector.run.container.lifetime.onError')}
      </option>
      <option value="never"
        >{t('inspector.run.container.lifetime.never')}</option
      >
    </select>
  </div>

  <!-- Await -->
  <div class="field-row field-row--inline">
    <label class="field-label" for="rc-await">
      {t('inspector.run.await.label')}
    </label>
    <input
      id="rc-await"
      type="checkbox"
      checked={config.await !== false}
      onchange={(e) => handleAwaitChange(e.currentTarget.checked)}
    />
  </div>

  <!-- Arguments -->
  <div class="section-group">
    <h4 class="section-subtitle">
      {t('inspector.run.container.arguments.title')}
    </h4>
    <ArgumentsList
      {args}
      addLabel={t('inspector.run.container.arguments.addRow')}
      onchange={(next: ActivityArg[]) =>
        emit({ arguments: next.length === 0 ? undefined : next })}
    />
  </div>

  <!-- Environment variables -->
  <div class="section-group">
    <h4 class="section-subtitle">{t('inspector.run.container.env.title')}</h4>

    {#if envEntries.length > 0}
      <ul class="assignments-list" role="list">
        {#each envEntries as [key, val], i (i)}
          {@const override = getEnvOverride(key, val)}
          {@const error = envErrors[key] ?? null}
          <li class="assignment-item">
            <div class="assignment-row assignment-row--key">
              <input
                class="assignment-input"
                type="text"
                aria-label={t('inspector.run.container.env.keyLabel')}
                value={key}
                oninput={(e) =>
                  handleEnvKeyChange(i, key, e.currentTarget.value)}
              />
              <button
                class="remove-btn"
                type="button"
                aria-label={t('inspector.run.container.env.removeRow')}
                onclick={() => handleEnvRemove(i, key)}>✕</button
              >
            </div>
            <div class="assignment-row assignment-row--value">
              <input
                class="assignment-input"
                class:assignment-input--error={error !== null}
                type="text"
                aria-label={t('inspector.run.container.env.valueLabel')}
                value={displayValue(val)}
                disabled={override === 'null'}
                oninput={(e) =>
                  handleEnvValueChange(i, key, val, e.currentTarget.value)}
              />
              <select
                class="override-select"
                aria-label={t('inspector.run.container.env.overrideLabel', {
                  key,
                })}
                value={override}
                onchange={(e) =>
                  handleEnvOverrideChange(
                    key,
                    val,
                    e.currentTarget.value as ValueOverride,
                  )}
              >
                <option value="auto">{t('inspector.set.overrideAuto')}</option>
                <option value="string">
                  {t('inspector.set.overrideString')}
                </option>
                <option value="number">
                  {t('inspector.set.overrideNumber')}
                </option>
                <option value="boolean">
                  {t('inspector.set.overrideBoolean')}
                </option>
                <option value="null">{t('inspector.set.overrideNull')}</option>
              </select>
            </div>
            {#if error !== null}
              <p class="assignment-error" role="alert">{t(error)}</p>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    <button class="add-btn" type="button" onclick={handleEnvAdd}>
      {t('inspector.run.container.env.addRow')}
    </button>
  </div>
</div>

<style>
  .node-editor {
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid #eee;
  }

  .editor-title {
    margin: 0 0 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #444;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .ports-warning {
    padding: 0.5rem 0.625rem;
    margin-bottom: 0.75rem;
    background: #fff8e1;
    border: 1px solid #f0c040;
    border-radius: 4px;
  }

  .ports-warning-text {
    margin: 0 0 0.375rem;
    font-size: 0.72rem;
    color: #7d4e00;
  }

  .remove-ports-btn {
    padding: 0.2rem 0.5rem;
    background: transparent;
    border: 1px solid #f0c040;
    border-radius: 4px;
    color: #7d4e00;
    font-size: 0.72rem;
    cursor: pointer;
  }

  .remove-ports-btn:hover {
    background: #ffeeba;
  }

  .field-row {
    margin-bottom: 0.625rem;
  }

  .field-row--inline {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .field-label {
    display: block;
    font-size: 0.72rem;
    font-weight: 500;
    color: #666;
    margin-bottom: 0.2rem;
  }

  .field-row--inline .field-label {
    margin-bottom: 0;
  }

  .field-input,
  .field-select {
    width: 100%;
    padding: 0.2rem 0.375rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.78rem;
    color: #111;
    background: #fff;
    box-sizing: border-box;
  }

  .field-input {
    font-family: monospace;
  }

  .field-input:focus,
  .field-select:focus {
    outline: none;
    border-color: #1a56cc;
    box-shadow: 0 0 0 2px rgba(26, 86, 204, 0.15);
  }

  .field-input--error {
    border-color: #c0392b;
    background: #fff8f8;
  }

  .field-input--error:focus {
    border-color: #c0392b;
    box-shadow: 0 0 0 2px rgba(192, 57, 43, 0.15);
  }

  .field-error {
    margin: 0.15rem 0 0;
    font-size: 0.7rem;
    color: #c0392b;
    padding-left: 0.2rem;
  }

  .section-group {
    margin-top: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px solid #f0f0f0;
  }

  .section-subtitle {
    margin: 0 0 0.375rem;
    font-size: 0.7rem;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .assignments-list {
    list-style: none;
    margin: 0 0 0.375rem;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .assignment-item {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
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
