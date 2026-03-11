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
  import {
    type ListenConfig,
    type ListenEvent,
    type Node,
    type TaskNode,
  } from '$lib/tasks/model';

  interface Props {
    node: Node;
    onupdate: (node: Node) => void;
  }

  let { node, onupdate }: Props = $props();

  // Registry guarantees this editor only receives listen nodes.
  const taskNode = $derived(node as TaskNode);
  const config = $derived(taskNode.config as ListenConfig);

  // ---------------------------------------------------------------------------
  // Initialise with one empty event when none are present.
  // ---------------------------------------------------------------------------

  $effect(() => {
    if (config.events.length === 0) {
      onupdate({
        ...taskNode,
        config: { ...config, events: [{ id: '', type: 'signal' }] },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function emitConfig(patch: Partial<ListenConfig>): void {
    onupdate({ ...taskNode, config: { ...config, ...patch } });
  }

  function emitEvents(events: ListenEvent[]): void {
    emitConfig({ events });
  }

  function patchEvent(index: number, patch: Partial<ListenEvent>): void {
    emitEvents(
      config.events.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    );
  }

  // ---------------------------------------------------------------------------
  // Event handlers — mode
  // ---------------------------------------------------------------------------

  function handleModeChange(value: string): void {
    const mode = value as ListenConfig['mode'];
    emitConfig({
      mode,
      // In 'one' mode only the first event is used; trim the list.
      events: mode === 'one' ? config.events.slice(0, 1) : config.events,
    });
  }

  // 'any' and 'all' both support multiple events.
  const isMultiEventMode = $derived(
    config.mode === 'all' || config.mode === 'any',
  );

  // ---------------------------------------------------------------------------
  // Event handlers — event list
  // ---------------------------------------------------------------------------

  function handleAddEvent(): void {
    emitEvents([...config.events, { id: '', type: 'signal' }]);
  }

  function handleRemoveEvent(index: number): void {
    emitEvents(config.events.filter((_, i) => i !== index));
  }

  function handleIdChange(index: number, value: string): void {
    patchEvent(index, { id: value });
  }

  function handleTypeChange(index: number, value: string): void {
    patchEvent(index, { type: value as ListenEvent['type'] });
  }

  function handleAcceptIfChange(index: number, value: string): void {
    patchEvent(index, { acceptIf: value || undefined });
  }

  function handleDataContentTypeChange(index: number, value: string): void {
    patchEvent(index, { datacontenttype: value || undefined });
  }

  // ---------------------------------------------------------------------------
  // Event handlers — data key-value pairs
  // ---------------------------------------------------------------------------

  function handleAddDataRow(eventIndex: number): void {
    const existing = config.events[eventIndex].data ?? {};
    patchEvent(eventIndex, { data: { ...existing, '': '' } });
  }

  function handleRemoveDataRow(eventIndex: number, key: string): void {
    const data = { ...config.events[eventIndex].data };
    delete data[key];
    patchEvent(eventIndex, {
      data: Object.keys(data).length ? data : undefined,
    });
  }

  function handleDataKeyChange(
    eventIndex: number,
    oldKey: string,
    newKey: string,
  ): void {
    const data = { ...config.events[eventIndex].data };
    const value = data[oldKey] ?? '';
    delete data[oldKey];
    if (newKey !== '') data[newKey] = value;
    patchEvent(eventIndex, {
      data: Object.keys(data).length ? data : undefined,
    });
  }

  function handleDataValueChange(
    eventIndex: number,
    key: string,
    value: string,
  ): void {
    patchEvent(eventIndex, {
      data: { ...config.events[eventIndex].data, [key]: value },
    });
  }
</script>

<div class="node-editor">
  <h3 class="editor-title">{t('inspector.listen.title')}</h3>

  <!-- Mode -->
  <div class="field-row">
    <label class="field-label" for="listen-mode">
      {t('inspector.listen.mode.label')}
    </label>
    <select
      id="listen-mode"
      class="field-select"
      value={config.mode}
      onchange={(e) => handleModeChange(e.currentTarget.value)}
    >
      <option value="one">{t('inspector.listen.mode.one')}</option>
      <option value="all">{t('inspector.listen.mode.all')}</option>
      <option value="any">{t('inspector.listen.mode.any')}</option>
    </select>
  </div>

  <!-- Events -->
  {#each config.events as event, i (i)}
    <div class="event-block">
      {#if isMultiEventMode}
        <div class="event-header">
          <span class="event-label">
            {t('inspector.listen.events.event', { index: i + 1 })}
          </span>
          <button
            class="remove-event-btn"
            type="button"
            aria-label={t('inspector.listen.events.removeEvent', {
              index: i + 1,
            })}
            onclick={() => handleRemoveEvent(i)}>×</button
          >
        </div>
      {/if}

      <!-- Event ID -->
      <div class="field-row">
        <label class="field-label" for="listen-id-{i}">
          {t('inspector.listen.id.label')}
        </label>
        <input
          id="listen-id-{i}"
          class="field-input"
          class:field-input--error={!event.id.trim()}
          type="text"
          value={event.id}
          aria-label={t('inspector.listen.id.label')}
          oninput={(e) => handleIdChange(i, e.currentTarget.value)}
        />
        {#if !event.id.trim()}
          <p class="field-error">{t('inspector.listen.id.required')}</p>
        {/if}
      </div>

      <!-- Type -->
      <div class="field-row">
        <label class="field-label" for="listen-type-{i}">
          {t('inspector.listen.type.label')}
        </label>
        <select
          id="listen-type-{i}"
          class="field-select"
          value={event.type}
          onchange={(e) => handleTypeChange(i, e.currentTarget.value)}
        >
          <option value="signal">{t('inspector.listen.type.signal')}</option>
          <option value="query">{t('inspector.listen.type.query')}</option>
          <option value="update">{t('inspector.listen.type.update')}</option>
        </select>
      </div>

      <!-- Accept if -->
      <div class="field-row">
        <label class="field-label" for="listen-accept-if-{i}">
          {t('inspector.listen.acceptIf.label')}
        </label>
        <input
          id="listen-accept-if-{i}"
          class="field-input"
          type="text"
          value={event.acceptIf ?? ''}
          aria-label={t('inspector.listen.acceptIf.label')}
          oninput={(e) => handleAcceptIfChange(i, e.currentTarget.value)}
        />
      </div>

      <!-- Data content type -->
      <div class="field-row">
        <label class="field-label" for="listen-dct-{i}">
          {t('inspector.listen.dataContentType.label')}
        </label>
        <input
          id="listen-dct-{i}"
          class="field-input"
          type="text"
          value={event.datacontenttype ?? ''}
          aria-label={t('inspector.listen.dataContentType.label')}
          oninput={(e) => handleDataContentTypeChange(i, e.currentTarget.value)}
        />
      </div>

      <!-- Data key-value pairs -->
      <div class="data-section">
        <p class="data-section-title">{t('inspector.listen.data.title')}</p>
        {#if event.data && Object.keys(event.data).length > 0}
          <table class="data-table">
            <thead>
              <tr>
                <th class="data-th">{t('inspector.listen.data.keyLabel')}</th>
                <th class="data-th">{t('inspector.listen.data.valueLabel')}</th>
                <th class="data-th"></th>
              </tr>
            </thead>
            <tbody>
              {#each Object.entries(event.data) as [key, val], rowIdx (rowIdx)}
                <tr>
                  <td class="data-td">
                    <input
                      class="field-input"
                      type="text"
                      value={key}
                      aria-label={t('inspector.listen.data.keyLabel')}
                      oninput={(e) =>
                        handleDataKeyChange(i, key, e.currentTarget.value)}
                    />
                  </td>
                  <td class="data-td">
                    <input
                      class="field-input"
                      type="text"
                      value={val}
                      aria-label={t('inspector.listen.data.valueLabel')}
                      oninput={(e) =>
                        handleDataValueChange(i, key, e.currentTarget.value)}
                    />
                  </td>
                  <td class="data-td data-td--action">
                    <button
                      class="remove-row-btn"
                      type="button"
                      aria-label={t('inspector.listen.data.removeRow')}
                      onclick={() => handleRemoveDataRow(i, key)}>×</button
                    >
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
        <button
          class="add-btn"
          type="button"
          onclick={() => handleAddDataRow(i)}
        >
          {t('inspector.listen.data.addRow')}
        </button>
      </div>
    </div>
  {/each}

  {#if isMultiEventMode}
    <button
      class="add-btn add-btn--event"
      type="button"
      onclick={handleAddEvent}
    >
      {t('inspector.listen.events.addEvent')}
    </button>
  {/if}
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
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    margin-bottom: 0.625rem;
  }

  .field-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #666;
  }

  .field-select,
  .field-input {
    width: 100%;
    padding: 0.2rem 0.375rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.8rem;
    font-family: inherit;
    color: #111;
    background: #fff;
    box-sizing: border-box;
  }

  .field-select:focus,
  .field-input:focus {
    outline: none;
    border-color: #1a56cc;
    box-shadow: 0 0 0 2px rgba(26, 86, 204, 0.15);
  }

  .field-input--error {
    border-color: #c0392b;
  }

  .field-error {
    margin: 0.1rem 0 0;
    font-size: 0.72rem;
    color: #c0392b;
  }

  .event-block {
    padding: 0.625rem;
    margin-bottom: 0.625rem;
    border: 1px solid #e8e8e8;
    border-radius: 4px;
    background: #fafafa;
  }

  .event-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .event-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .remove-event-btn,
  .remove-row-btn {
    padding: 0.1rem 0.35rem;
    font-size: 0.75rem;
    font-family: inherit;
    color: #b02020;
    background: transparent;
    border: 1px solid #e8b4b4;
    border-radius: 4px;
    cursor: pointer;
    line-height: 1;
  }

  .remove-event-btn:hover,
  .remove-row-btn:hover {
    background: #fff0f0;
    border-color: #c0392b;
  }

  .data-section {
    margin-top: 0.5rem;
  }

  .data-section-title {
    margin: 0 0 0.375rem;
    font-size: 0.72rem;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 0.375rem;
  }

  .data-th {
    font-size: 0.7rem;
    font-weight: 500;
    color: #888;
    text-align: left;
    padding: 0 0.2rem 0.2rem;
  }

  .data-td {
    padding: 0.15rem 0.2rem;
  }

  .data-td--action {
    width: 2rem;
    text-align: center;
  }

  .add-btn {
    display: inline-block;
    padding: 0.2rem 0.5rem;
    font-size: 0.75rem;
    font-family: inherit;
    color: #1a56cc;
    background: transparent;
    border: 1px solid #b0c8f0;
    border-radius: 4px;
    cursor: pointer;
  }

  .add-btn:hover {
    background: #f0f6ff;
    border-color: #1a56cc;
  }

  .add-btn--event {
    margin-top: 0.25rem;
  }
</style>
