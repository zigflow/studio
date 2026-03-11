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
    type ActivityArg,
    type CallActivityConfig,
    type Node,
    type TaskNode,
  } from '$lib/tasks/model';

  import ArgumentsList from './ArgumentsList.svelte';

  interface Props {
    node: Node;
    onupdate: (node: Node) => void;
  }

  let { node, onupdate }: Props = $props();

  // Safe narrowing: registry guarantees this editor only receives call-activity nodes.
  const taskNode = $derived(node as TaskNode);
  const config = $derived(taskNode.config as CallActivityConfig);
  const args = $derived(config.arguments ?? []);

  function emitConfig(
    updates: Partial<Omit<CallActivityConfig, 'kind'>>,
  ): void {
    onupdate({ ...taskNode, config: { ...config, ...updates } });
  }

  function emitArgs(newArgs: ActivityArg[]): void {
    emitConfig({ arguments: newArgs.length === 0 ? undefined : newArgs });
  }

  function handleNameChange(value: string): void {
    emitConfig({ name: value });
  }

  function handleTaskQueueChange(value: string): void {
    emitConfig({ taskQueue: value || undefined });
  }
</script>

<div class="node-editor">
  <h3 class="editor-title">{t('inspector.callActivity.title')}</h3>

  <!-- Activity name -->
  <div class="field-row">
    <label class="field-label" for="ca-name">
      {t('inspector.callActivity.activityName')}
    </label>
    <input
      id="ca-name"
      class="field-input"
      type="text"
      aria-label={t('inspector.callActivity.activityName')}
      value={config.name}
      oninput={(e) => handleNameChange(e.currentTarget.value)}
    />
    {#if config.name === ''}
      <p class="field-warning" role="status">
        {t('inspector.callActivity.activityNameRequired')}
      </p>
    {/if}
  </div>

  <!-- Task queue -->
  <div class="field-row">
    <label class="field-label" for="ca-task-queue">
      {t('inspector.callActivity.taskQueue')}
    </label>
    <input
      id="ca-task-queue"
      class="field-input"
      type="text"
      aria-label={t('inspector.callActivity.taskQueue')}
      value={config.taskQueue ?? ''}
      oninput={(e) => handleTaskQueueChange(e.currentTarget.value)}
    />
    {#if !config.taskQueue}
      <p class="field-warning" role="status">
        {t('inspector.callActivity.taskQueueRequired')}
      </p>
    {/if}
  </div>

  <!-- Arguments -->
  <div class="section-group">
    <h4 class="section-subtitle">
      {t('inspector.callActivity.arguments.title')}
    </h4>
    <ArgumentsList
      {args}
      addLabel={t('inspector.callActivity.arguments.addRow')}
      onchange={emitArgs}
    />
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

  .field-warning {
    margin: 0.15rem 0 0;
    font-size: 0.7rem;
    color: #b45309;
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
</style>
