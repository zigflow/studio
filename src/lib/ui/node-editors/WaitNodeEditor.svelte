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
    DurationSpec,
    Node,
    TaskNode,
    WaitConfig,
  } from '$lib/tasks/model';

  interface Props {
    node: Node;
    onupdate: (node: Node) => void;
  }

  let { node, onupdate }: Props = $props();

  // Safe narrowing: registry guarantees this editor only receives wait nodes.
  const waitNode = $derived(node as TaskNode);
  const config = $derived(waitNode.config as WaitConfig);

  function emitDuration(patch: Partial<DurationSpec>): void {
    const next: DurationSpec = { ...config.duration, ...patch };
    // Remove fields that are zero or undefined so the serialised form stays clean.
    if (!next.seconds) delete next.seconds;
    if (!next.minutes) delete next.minutes;
    if (!next.hours) delete next.hours;
    if (!next.days) delete next.days;
    onupdate({ ...waitNode, config: { ...config, duration: next } });
  }

  function handleField(field: keyof DurationSpec, raw: string): void {
    const parsed = parseInt(raw, 10);
    emitDuration({
      [field]: isNaN(parsed) || parsed <= 0 ? undefined : parsed,
    });
  }

  type DurationField = { key: keyof DurationSpec; label: string };

  const fields: DurationField[] = [
    { key: 'days', label: t('inspector.wait.days') },
    { key: 'hours', label: t('inspector.wait.hours') },
    { key: 'minutes', label: t('inspector.wait.minutes') },
    { key: 'seconds', label: t('inspector.wait.seconds') },
  ];
</script>

<div class="node-editor">
  <h3 class="editor-title">{t('inspector.wait.title')}</h3>

  <dl class="duration-fields">
    {#each fields as { key, label } (key)}
      <dt class="field-label">{label}</dt>
      <dd class="field-value">
        <input
          class="duration-input"
          type="number"
          min="0"
          aria-label={label}
          value={config.duration[key] ?? ''}
          oninput={(e) => handleField(key, e.currentTarget.value)}
        />
      </dd>
    {/each}
  </dl>
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

  .duration-fields {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.375rem 0.75rem;
    margin: 0;
    align-items: center;
  }

  .field-label {
    color: #666;
    font-weight: 500;
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .field-value {
    margin: 0;
  }

  .duration-input {
    width: 100%;
    padding: 0.2rem 0.375rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.8rem;
    font-family: inherit;
    color: #111;
    background: #fff;
  }

  .duration-input:focus {
    outline: none;
    border-color: #1a56cc;
    box-shadow: 0 0 0 2px rgba(26, 86, 204, 0.15);
  }
</style>
