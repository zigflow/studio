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
  import { resolve } from '$app/paths';
  import { t } from '$lib/i18n/index.svelte';
  import type { WorkflowFile } from '$lib/tasks/model';
  import ContextIndicator from '$lib/ui/ContextIndicator.svelte';
  import SchemaEditor from '$lib/ui/SchemaEditor.svelte';
  import Sidebar from '$lib/ui/Sidebar.svelte';
  import { untrack } from 'svelte';

  import type { PageProps } from './$types';

  // Type alias for resolve() casts — satisfies Pathname constraint.
  type WfPath = `/workflows/${string}`;

  let { data }: PageProps = $props();

  // Mutable copy — same pattern as the workflow editor page.
  // untrack prevents data changes from re-initialising local state.
  let workflowFile = $state<WorkflowFile>(untrack(() => data.workflowFile));
  const workflowId = $derived(data.workflowId);

  // Capture the initial selected workflow ID once; it never changes on this page.
  let selectedWorkflowId = $state(
    untrack(() => data.workflowFile.order[0] ?? ''),
  );

  const selectedWorkflow = $derived(workflowFile.workflows[selectedWorkflowId]);

  const contextLabel = $derived(
    `${t('input.pageTitle')}: ${selectedWorkflow?.name ?? ''}`,
  );

  const editorHref = $derived(resolve(`/workflows/${workflowId}` as WfPath));

  // ---------------------------------------------------------------------------
  // Save state machine (same pattern as workflow editor)
  // ---------------------------------------------------------------------------

  type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

  let saveStatus = $state<SaveStatus>('idle');
  let lastSaveError = $state<string | undefined>(undefined);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let savePending = false;

  function markDirty(): void {
    saveStatus = 'dirty';
    scheduleSave();
  }

  function scheduleSave(): void {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (saveStatus === 'saving') {
      savePending = true;
      return;
    }
    saveTimer = setTimeout(() => {
      saveTimer = null;
      doSave();
    }, 300);
  }

  async function doSave(): Promise<void> {
    saveStatus = 'saving';
    savePending = false;
    const snapshot = $state.snapshot(workflowFile);
    try {
      const res = await fetch(
        `/api/workflows/${encodeURIComponent(workflowId)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workflowFile: snapshot }),
        },
      );
      const result = (await res.json()) as { ok: boolean; error?: string };
      if (result.ok) {
        saveStatus = savePending ? 'dirty' : 'saved';
        if (savePending) scheduleSave();
      } else {
        saveStatus = 'error';
        lastSaveError = result.error ?? 'Unknown error';
        if (savePending) scheduleSave();
      }
    } catch (err) {
      saveStatus = 'error';
      lastSaveError = String(err);
      if (savePending) scheduleSave();
    }
  }

  // ---------------------------------------------------------------------------
  // Schema change handler
  // ---------------------------------------------------------------------------

  function handleSchemaChange(doc: Record<string, unknown>): void {
    workflowFile = {
      ...workflowFile,
      input: {
        ...workflowFile.input,
        schema: { ...workflowFile.input.schema, document: doc },
      },
    };
    markDirty();
  }
</script>

<div class="editor-root">
  <Sidebar file={workflowFile} {selectedWorkflowId} mode="input" />

  <div class="editor-main">
    <div class="editor-topbar">
      <a class="back-link" href={editorHref}>
        {t('input.backToEditor')}
      </a>
      <span class="save-status" data-testid="save-status">
        {#if saveStatus === 'saving'}
          {t('input.saving')}
        {:else if saveStatus === 'saved'}
          {t('input.saved')}
        {:else if saveStatus === 'dirty'}
          {t('input.unsaved')}
        {:else if saveStatus === 'error'}
          <span title={lastSaveError}>{t('input.saveFailed')}</span>
        {/if}
      </span>
    </div>

    <ContextIndicator label={contextLabel} />

    <div class="content-area">
      <div class="schema-panel">
        <p class="schema-section-label">{t('input.schema.fields')}</p>
        <SchemaEditor
          document={workflowFile.input.schema.document}
          onchange={handleSchemaChange}
        />
      </div>
    </div>
  </div>
</div>

<style>
  .editor-root {
    height: 100%;
    display: flex;
    overflow: hidden;
    font-family: system-ui, sans-serif;
  }

  .editor-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .editor-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #eee;
    background: #fff;
    padding: 0 1rem;
    min-height: 2.5rem;
  }

  .back-link {
    font-size: 0.8rem;
    color: #1a56cc;
    text-decoration: none;
    padding: 0.375rem 0;
  }

  .back-link:hover {
    text-decoration: underline;
  }

  .save-status {
    font-size: 0.75rem;
    color: #888;
    white-space: nowrap;
  }

  .content-area {
    flex: 1;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    overflow: auto;
    padding: 1.5rem;
  }

  .schema-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    max-width: 720px;
  }

  .schema-section-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #999;
    margin: 0;
  }
</style>
