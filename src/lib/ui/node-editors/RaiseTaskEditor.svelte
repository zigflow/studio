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
    GO_PANIC_URI,
    type Node,
    type RaiseConfig,
    type RaiseErrorDefinition,
    SW_ERROR_DEFINITIONS,
    TEMPORAL_NON_RETRYABLE_URI,
    type TaskNode,
    defaultStatusForType,
  } from '$lib/tasks/model';

  interface Props {
    node: Node;
    onupdate: (node: Node) => void;
  }

  let { node, onupdate }: Props = $props();

  // Registry guarantees this editor only receives raise nodes.
  const taskNode = $derived(node as TaskNode);
  const config = $derived(taskNode.config as RaiseConfig);
  const definition = $derived(config.definition);

  // ---------------------------------------------------------------------------
  // Initialise definition on mount if absent.
  // ---------------------------------------------------------------------------

  $effect(() => {
    if (!definition) {
      const type = TEMPORAL_NON_RETRYABLE_URI;
      onupdate({
        ...taskNode,
        config: {
          ...config,
          definition: { type, status: defaultStatusForType(type) },
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Standard HTTP 4xx / 5xx status codes for the status select.
  // Names are RFC-defined identifiers, not UI copy — no i18n needed.
  // ---------------------------------------------------------------------------

  const HTTP_STATUS_GROUPS: Array<{
    group: string;
    codes: Array<{ code: number; name: string }>;
  }> = [
    {
      group: '4xx Client Errors',
      codes: [
        { code: 400, name: 'Bad Request' },
        { code: 401, name: 'Unauthorized' },
        { code: 402, name: 'Payment Required' },
        { code: 403, name: 'Forbidden' },
        { code: 404, name: 'Not Found' },
        { code: 405, name: 'Method Not Allowed' },
        { code: 406, name: 'Not Acceptable' },
        { code: 407, name: 'Proxy Authentication Required' },
        { code: 408, name: 'Request Timeout' },
        { code: 409, name: 'Conflict' },
        { code: 410, name: 'Gone' },
        { code: 411, name: 'Length Required' },
        { code: 412, name: 'Precondition Failed' },
        { code: 413, name: 'Content Too Large' },
        { code: 414, name: 'URI Too Long' },
        { code: 415, name: 'Unsupported Media Type' },
        { code: 416, name: 'Range Not Satisfiable' },
        { code: 417, name: 'Expectation Failed' },
        { code: 418, name: "I'm a Teapot" },
        { code: 421, name: 'Misdirected Request' },
        { code: 422, name: 'Unprocessable Content' },
        { code: 423, name: 'Locked' },
        { code: 424, name: 'Failed Dependency' },
        { code: 425, name: 'Too Early' },
        { code: 426, name: 'Upgrade Required' },
        { code: 428, name: 'Precondition Required' },
        { code: 429, name: 'Too Many Requests' },
        { code: 431, name: 'Request Header Fields Too Large' },
        { code: 451, name: 'Unavailable For Legal Reasons' },
      ],
    },
    {
      group: '5xx Server Errors',
      codes: [
        { code: 500, name: 'Internal Server Error' },
        { code: 501, name: 'Not Implemented' },
        { code: 502, name: 'Bad Gateway' },
        { code: 503, name: 'Service Unavailable' },
        { code: 504, name: 'Gateway Timeout' },
        { code: 505, name: 'HTTP Version Not Supported' },
        { code: 506, name: 'Variant Also Negotiates' },
        { code: 507, name: 'Insufficient Storage' },
        { code: 508, name: 'Loop Detected' },
        { code: 510, name: 'Not Extended' },
        { code: 511, name: 'Network Authentication Required' },
      ],
    },
  ];

  // ---------------------------------------------------------------------------
  // Error kind: derived value representing what is selected in the dropdown.
  //
  // Values:
  //   - SW error type URI
  //   - 'go-panic'
  //   - 'temporal-non-retryable'
  // ---------------------------------------------------------------------------

  type KindKey = string; // SW error URI | 'go-panic' | 'temporal-non-retryable'

  const selectedKind = $derived((): KindKey => {
    const type = definition?.type;
    if (!type || type === TEMPORAL_NON_RETRYABLE_URI)
      return 'temporal-non-retryable';
    if (type === GO_PANIC_URI) return 'go-panic';
    return type;
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Emit a full config update, creating the definition if it does not exist. */
  function emitDefinition(patch: Partial<RaiseErrorDefinition>): void {
    const base: RaiseErrorDefinition = definition ?? {
      type: TEMPORAL_NON_RETRYABLE_URI,
    };
    const next: RaiseErrorDefinition = { ...base, ...patch };
    onupdate({ ...taskNode, config: { ...config, definition: next } });
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  function handleKindChange(value: string): void {
    const type =
      value === 'go-panic'
        ? GO_PANIC_URI
        : value === 'temporal-non-retryable'
          ? TEMPORAL_NON_RETRYABLE_URI
          : value;
    emitDefinition({ type, status: defaultStatusForType(type) });
  }

  function handleTitleChange(value: string): void {
    emitDefinition({ title: value });
  }

  function handleDetailChange(value: string): void {
    emitDefinition({ detail: value === '' ? undefined : value });
  }

  function handleStatusChange(raw: string): void {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) emitDefinition({ status: n });
  }

  function handleClearDefinition(): void {
    onupdate({
      ...taskNode,
      config: { ...config, definition: undefined },
    });
  }
</script>

<div class="node-editor">
  <h3 class="editor-title">{t('inspector.raise.title')}</h3>

  {#if !definition}
    <p class="no-definition-hint">{t('inspector.raise.noDefinition')}</p>
  {/if}

  <!-- Error kind selector -->
  <div class="field-row">
    <label class="field-label" for="raise-kind">
      {t('inspector.raise.errorKind.label')}
    </label>
    <select
      id="raise-kind"
      class="field-select"
      value={selectedKind()}
      onchange={(e) => handleKindChange(e.currentTarget.value)}
    >
      <optgroup label={t('inspector.raise.errorKind.groupSw')}>
        {#each SW_ERROR_DEFINITIONS as def (def.value)}
          <option value={def.value}>
            {t(`inspector.raise.errorKind.${def.key}`)}
          </option>
        {/each}
      </optgroup>
      <optgroup label={t('inspector.raise.errorKind.groupSpecial')}>
        <option value="go-panic"
          >{t('inspector.raise.errorKind.goPanic')}</option
        >
        <option value="temporal-non-retryable"
          >{t('inspector.raise.errorKind.temporalNonRetryable')}</option
        >
      </optgroup>
    </select>
  </div>

  <!-- Title input -->
  <div class="field-row">
    <label class="field-label" for="raise-title">
      {t('inspector.raise.titleField.label')}
    </label>
    <input
      id="raise-title"
      class="field-input"
      type="text"
      value={definition?.title ?? ''}
      aria-label={t('inspector.raise.titleField.label')}
      oninput={(e) => handleTitleChange(e.currentTarget.value)}
    />
  </div>

  <!-- Detail textarea -->
  <div class="field-row">
    <label class="field-label" for="raise-detail">
      {t('inspector.raise.detail.label')}
    </label>
    <textarea
      id="raise-detail"
      class="field-textarea"
      rows="3"
      value={definition?.detail ?? ''}
      aria-label={t('inspector.raise.detail.label')}
      oninput={(e) => handleDetailChange(e.currentTarget.value)}
    ></textarea>
  </div>

  <!-- Status select -->
  <div class="field-row">
    <label class="field-label" for="raise-status">
      {t('inspector.raise.status.label')}
    </label>
    <select
      id="raise-status"
      class="field-select"
      value={definition?.status}
      onchange={(e) => handleStatusChange(e.currentTarget.value)}
    >
      {#each HTTP_STATUS_GROUPS as { group, codes } (group)}
        <optgroup label={group}>
          {#each codes as { code, name } (code)}
            <option value={code}>{name} ({code})</option>
          {/each}
        </optgroup>
      {/each}
    </select>
  </div>

  {#if definition}
    <button class="clear-btn" type="button" onclick={handleClearDefinition}>
      {t('inspector.raise.clearDefinition')}
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

  .no-definition-hint {
    margin: 0 0 0.75rem;
    font-size: 0.8rem;
    color: #888;
    font-style: italic;
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
  .field-input,
  .field-textarea {
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
  .field-input:focus,
  .field-textarea:focus {
    outline: none;
    border-color: #1a56cc;
    box-shadow: 0 0 0 2px rgba(26, 86, 204, 0.15);
  }

  .field-textarea {
    resize: vertical;
    min-height: 4rem;
  }

  .clear-btn {
    display: inline-block;
    margin-top: 0.25rem;
    padding: 0.2rem 0.5rem;
    font-size: 0.75rem;
    font-family: inherit;
    color: #b02020;
    background: transparent;
    border: 1px solid #e8b4b4;
    border-radius: 4px;
    cursor: pointer;
  }

  .clear-btn:hover {
    background: #fff0f0;
    border-color: #c0392b;
  }
</style>
