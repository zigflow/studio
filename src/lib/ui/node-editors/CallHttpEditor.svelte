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
  import type { CallHTTPConfig, Node, TaskNode } from '$lib/tasks/model';

  interface Props {
    node: Node;
    onupdate: (node: Node) => void;
  }

  let { node, onupdate }: Props = $props();

  // Safe narrowing: registry guarantees this editor only receives call-http nodes.
  const taskNode = $derived(node as TaskNode);
  const config = $derived(taskNode.config as CallHTTPConfig);
  const headerEntries = $derived(Object.entries(config.headers ?? {}));

  // ---------------------------------------------------------------------------
  // Validation state
  // ---------------------------------------------------------------------------

  // Only set after user interaction — new nodes start without a visible error.
  let endpointError = $state(false);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Emit a shallow-patched config update. */
  function emit(updates: Partial<Omit<CallHTTPConfig, 'kind'>>): void {
    onupdate({ ...taskNode, config: { ...config, ...updates } });
  }

  /** Emit headers, removing the property entirely when the map is empty. */
  function emitHeaders(headers: Record<string, string>): void {
    emit({ headers: Object.keys(headers).length === 0 ? undefined : headers });
  }

  // ---------------------------------------------------------------------------
  // Event handlers — request
  // ---------------------------------------------------------------------------

  function handleMethodChange(value: string): void {
    emit({ method: value as CallHTTPConfig['method'] });
  }

  function handleEndpointChange(value: string): void {
    if (value.trim() === '') {
      endpointError = true;
      // Do not write an empty endpoint to the IR.
    } else {
      endpointError = false;
      emit({ endpoint: value });
    }
  }

  // ---------------------------------------------------------------------------
  // Event handlers — headers
  // ---------------------------------------------------------------------------

  function handleHeaderKeyChange(
    index: number,
    oldKey: string,
    newKey: string,
  ): void {
    if (newKey === oldKey) return;
    const next = Object.fromEntries(
      headerEntries.map(([k, v], i) => (i === index ? [newKey, v] : [k, v])),
    );
    emitHeaders(next);
  }

  function handleHeaderValueChange(
    index: number,
    key: string,
    value: string,
  ): void {
    const next = Object.fromEntries(
      headerEntries.map(([k, v], i) => (i === index ? [k, value] : [k, v])),
    );
    emitHeaders(next);
  }

  function handleHeaderRemove(index: number): void {
    emitHeaders(
      Object.fromEntries(headerEntries.filter((_, i) => i !== index)),
    );
  }

  function handleHeaderAdd(): void {
    const existing = config.headers ?? {};
    let i = 1;
    while (Object.prototype.hasOwnProperty.call(existing, `header${i}`)) i++;
    emitHeaders({ ...existing, [`header${i}`]: '' });
  }

  // ---------------------------------------------------------------------------
  // Event handlers — body
  // ---------------------------------------------------------------------------

  function handleBodyChange(value: string): void {
    emit({ body: value });
  }

  function handleBodyAdd(): void {
    emit({ body: '' });
  }

  function handleBodyRemove(): void {
    emit({ body: undefined });
  }
</script>

