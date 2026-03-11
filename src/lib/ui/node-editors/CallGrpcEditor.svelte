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
  import type { CallGRPCConfig, Node, TaskNode } from '$lib/tasks/model';

  interface Props {
    node: Node;
    onupdate: (node: Node) => void;
  }

  let { node, onupdate }: Props = $props();

  // Safe narrowing: registry guarantees this editor only receives call-grpc nodes.
  const taskNode = $derived(node as TaskNode);
  const config = $derived(taskNode.config as CallGRPCConfig);
  const argEntries = $derived(Object.entries(config.arguments ?? {}));

  // ---------------------------------------------------------------------------
  // Validation state
  // ---------------------------------------------------------------------------

  // Port error: set only after user interaction.
  let portError = $state(false);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Emit a shallow-patched config update. */
  function emit(updates: Partial<Omit<CallGRPCConfig, 'kind'>>): void {
    onupdate({ ...taskNode, config: { ...config, ...updates } });
  }

  /** Emit arguments, removing the property entirely when the map is empty. */
  function emitArguments(args: Record<string, string>): void {
    emit({
      arguments: Object.keys(args).length === 0 ? undefined : args,
    });
  }

  // ---------------------------------------------------------------------------
  // Event handlers — proto / service / method
  // ---------------------------------------------------------------------------

  function handleProtoEndpointChange(value: string): void {
    emit({ protoEndpoint: value });
  }

  function handleServiceNameChange(value: string): void {
    emit({ serviceName: value });
  }

  function handleHostChange(value: string): void {
    emit({ serviceHost: value });
  }

  const DEFAULT_PORT = 50051;

  function handlePortChange(raw: string): void {
    const trimmed = raw.trim();
    if (trimmed === '') {
      // Empty → fall back to the default port (same as placeholder).
      portError = false;
      emit({ servicePort: DEFAULT_PORT });
      return;
    }
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n < 1) {
      portError = true;
      return;
    }
    portError = false;
    emit({ servicePort: n });
  }

  function handleMethodChange(value: string): void {
    emit({ method: value });
  }

  // ---------------------------------------------------------------------------
  // Event handlers — arguments (key/value string map)
  // ---------------------------------------------------------------------------

  function handleArgKeyChange(
    index: number,
    oldKey: string,
    newKey: string,
  ): void {
    if (newKey === oldKey) return;
    const next = Object.fromEntries(
      argEntries.map(([k, v], i) => (i === index ? [newKey, v] : [k, v])),
    );
    emitArguments(next);
  }

  function handleArgValueChange(
    index: number,
    key: string,
    value: string,
  ): void {
    const next = Object.fromEntries(
      argEntries.map(([k, v], i) => (i === index ? [k, value] : [k, v])),
    );
    emitArguments(next);
  }

  function handleArgRemove(index: number): void {
    emitArguments(Object.fromEntries(argEntries.filter((_, i) => i !== index)));
  }

  function handleArgAdd(): void {
    const existing = config.arguments ?? {};
    let i = 1;
    while (Object.prototype.hasOwnProperty.call(existing, `arg${i}`)) i++;
    emitArguments({ ...existing, [`arg${i}`]: '' });
  }
</script>

<div class="node-editor">
  <h3 class="editor-title">{t('inspector.callGrpc.title')}</h3>

  <!-- Proto -->
  <div class="section-group section-group--first">
    <h4 class="section-subtitle">{t('inspector.callGrpc.proto.title')}</h4>
    <div class="field-row">
      <label class="field-label" for="cg-proto-endpoint">
        {t('inspector.callGrpc.proto.endpoint')}
      </label>
      <input
        id="cg-proto-endpoint"
        class="field-input"
        type="text"
        aria-label={t('inspector.callGrpc.proto.endpoint')}
        value={config.protoEndpoint}
        oninput={(e) => handleProtoEndpointChange(e.currentTarget.value)}
      />
    </div>
  </div>

  <!-- Service -->
  <div class="section-group">
    <h4 class="section-subtitle">{t('inspector.callGrpc.service.title')}</h4>
    <div class="field-row">
      <label class="field-label" for="cg-service-name">
        {t('inspector.callGrpc.service.name')}
      </label>
      <input
        id="cg-service-name"
        class="field-input"
        type="text"
        aria-label={t('inspector.callGrpc.service.name')}
        value={config.serviceName}
        oninput={(e) => handleServiceNameChange(e.currentTarget.value)}
      />
    </div>
    <div class="field-row">
      <label class="field-label" for="cg-host">
        {t('inspector.callGrpc.service.host')}
      </label>
      <input
        id="cg-host"
        class="field-input"
        type="text"
        aria-label={t('inspector.callGrpc.service.host')}
        placeholder={t('inspector.callGrpc.service.hostPlaceholder')}
        value={config.serviceHost}
        oninput={(e) => handleHostChange(e.currentTarget.value)}
      />
    </div>
    <div class="field-row">
      <label class="field-label" for="cg-port">
        {t('inspector.callGrpc.service.port')}
      </label>
      <input
        id="cg-port"
        class="field-input"
        class:field-input--error={portError}
        type="number"
        min="1"
        aria-label={t('inspector.callGrpc.service.port')}
        placeholder={t('inspector.callGrpc.service.portPlaceholder')}
        value={config.servicePort}
        oninput={(e) => handlePortChange(e.currentTarget.value)}
      />
      {#if portError}
        <p class="field-error" role="alert">
          {t('inspector.callGrpc.service.portInvalid')}
        </p>
      {/if}
    </div>
  </div>

  <!-- Method -->
  <div class="section-group">
    <div class="field-row">
      <label class="field-label" for="cg-method">
        {t('inspector.callGrpc.method')}
      </label>
      <input
        id="cg-method"
        class="field-input"
        type="text"
        aria-label={t('inspector.callGrpc.method')}
        value={config.method}
        oninput={(e) => handleMethodChange(e.currentTarget.value)}
      />
    </div>
  </div>

  <!-- Arguments -->
  <div class="section-group">
    <h4 class="section-subtitle">{t('inspector.callGrpc.arguments.title')}</h4>

    {#if argEntries.length > 0}
      <ul class="kv-list" role="list">
        {#each argEntries as [key, val], i (i)}
          <li class="kv-item">
            <div class="kv-row">
              <input
                class="kv-input"
                type="text"
                aria-label={t('inspector.callGrpc.arguments.keyLabel')}
                value={key}
                oninput={(e) =>
                  handleArgKeyChange(i, key, e.currentTarget.value)}
              />
              <input
                class="kv-input"
                type="text"
                aria-label={t('inspector.callGrpc.arguments.valueLabel')}
                value={val}
                oninput={(e) =>
                  handleArgValueChange(i, key, e.currentTarget.value)}
              />
              <button
                class="remove-btn"
                type="button"
                aria-label={t('inspector.callGrpc.arguments.removeRow')}
                onclick={() => handleArgRemove(i)}
              >
                ✕
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}

    <button class="add-btn" type="button" onclick={handleArgAdd}>
      {t('inspector.callGrpc.arguments.addRow')}
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

  .section-group {
    margin-top: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px solid #f0f0f0;
  }

  .section-group--first {
    margin-top: 0;
    padding-top: 0;
    border-top: none;
  }

  .section-subtitle {
    margin: 0 0 0.375rem;
    font-size: 0.7rem;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .field-row {
    margin-bottom: 0.5rem;
  }

  .field-label {
    display: block;
    font-size: 0.72rem;
    font-weight: 500;
    color: #666;
    margin-bottom: 0.2rem;
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

  /* Key/value argument rows */

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
