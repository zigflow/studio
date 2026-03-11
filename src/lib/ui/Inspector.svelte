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
  import type { Node } from '$lib/tasks/model';

  import CommonFields from './inspector/CommonFields.svelte';
  import { getNodeEditor } from './node-editors/registry';

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  interface Props {
    node: Node | null;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    onmoveup?: () => void;
    onmovedown?: () => void;
    ondelete?: () => void;
    // Called when any node property is changed via the editor.
    onupdate?: (node: Node) => void;
    // Navigation into subgraphs
    onenternode?: (nodeId: string) => void; // loop body
    onenterbranch?: (nodeId: string, branchId: string) => void; // switch/fork/try
    // Branch management (switch / fork)
    onaddbranch?: (nodeId: string) => void;
    onremovebranch?: (nodeId: string, branchId: string) => void;
    // Try-specific: add catchGraph section
    onaddcatch?: (nodeId: string) => void;
  }

  let {
    node,
    canMoveUp = false,
    canMoveDown = false,
    onmoveup,
    onmovedown,
    ondelete,
    onupdate,
    onenternode,
    onenterbranch,
    onaddbranch,
    onremovebranch,
    onaddcatch,
  }: Props = $props();

  // ---------------------------------------------------------------------------
  // Derived: look up the editor component for the current node.
  // ---------------------------------------------------------------------------

  const NodeEditor = $derived(node ? getNodeEditor(node) : null);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  // Minimum branch count: fork requires at least 2; switch requires at least 1.
  function minBranches(n: Node): number {
    return n.type === 'fork' ? 2 : 1;
  }

  function handleNameChange(value: string): void {
    if (!node) return;
    onupdate?.({ ...node, name: value });
  }
</script>