<div class="node-editor">
  <h3 class="editor-title">{t('inspector.callHttp.title')}</h3>

  <!-- Method -->
  <div class="field-row">
    <label class="field-label" for="ch-method"
      >{t('inspector.callHttp.method')}</label
    >
    <select
      id="ch-method"
      class="method-select"
      aria-label={t('inspector.callHttp.method')}
      value={config.method}
      onchange={(e) => handleMethodChange(e.currentTarget.value)}
    >
      <option value="get">GET</option>
      <option value="post">POST</option>
      <option value="put">PUT</option>
      <option value="patch">PATCH</option>
      <option value="delete">DELETE</option>
    </select>
  </div>

  <!-- Endpoint / URL -->
  <div class="field-row">
    <label class="field-label" for="ch-endpoint"
      >{t('inspector.callHttp.endpoint')}</label
    >
    <input
      id="ch-endpoint"
      class="field-input"
      class:field-input--error={endpointError}
      type="text"
      aria-label={t('inspector.callHttp.endpoint')}
      value={config.endpoint}
      oninput={(e) => handleEndpointChange(e.currentTarget.value)}
    />
    {#if endpointError}
      <p class="field-error" role="alert">
        {t('inspector.callHttp.endpointRequired')}
      </p>
    {/if}
  </div>

  <!-- Headers -->
  <div class="section-group">
    <h4 class="section-subtitle">{t('inspector.callHttp.headers.title')}</h4>

    {#if headerEntries.length > 0}
      <ul class="kv-list" role="list">
        {#each headerEntries as [key, val], i (i)}
          <li class="kv-item">
            <div class="kv-row">
              <input
                class="kv-input"
                type="text"
                aria-label={t('inspector.callHttp.headers.keyLabel')}
                value={key}
                oninput={(e) =>
                  handleHeaderKeyChange(i, key, e.currentTarget.value)}
              />
              <input
                class="kv-input"
                type="text"
                aria-label={t('inspector.callHttp.headers.valueLabel')}
                value={val}
                oninput={(e) =>
                  handleHeaderValueChange(i, key, e.currentTarget.value)}
              />
              <button
                class="remove-btn"
                type="button"
                aria-label={t('inspector.callHttp.headers.removeRow')}
                onclick={() => handleHeaderRemove(i)}
              >
                ✕
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}

    <button class="add-btn" type="button" onclick={handleHeaderAdd}>
      {t('inspector.callHttp.headers.addRow')}
    </button>
  </div>

  <!-- Body -->
  <div class="section-group">
    <h4 class="section-subtitle">{t('inspector.callHttp.body.title')}</h4>

    {#if config.body !== undefined}
      <textarea
        class="body-textarea"
        aria-label={t('inspector.callHttp.body.title')}
        value={config.body}
        oninput={(e) => handleBodyChange(e.currentTarget.value)}
      ></textarea>
      <button class="remove-body-btn" type="button" onclick={handleBodyRemove}>
        {t('inspector.callHttp.body.removeBody')}
      </button>
    {:else}
      <button class="add-btn" type="button" onclick={handleBodyAdd}>
        {t('inspector.callHttp.body.addBody')}
      </button>
    {/if}
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

  .field-row {
    margin-bottom: 0.625rem;
  }

  .field-label {
    display: block;
    font-size: 0.72rem;
    font-weight: 500;
    color: #666;
    margin-bottom: 0.2rem;
  }

  .method-select,
  .field-input {
    width: 100%;
    padding: 0.2rem 0.375rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.78rem;
    font-family: inherit;
    color: #111;
    background: #fff;
    box-sizing: border-box;
  }

  .field-input {
    font-family: monospace;
  }

  .method-select:focus,
  .field-input:focus {
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

  /* Section groups (Headers, Body) */

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

  /* Key/value header rows */

  .kv-list {
    list-style: none;
    margin: 0 0 0.375rem;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .kv-item {
    display: flex;
    flex-direction: column;
  }

  .kv-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1.5rem;
    gap: 0.25rem;
    align-items: center;
  }

  .kv-input {
    padding: 0.2rem 0.375rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.78rem;
    font-family: monospace;
    color: #111;
    background: #fff;
    min-width: 0;
  }

  .kv-input:focus {
    outline: none;
    border-color: #1a56cc;
    box-shadow: 0 0 0 2px rgba(26, 86, 204, 0.15);
  }

  /* Body */

  .body-textarea {
    width: 100%;
    min-height: 4.5rem;
    padding: 0.25rem 0.375rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.78rem;
    font-family: monospace;
    color: #111;
    background: #fff;
    resize: vertical;
    box-sizing: border-box;
    margin-bottom: 0.3rem;
  }

  .body-textarea:focus {
    outline: none;
    border-color: #1a56cc;
    box-shadow: 0 0 0 2px rgba(26, 86, 204, 0.15);
  }

  /* Shared button styles */

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

  .remove-body-btn {
    padding: 0.2rem 0.5rem;
    background: transparent;
    border: 1px solid #e0a0a0;
    border-radius: 4px;
    color: #c0392b;
    font-size: 0.72rem;
    cursor: pointer;
  }

  .remove-body-btn:hover {
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
