<script lang="ts">
  import Breadcrumb from '$lib/components/Breadcrumb.svelte';
  import Canvas from '$lib/components/Canvas.svelte';
  import Inspector from '$lib/components/Inspector.svelte';
  import NodePalette from '$lib/components/NodePalette.svelte';
  import type { CanvasActions } from '$lib/components/canvas';
  import { applyRename } from '$lib/editor/commands';
  import type { RenameOutcome } from '$lib/editor/commands';
  import {
    saveWorkflow,
    serializeWorkflow,
    toSaveErrorDisplays,
  } from '$lib/editor/save';
  import type { SaveErrorDisplay } from '$lib/editor/save';
  import type { FlowNode, ScopePath, TaskKind } from '$lib/graph/model';
  import { layoutForScope } from '$lib/graph/model';
  import {
    addTask,
    ensureTaskIds,
    moveTask,
    removeTask,
    updateTaskBody,
  } from '$lib/graph/mutations';
  import { resolveScope, siblingNames } from '$lib/graph/scope';
  import { treeToGraph } from '$lib/graph/treeToGraph';
  import { m } from '$lib/paraglide/messages';
  import type { Task, TaskList } from '$lib/types/zigflow';
  import { untrack } from 'svelte';

  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Editing is in-memory this step (no Save API yet), so the loaded workflow is
  // held as reactive `$state`: mutations happen on this proxy in place and the
  // derived graph below re-projects automatically (AGENTS "Editor architecture").
  let workflow = $state(untrack(() => data.workflow));
  let scopePath = $state<ScopePath>([]);
  let selectedId = $state<string | null>(null);
  let renameError = $state<RenameOutcome | null>(null);

  // Save state. `savedSnapshot` is the serialized workflow as last written to (or
  // loaded from) disk; "dirty" is simply "current differs from that snapshot", so
  // any edit shows unsaved and a successful save (or an undo back to the saved
  // state) shows clean — no per-mutation bookkeeping needed.
  let savedSnapshot = $state(
    untrack(() => (data.workflow ? serializeWorkflow(data.workflow) : '')),
  );
  let saving = $state(false);
  let validationErrors = $state<SaveErrorDisplay[]>([]);
  let saveErrorReason = $state<'network' | 'server' | 'malformed' | null>(null);
  let saveErrorStatus = $state<number | undefined>(undefined);

  const dirty = $derived(
    workflow ? serializeWorkflow(workflow) !== savedSnapshot : false,
  );

  // Reset editor + save state when navigating to a different workflow (the page
  // instance is reused across route params). `seenName` is a plain closure var.
  let seenName: string | undefined;
  $effect(() => {
    if (seenName !== data.name) {
      seenName = data.name;
      workflow = data.workflow;
      scopePath = [];
      selectedId = null;
      renameError = null;
      savedSnapshot = data.workflow ? serializeWorkflow(data.workflow) : '';
      clearSaveFeedback();
    }
  });

  /** Clear transient save banners (validation list + request-error message). */
  function clearSaveFeedback() {
    validationErrors = [];
    saveErrorReason = null;
    saveErrorStatus = undefined;
  }

  // The scope currently on screen: its task list and layout. A stale path (e.g. a
  // container removed while drilled elsewhere) falls back to root (DESIGN.md §3).
  const view = $derived.by(() => {
    if (!workflow) {
      return null;
    }
    try {
      return {
        list: resolveScope(workflow, scopePath).list,
        layout: layoutForScope(scopePath),
      };
    } catch {
      return {
        list: resolveScope(workflow, []).list,
        layout: layoutForScope([]),
      };
    }
  });

  const graph = $derived(view ? treeToGraph(view.list, view.layout) : null);

  const selectedNode = $derived(
    graph && selectedId
      ? (graph.nodes.find((node) => node.id === selectedId) ?? null)
      : null,
  );

  // Sibling names visible to a Switch `then` jump in this scope, minus the switch
  // itself (DESIGN.md §3).
  const scopeSiblings = $derived(
    view ? siblingNames(view.list, selectedId ?? undefined) : [],
  );

  /** Resolve the live task list for the current scope, or null if unavailable. */
  function currentList(): TaskList | null {
    if (!workflow) {
      return null;
    }
    try {
      return resolveScope(workflow, scopePath).list;
    } catch {
      return resolveScope(workflow, []).list;
    }
  }

  /**
   * Apply a list mutation, then re-run ensureTaskIds across the whole workflow so
   * any newly-added container's seeded children get ids too (DESIGN.md §2.3),
   * before the derived graph re-projects.
   */
  function mutate(fn: (list: TaskList) => void) {
    const list = currentList();
    if (!list || !workflow) {
      return;
    }
    fn(list);
    ensureTaskIds(workflow);
    // A fresh edit makes any prior save feedback stale.
    clearSaveFeedback();
  }

  function addNode(kind: TaskKind) {
    const list = currentList();
    if (!list || !workflow) {
      return;
    }
    const added = addTask(list, kind);
    ensureTaskIds(workflow);
    selectedId = added.id;
    renameError = null;
    clearSaveFeedback();
  }

  function renameSelected(newName: string) {
    const list = currentList();
    if (!list || !selectedId || !workflow) {
      return;
    }
    const outcome = applyRename(list, selectedId, newName);
    if (outcome === 'ok') {
      ensureTaskIds(workflow);
      renameError = null;
      clearSaveFeedback();
    } else {
      renameError = outcome;
    }
  }

  /**
   * Save the in-memory workflow through the single validation gate
   * (PUT /api/workflows/[name], DESIGN.md §4). The server runs ensureTaskIds and
   * syncWorkflowType and returns the canonical saved workflow, which we reflect
   * back into state so client and disk cannot drift — the client does not
   * duplicate that server-side normalisation.
   */
  async function save() {
    if (!workflow || saving || !dirty) {
      return;
    }
    saving = true;
    clearSaveFeedback();
    const result = await saveWorkflow(data.name, workflow, fetch);
    saving = false;

    switch (result.kind) {
      case 'saved':
        workflow = result.workflow;
        savedSnapshot = serializeWorkflow(result.workflow);
        break;
      case 'invalid':
        validationErrors = toSaveErrorDisplays(result.errors);
        break;
      case 'error':
        saveErrorReason = result.reason;
        saveErrorStatus = result.status;
        break;
    }
  }

  function onKeydown(event: KeyboardEvent) {
    // Cmd/Ctrl+S — the universal Save shortcut — instead of the browser's own.
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void save();
    }
  }

  /** Map a request-failure reason to its localized message. */
  function saveErrorMessage(
    reason: 'network' | 'server' | 'malformed',
    status: number | undefined,
  ): string {
    switch (reason) {
      case 'network':
        return m.save_network_error();
      case 'server':
        return m.save_server_error({ status: String(status ?? '') });
      case 'malformed':
        return m.save_malformed_error();
      default: {
        const unreachable: never = reason;
        return String(unreachable);
      }
    }
  }

  function patchSelected(task: Task) {
    const id = selectedId;
    if (!workflow || !id) {
      return;
    }
    mutate((list) => updateTaskBody(list, id, task));
  }

  const actions: CanvasActions = {
    select: (id) => {
      selectedId = id;
      renameError = null;
    },
    deselect: () => {
      selectedId = null;
      renameError = null;
    },
    drill: (node: FlowNode, field) => {
      scopePath = [...scopePath, { taskId: node.id, label: node.name, field }];
      selectedId = null;
      renameError = null;
    },
    moveUp: (id) => mutate((list) => void moveTask(list, id, 'up')),
    moveDown: (id) => mutate((list) => void moveTask(list, id, 'down')),
    remove: (id) => {
      mutate((list) => removeTask(list, id));
      if (selectedId === id) {
        selectedId = null;
        renameError = null;
      }
    },
  };

  function navigate(index: number) {
    scopePath = index < 0 ? [] : scopePath.slice(0, index + 1);
    selectedId = null;
    renameError = null;
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="editor">
  <header>
    <span class="product">{m.app_name()}</span>
    {#if workflow}
      <span class="workflow-name">{data.name}</span>
      <span class="spacer"></span>
      <span
        class="save-status"
        class:dirty
        aria-live="polite"
        data-testid="save-status"
      >
        {#if saving}
          {m.save_status_saving()}
        {:else if dirty}
          {m.save_status_dirty()}
        {:else}
          {m.save_status_clean()}
        {/if}
      </span>
      <button
        type="button"
        class="save-button"
        onclick={save}
        disabled={saving || !dirty}
      >
        {m.save_button()}
      </button>
    {/if}
  </header>

  {#if !workflow}
    <p class="error">{m.editor_load_error({ name: data.name })}</p>
  {:else}
    {#if validationErrors.length > 0}
      <div class="save-banner invalid" role="alert">
        <p class="banner-heading">{m.save_invalid_heading()}</p>
        <ul>
          {#each validationErrors as error (error.path + error.message)}
            <li>
              {#if error.taskHint}
                <span class="loc"
                  >{m.save_invalid_location_task({
                    task: error.taskHint,
                  })}</span
                >
              {/if}
              <span class="msg">{error.message}</span>
            </li>
          {/each}
        </ul>
      </div>
    {:else if saveErrorReason}
      <div class="save-banner request-error" role="alert">
        {saveErrorMessage(saveErrorReason, saveErrorStatus)}
      </div>
    {/if}

    <div class="body">
      <aside class="details">
        <h2>{m.details_heading()}</h2>
        <dl>
          <dt>{m.details_task_queue()}</dt>
          <dd>{workflow.document.taskQueue}</dd>
          <dt>{m.details_version()}</dt>
          <dd>{workflow.document.version}</dd>
          <dt>{m.details_dsl()}</dt>
          <dd>{workflow.document.dsl}</dd>
        </dl>
      </aside>

      <main class="stage">
        <NodePalette onadd={addNode} />
        <Breadcrumb path={scopePath} onnavigate={navigate} />
        <div class="canvas-wrap">
          {#if graph}
            <Canvas {graph} {selectedId} {actions} />
          {/if}
        </div>
      </main>

      <aside class="inspector-pane">
        {#if selectedNode}
          {#key selectedNode.id}
            <Inspector
              name={selectedNode.name}
              task={selectedNode.task}
              kind={selectedNode.kind}
              siblingNames={scopeSiblings}
              {renameError}
              onrename={renameSelected}
              onpatch={patchSelected}
            />
          {/key}
        {:else}
          <p class="inspector-empty">{m.inspector_empty()}</p>
        {/if}
      </aside>
    </div>
  {/if}
</div>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    height: 100vh;
    font-family: ui-sans-serif, system-ui, sans-serif;
    color: #0f172a;
  }

  header {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    padding: 0.65rem 1rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .product {
    font-weight: 700;
  }

  .workflow-name {
    color: #475569;
    font-size: 0.9rem;
  }

  .spacer {
    flex: 1;
  }

  .save-status {
    font-size: 0.8rem;
    color: #64748b;
  }

  .save-status.dirty {
    color: #b45309;
    font-weight: 600;
  }

  .save-button {
    padding: 0.35rem 0.9rem;
    border: 1px solid #4338ca;
    border-radius: 0.375rem;
    background: #4338ca;
    color: #ffffff;
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .save-button:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .save-banner {
    margin: 0;
    padding: 0.6rem 1rem;
    font-size: 0.85rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .save-banner.invalid {
    background: #fef2f2;
    color: #991b1b;
  }

  .save-banner.request-error {
    background: #fffbeb;
    color: #92400e;
  }

  .banner-heading {
    margin: 0 0 0.35rem;
    font-weight: 600;
  }

  .save-banner ul {
    margin: 0;
    padding-left: 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .save-banner .loc {
    font-weight: 600;
    margin-right: 0.35rem;
  }

  .save-banner .msg {
    font-family: ui-monospace, monospace;
    font-size: 0.78rem;
  }

  .error {
    margin: 2rem;
    color: #b91c1c;
  }

  .body {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .details {
    width: 220px;
    padding: 1rem;
    border-right: 1px solid #e2e8f0;
    overflow: auto;
  }

  .details h2 {
    margin: 0 0 0.75rem;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
  }

  dl {
    margin: 0;
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.15rem 0;
  }

  dt {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #94a3b8;
    margin-top: 0.5rem;
  }

  dd {
    margin: 0;
    font-size: 0.9rem;
    overflow-wrap: anywhere;
  }

  .stage {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .canvas-wrap {
    flex: 1;
    min-height: 0;
  }

  .inspector-pane {
    width: 300px;
    padding: 1rem;
    border-left: 1px solid #e2e8f0;
    overflow: auto;
  }

  .inspector-empty {
    color: #64748b;
    font-size: 0.85rem;
  }
</style>