<aside class="inspector">
  {#if node === null}
    <p class="inspector-empty">{t('inspector.empty')}</p>
  {:else}
    <!-- -------------------------------------------------------------------
      CommonSection: editable name + read-only node ID.
    -------------------------------------------------------------------- -->
    <header class="inspector-header">
      <span class="inspector-type">{node.type}</span>
      <label class="field-label" for="inspector-node-name"
        >{t('inspector.name')}</label
      >
      <input
        id="inspector-node-name"
        class="name-input inspector-name"
        type="text"
        value={node.name}
        oninput={(e) => handleNameChange(e.currentTarget.value)}
      />
    </header>

    <section class="inspector-section">
      <dl>
        <dt>{t('inspector.nodeId')}</dt>
        <dd class="mono">{node.id}</dd>

        {#if node.type === 'task'}
          <dt>{t('inspector.kind')}</dt>
          <dd>{node.config.kind}</dd>
        {/if}
      </dl>
    </section>

    <!-- -------------------------------------------------------------------
      TaskSpecificSection: dynamically loaded editor from registry.
      For task nodes this replaces the "coming soon" hint.
      For structural nodes this supplements the branch/section navigation.
    -------------------------------------------------------------------- -->

    {#if node.type === 'switch' || node.type === 'fork'}
      <section class="inspector-branches">
        <h3 class="inspector-section-title">{t('inspector.branches')}</h3>
        <ul class="branch-list" role="list">
          {#each node.branches as branch (branch.id)}
            <li class="branch-item">
              <button
                class="branch-label-btn"
                onclick={() => onenterbranch?.(node.id, branch.id)}
                type="button"
              >
                {branch.label}
              </button>
              {#if node.branches.length > minBranches(node)}
                <button
                  class="branch-remove-btn"
                  onclick={() => onremovebranch?.(node.id, branch.id)}
                  type="button"
                  aria-label={t('inspector.removeBranch', {
                    label: branch.label,
                  })}
                >
                  ✕
                </button>
              {/if}
            </li>
          {/each}
        </ul>
        <button
          class="branch-add-btn"
          onclick={() => onaddbranch?.(node.id)}
          type="button"
        >
          {t('inspector.addBranch')}
        </button>
      </section>
    {:else if node.type === 'try'}
      <section class="inspector-branches">
        <h3 class="inspector-section-title">{t('inspector.sections')}</h3>
        <div class="try-sections">
          <button
            class="try-section-btn"
            onclick={() => onenterbranch?.(node.id, 'tryGraph')}
            type="button"
          >
            {t('inspector.enterTryBody')}
          </button>
          {#if node.catchGraph !== undefined}
            <button
              class="try-section-btn"
              onclick={() => onenterbranch?.(node.id, 'catchGraph')}
              type="button"
            >
              {t('inspector.enterCatchBlock')}
            </button>
          {:else}
            <button
              class="try-add-catch-btn"
              onclick={() => onaddcatch?.(node.id)}
              type="button"
            >
              {t('inspector.addCatchBlock')}
            </button>
          {/if}
        </div>
      </section>
    {:else if node.type === 'loop'}
      <section class="inspector-branches">
        <button
          class="loop-enter-btn"
          onclick={() => onenternode?.(node.id)}
          type="button"
        >
          {t('inspector.enterLoopBody')}
        </button>
      </section>
    {/if}

    <!-- Task-specific or structural property editor -->
    {#if NodeEditor}
      <NodeEditor {node} onupdate={(n) => onupdate?.(n)} />
    {/if}

    <!-- Common fields: if + metadata — present on all node types -->
    <CommonFields {node} onupdate={(n) => onupdate?.(n)} />

    <div class="move-row">
      <button
        class="move-btn"
        disabled={!canMoveUp}
        onclick={() => onmoveup?.()}
        type="button"
        aria-label={t('inspector.moveUpLabel')}
      >
        {t('inspector.moveUp')}
      </button>
      <button
        class="move-btn"
        disabled={!canMoveDown}
        onclick={() => onmovedown?.()}
        type="button"
        aria-label={t('inspector.moveDownLabel')}
      >
        {t('inspector.moveDown')}
      </button>
    </div>

    <button class="delete-btn" onclick={() => ondelete?.()} type="button">
      {t('inspector.delete')}
    </button>
  {/if}
</aside>

<style>
  .inspector {
    width: 260px;
    min-width: 260px;
    border-left: 1px solid #ddd;
    background: #fff;
    display: flex;
    flex-direction: column;
    padding: 1rem;
    overflow-y: auto;
    font-size: 0.875rem;
  }

  .inspector-empty {
    color: #888;
    font-style: italic;
    margin: 0;
  }

  .inspector-header {
    margin-bottom: 1rem;
  }

  .inspector-type {
    display: inline-block;
    background: #e8f0fe;
    color: #1a56cc;
    border-radius: 4px;
    padding: 1px 6px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
  }

  .field-label {
    display: block;
    font-size: 0.72rem;
    font-weight: 500;
    color: #666;
    margin-bottom: 0.2rem;
  }

  .name-input {
    width: 100%;
    padding: 0.3rem 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.875rem;
    font-weight: 600;
    font-family: inherit;
    color: #111;
    background: #fff;
    box-sizing: border-box;
  }

  .name-input:focus {
    outline: none;
    border-color: #1a56cc;
    box-shadow: 0 0 0 2px rgba(26, 86, 204, 0.15);
  }

  .inspector-section {
    flex: 1;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25rem 0.75rem;
    margin: 0;
  }

  dt {
    color: #666;
    font-weight: 500;
    white-space: nowrap;
  }

  dd {
    margin: 0;
    word-break: break-all;
    color: #111;
  }

  .mono {
    font-family: monospace;
    font-size: 0.8em;
    color: #555;
  }

  /* -------------------------------------------------------------------------
     Branch / structural management
  ------------------------------------------------------------------------- */

  .inspector-branches {
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid #eee;
  }

  .inspector-section-title {
    margin: 0 0 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #444;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .branch-list {
    list-style: none;
    margin: 0 0 0.5rem;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .branch-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .branch-label-btn {
    flex: 1;
    min-width: 0;
    padding: 0.25rem 0.5rem;
    background: #f0f4ff;
    border: 1px solid #c5d5f5;
    border-radius: 4px;
    font-size: 0.8rem;
    font-family: inherit;
    color: #1a56cc;
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .branch-label-btn:hover {
    background: #e0eaff;
    border-color: #1a56cc;
  }

  .branch-remove-btn {
    padding: 0.2rem 0.375rem;
    background: transparent;
    border: 1px solid #e0a0a0;
    border-radius: 4px;
    color: #c0392b;
    font-size: 0.72rem;
    cursor: pointer;
    line-height: 1;
  }

  .branch-remove-btn:hover {
    background: #fff0f0;
  }

  .branch-add-btn {
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

  .branch-add-btn:hover {
    border-color: #1a56cc;
    color: #1a56cc;
    background: #f0f4ff;
  }

  /* Try sections */

  .try-sections {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .try-section-btn {
    width: 100%;
    padding: 0.35rem 0.6rem;
    background: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 4px;
    color: #333;
    font-size: 0.8rem;
    cursor: pointer;
    text-align: left;
  }

  .try-section-btn:hover {
    background: #eee;
    border-color: #aaa;
  }

  .try-add-catch-btn {
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

  .try-add-catch-btn:hover {
    border-color: #dc2626;
    color: #dc2626;
    background: #fff5f5;
  }

  /* Loop body */

  .loop-enter-btn {
    width: 100%;
    padding: 0.35rem 0.6rem;
    background: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 4px;
    color: #333;
    font-size: 0.8rem;
    cursor: pointer;
    text-align: left;
  }

  .loop-enter-btn:hover {
    background: #eee;
    border-color: #aaa;
  }

  /* -------------------------------------------------------------------------
     Move / delete controls
  ------------------------------------------------------------------------- */

  .move-row {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .move-btn {
    flex: 1;
    padding: 0.375rem 0.5rem;
    background: transparent;
    border: 1px solid #ddd;
    border-radius: 6px;
    color: #444;
    font-size: 0.8rem;
    cursor: pointer;
    transition:
      background 0.1s,
      border-color 0.1s;
  }

  .move-btn:hover:not(:disabled) {
    background: #f5f5f5;
    border-color: #aaa;
  }

  .move-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .delete-btn {
    margin-top: 0.75rem;
    width: 100%;
    padding: 0.375rem 0.75rem;
    background: transparent;
    border: 1px solid #e0a0a0;
    border-radius: 6px;
    color: #c0392b;
    font-size: 0.8rem;
    cursor: pointer;
    transition:
      background 0.1s,
      border-color 0.1s;
  }

  .delete-btn:hover {
    background: #fff0f0;
    border-color: #c0392b;
  }
</style>
