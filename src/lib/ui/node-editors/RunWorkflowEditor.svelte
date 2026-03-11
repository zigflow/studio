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
  import type { Node, RunWorkflowConfig, TaskNode } from '$lib/tasks/model';

  interface Props {
    node: Node;
    onupdate: (node: Node) => void;
  }

  let { node, onupdate }: Props = $props();

  const taskNode = $derived(node as TaskNode);
  const config = $derived(taskNode.config as RunWorkflowConfig);

  let nameError = $state(false);

  function emit(updates: Partial<Omit<RunWorkflowConfig, 'kind'>>): void {
    onupdate({ ...taskNode, config: { ...config, ...updates } });
  }

  // Normalise version to the fixed value on mount; silently migrate old nodes.
  $effect(() => {
    if (config.version !== '0.0.0') {
      emit({ version: '0.0.0' });
    }
  });

  function handleNameChange(value: string): void {
    if (value.trim() === '') {
      nameError = true;
    } else {
      nameError = false;
      emit({ name: value });
    }
  }

  function handleNamespaceChange(value: string): void {
    emit({ namespace: value });
  }

  function handleAwaitChange(value: boolean): void {
    emit({ await: value });
  }
</script>

<div class="node-editor">
  <h3 class="editor-title">{t('inspector.run.workflow.title')}</h3>

  <!-- Workflow name -->
  <div class="field-row">
    <label class="field-label" for="rw-name">
      {t('inspector.run.workflow.name.label')}
    </label>
    <input
      id="rw-name"
      class="field-input"
      class:field-input--error={nameError}
      type="text"
      aria-label={t('inspector.run.workflow.name.label')}
      value={config.name}
      oninput={(e) => handleNameChange(e.currentTarget.value)}
    />
    {#if nameError}
      <p class="field-error" role="alert">
        {t('inspector.run.workflow.name.required')}
      </p>
    {/if}
  </div>

  <!-- Namespace -->
  <div class="field-row">
    <label class="field-label" for="rw-namespace">
      {t('inspector.run.workflow.namespace.label')}
    </label>
    <input
      id="rw-namespace"
      class="field-input"
      type="text"
      aria-label={t('inspector.run.workflow.namespace.label')}
      value={config.namespace}
      oninput={(e) => handleNamespaceChange(e.currentTarget.value)}
    />
  </div>

  <!-- Await -->
  <div class="field-row field-row--inline">
    <label class="field-label" for="rw-await">
      {t('inspector.run.await.label')}
    </label>
    <input
      id="rw-await"
      type="checkbox"
      checked={config.await !== false}
      onchange={(e) => handleAwaitChange(e.currentTarget.checked)}
    />
  </div>
  {#if config.await === false}
    <p class="await-help">{t('inspector.run.await.help.workflow')}</p>
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

  .await-help {
    margin: 0.2rem 0 0.625rem;
    font-size: 0.7rem;
    color: #555;
    background: #f5f5f5;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    padding: 0.3rem 0.5rem;
  }
</style>
