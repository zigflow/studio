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
  import type { LoopNode, Node } from '$lib/tasks/model';
  import ValueSourceSelector from '$lib/ui/ValueSourceSelector.svelte';

  interface Props {
    node: Node;
    onupdate: (node: Node) => void;
    inputPaths?: string[];
    schemaDocument?: Record<string, unknown>;
  }

  let { node, onupdate, inputPaths = [], schemaDocument }: Props = $props();

  // Safe narrowing: registry guarantees this editor only receives loop nodes.
  const loopNode = $derived(node as LoopNode);

  // Identifier pattern: letters, digits, underscores; cannot start with a digit.
  const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

  // Validation
  const collectionEmpty = $derived(loopNode.in === '');
  const itemInvalid = $derived(
    loopNode.each !== undefined &&
      loopNode.each !== '' &&
      !IDENTIFIER_RE.test(loopNode.each),
  );
  const indexInvalid = $derived(
    loopNode.at !== undefined &&
      loopNode.at !== '' &&
      !IDENTIFIER_RE.test(loopNode.at),
  );

  function handleOptional(field: 'each' | 'at' | 'while', value: string): void {
    onupdate({ ...loopNode, [field]: value || undefined });
  }
</script>

<div class="node-editor">
  <h3 class="editor-title">{t('inspector.loop.configuration')}</h3>

  <dl class="loop-fields">
    <dt class="field-label">{t('inspector.loop.collection')}</dt>
    <dd class="field-value" class:field-value--invalid={collectionEmpty}>
      <ValueSourceSelector
        value={loopNode.in}
        {inputPaths}
        {schemaDocument}
        ariaLabel={t('inspector.loop.collection')}
        onchange={(v) => onupdate({ ...loopNode, in: v })}
      />
      {#if collectionEmpty}
        <p class="field-warning">
          {t('validation.loop.collectionRequired')}
        </p>
      {/if}
    </dd>

    <dt class="field-label">{t('inspector.loop.itemVariable')}</dt>
    <dd class="field-value">
      <input
        class="loop-input loop-input--optional"
        class:loop-input--invalid={itemInvalid}
        type="text"
        aria-label={t('inspector.loop.itemVariable')}
        value={loopNode.each ?? ''}
        oninput={(e) => handleOptional('each', e.currentTarget.value)}
      />
      {#if itemInvalid}
        <p class="field-warning">
          {t('validation.loop.invalidIdentifier')}
        </p>
      {/if}
    </dd>

    <dt class="field-label">{t('inspector.loop.indexVariable')}</dt>
    <dd class="field-value">
      <input
        class="loop-input loop-input--optional"
        class:loop-input--invalid={indexInvalid}
        type="text"
        aria-label={t('inspector.loop.indexVariable')}
        value={loopNode.at ?? ''}
        oninput={(e) => handleOptional('at', e.currentTarget.value)}
      />
      {#if indexInvalid}
        <p class="field-warning">
          {t('validation.loop.invalidIdentifier')}
        </p>
      {/if}
    </dd>

    <dt class="field-label">{t('inspector.loop.breakCondition')}</dt>
    <dd class="field-value">
      <input
        class="loop-input loop-input--optional"
        type="text"
        aria-label={t('inspector.loop.breakCondition')}
        value={loopNode.while ?? ''}
        oninput={(e) => handleOptional('while', e.currentTarget.value)}
      />
    </dd>
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

  .loop-fields {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.375rem 0.75rem;
    margin: 0;
    align-items: start;
  }

  .field-label {
    color: #666;
    font-weight: 500;
    font-size: 0.8rem;
    white-space: nowrap;
    padding-top: 0.25rem;
  }

  .field-value {
    margin: 0;
  }

  .loop-input {
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

  .loop-input--optional {
    color: #555;
  }

  .loop-input--invalid {
    border-color: #b45309;
  }

  .loop-input:focus {
    outline: none;
    border-color: #1a56cc;
    box-shadow: 0 0 0 2px rgba(26, 86, 204, 0.15);
  }

  .loop-input--invalid:focus {
    border-color: #b45309;
    box-shadow: 0 0 0 2px rgba(180, 83, 9, 0.15);
  }

  .field-warning {
    margin: 0.15rem 0 0;
    font-size: 0.7rem;
    color: #b45309;
  }
</style>
