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
  import type { ForkNode, Node } from '$lib/tasks/model';

  interface Props {
    node: Node;
    onupdate: (node: Node) => void;
  }

  let { node, onupdate }: Props = $props();

  // Safe narrowing: registry guarantees this editor only receives fork nodes.
  const forkNode = $derived(node as ForkNode);
</script>

<div class="node-editor">
  <label class="compete-row">
    <input
      class="compete-checkbox"
      type="checkbox"
      checked={forkNode.compete}
      onchange={(e) =>
        onupdate({ ...forkNode, compete: e.currentTarget.checked })}
    />
    <span class="compete-label">{t('inspector.fork.compete')}</span>
  </label>
  <p class="compete-hint">{t('inspector.fork.competeHint')}</p>
</div>

<style>
  .node-editor {
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid #eee;
  }

  .compete-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .compete-checkbox {
    width: 1rem;
    height: 1rem;
    cursor: pointer;
    accent-color: #2563eb;
  }

  .compete-label {
    font-size: 0.8rem;
    font-weight: 500;
    color: #333;
  }

  .compete-hint {
    margin: 0.25rem 0 0 1.5rem;
    font-size: 0.72rem;
    color: #888;
  }
</style>
