<script lang="ts">
  import { goto, replaceState } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import Breadcrumb from '$lib/components/Breadcrumb.svelte';
  import Canvas from '$lib/components/Canvas.svelte';
  import Inspector from '$lib/components/Inspector.svelte';
  import NodePalette from '$lib/components/NodePalette.svelte';
  import WorkflowDetails from '$lib/components/WorkflowDetails.svelte';
  import {
    type CanvasActions,
    DND_TASK_KIND_MIME,
  } from '$lib/components/canvas';
  import { applyRename } from '$lib/editor/commands';
  import type { RenameOutcome } from '$lib/editor/commands';
  import {
    saveWorkflow,
    serializeWorkflow,
    toSaveErrorDisplays,
  } from '$lib/editor/save';
  import type { SaveErrorDisplay } from '$lib/editor/save';
  import type {
    FlowNode,
    ScopeField,
    ScopePath,
    TaskKind,
  } from '$lib/graph/model';
  import { TASK_KINDS, layoutForScope } from '$lib/graph/model';
  import {
    addTask,
    ensureTaskIds,
    moveTask,
    removeTask,
    updateTaskBody,
  } from '$lib/graph/mutations';
  import {
    ScopeResolutionError,
    resolveScope,
    resolveSelectedName,
    resolveUrlSegments,
    scopePathToUrlSegments,
    siblingNames,
  } from '$lib/graph/scope';
  import { treeToGraph } from '$lib/graph/treeToGraph';
  import { m } from '$lib/paraglide/messages';
  import type { Task, TaskList } from '$lib/types/zigflow';
  import { untrack } from 'svelte';

  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // The loaded workflow is held as reactive `$state`: mutations happen on this
  // proxy in place and the derived graph re-projects (AGENTS "Editor
  // architecture"). Reset only when the workflow name changes.
  let workflow = $state(untrack(() => data.workflow));
  let renameError = $state<RenameOutcome | null>(null);

  // Display name follows the §6 rule: document.title || document.workflowType,
  // never the routing/directory name (`data.name`). Null until the workflow
  // loads; the routing name is surfaced separately in the details sidebar.
  const workflowDisplayName = $derived(
    workflow ? workflow.document.title || workflow.document.workflowType : null,
  );

  // Save state — see DESIGN.md §6 ("Save & dirty state"). `savedSnapshot` is the
  // serialized workflow as last written to disk; dirty = current differs.
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

  // Reset workflow + save state when navigating to a *different* workflow (the
  // page instance is reused across route params). `seenName` is a plain closure.
  let seenName: string | undefined;
  $effect(() => {
    if (seenName !== data.name) {
      seenName = data.name;
      workflow = data.workflow;
      savedSnapshot = data.workflow ? serializeWorkflow(data.workflow) : '';
      clearSaveFeedback();
    }
  });

  // Scope is a projection of the URL (DESIGN.md §6): the `[...scope]` segments
  // are the source of truth. We re-resolve them against the *live* (reactive,
  // possibly-edited) workflow so unsaved additions/renames inside the open path
  // still resolve — the load's server-resolved value is only for first paint. A
  // stale/typo link fails to resolve and falls back to root with a notice (§6).
  const scopeResolution = $derived.by(() => {
    if (!workflow) {
      return { path: [] as ScopePath, error: false };
    }
    try {
      return {
        path: resolveUrlSegments(workflow, data.scopeSegments),
        error: false,
      };
    } catch (err) {
      if (err instanceof ScopeResolutionError) {
        return { path: [] as ScopePath, error: data.scopeSegments.length > 0 };
      }
      throw err;
    }
  });
  const scopePath = $derived(scopeResolution.path);
  const scopeError = $derived(scopeResolution.error);

  /** Clear transient save banners (validation list + request-error message). */
  function clearSaveFeedback() {
    validationErrors = [];
    saveErrorReason = null;
    saveErrorStatus = undefined;
  }

  // The scope currently on screen: its task list and layout.
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

  // Selection (DESIGN.md §6) is UI state carried in the URL as
  // `?selected=<taskName>`, name-based like scope segments. `selectedId` is the
  // single reactive source of truth: the click handler sets it directly (which
  // drives the node highlight), and each selection change mirrors it to the URL
  // via `replaceState`. It is NOT `$derived` from `page.url`, because SvelteKit's
  // shallow `replaceState` updates the address bar but not the reactive
  // `page.url` — so a URL-derived value never moves on click, only after a real
  // load re-reads the URL (the "highlight stuck until refresh" bug). Instead it's
  // seeded from the URL for the first paint / deep links, and re-synced from the
  // URL only on real navigation (see the effect below).
  function resolveSelectedFromUrl(): string | null {
    return view
      ? resolveSelectedName(view.list, page.url.searchParams.get('selected'))
      : null;
  }

  let selectedId = $state<string | null>(untrack(resolveSelectedFromUrl));

  // Re-resolve selection from the URL only when a real navigation changes
  // `page.url` (goto/refresh/back-forward). Clicks use shallow `replaceState`,
  // which does not touch `page.url`, so this leaves the click-set value alone. A
  // scope change navigates to a URL without `?selected`, so this also clears the
  // selection whenever the visible scope changes.
  let seenHref = untrack(() => page.url.href);
  $effect(() => {
    if (seenHref !== page.url.href) {
      seenHref = page.url.href;
      selectedId = resolveSelectedFromUrl();
    }
  });

  // Drop a stale inspector rename error whenever the selected task changes.
  let seenSelectedId: string | null | undefined;
  $effect(() => {
    if (seenSelectedId !== selectedId) {
      seenSelectedId = selectedId;
      renameError = null;
    }
  });

  const selectedNode = $derived(
    graph && selectedId
      ? (graph.nodes.find((node) => node.id === selectedId) ?? null)
      : null,
  );

  const scopeSiblings = $derived(
    view ? siblingNames(view.list, selectedId ?? undefined) : [],
  );

  // Boundary flags for the inspector's move controls, computed the same way the
  // canvas derives them for a node (canvas.ts `toFlowNodes`): first/last in the
  // current scope's list disable move-up/move-down respectively.
  const selectedFirst = $derived(
    selectedNode != null && selectedNode.index === 0,
  );
  const selectedLast = $derived(
    graph != null &&
      selectedNode != null &&
      selectedNode.index === graph.nodes.length - 1,
  );

  /**
   * Navigate to a scope by pushing its URL — this is what makes scope shareable
   * and back/forward-navigable. The `[...scope]` rest param carries the segments
   * from {@link scopePathToUrlSegments}; an empty scope resolves to just the
   * workflow root. `resolve` applies the base path. `replaceState` is used for
   * the rename-driven URL rewrite (one edit, not a navigation).
   */
  function goToScope(path: ScopePath, options?: { replaceState?: boolean }) {
    void goto(
      resolve('/workflows/[name]/[...scope]', {
        name: data.name,
        scope: scopePathToUrlSegments(path).map(encodeURIComponent).join('/'),
      }),
      options,
    );
  }

  /**
   * Mirror the current selection into the URL as `?selected=<name>` (or remove it
   * when null), keeping the shareable/refreshable URL in lockstep with
   * `selectedId`. Uses `replaceState` — not `goto`/pushState — so clicking through
   * nodes doesn't create a back-button entry per click. Preserves the current
   * path + base via `page.url`.
   */
  function setSelectedParam(name: string | null) {
    const url = new URL(page.url);
    if (name === null) {
      url.searchParams.delete('selected');
    } else {
      url.searchParams.set('selected', name);
    }
    // Query-only shallow update on the current, already-resolved URL (base path
    // preserved via page.url); resolve() targets route paths, not query strings.
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    replaceState(url, page.state);
  }

  /**
   * Select a node by id: set the single source `selectedId` (which drives the
   * highlight) and mirror its name into the URL, in lockstep.
   */
  function selectById(id: string) {
    const node = graph?.nodes.find((entry) => entry.id === id);
    selectedId = node ? node.id : null;
    setSelectedParam(node ? node.name : null);
  }

  /** Clear the selection (empty-canvas click, or Escape). */
  function deselect() {
    selectedId = null;
    setSelectedParam(null);
  }

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
   * any newly-added container's seeded children get ids too (DESIGN.md §2.3).
   */
  function mutate(fn: (list: TaskList) => void) {
    const list = currentList();
    if (!list || !workflow) {
      return;
    }
    fn(list);
    ensureTaskIds(workflow);
    clearSaveFeedback();
  }

  function addNode(kind: TaskKind) {
    const list = currentList();
    if (!list || !workflow) {
      return;
    }
    const added = addTask(list, kind);
    ensureTaskIds(workflow);
    // Select the new node: set the source-of-truth id, mirror its name to the URL.
    selectedId = added.id;
    setSelectedParam(added.name);
    clearSaveFeedback();
  }

  /**
   * Drop a dragged palette kind onto the canvas. Deliberately identical to the
   * "Add Node" button: it appends to the END of the current scope (no cursor
   * position is read), so this drag mechanic introduces no free XY placement —
   * array order stays the only ordering (DESIGN.md §3).
   */
  function onCanvasDragOver(event: DragEvent) {
    if (event.dataTransfer?.types.includes(DND_TASK_KIND_MIME)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  function onCanvasDrop(event: DragEvent) {
    const kind = event.dataTransfer?.getData(DND_TASK_KIND_MIME);
    if (!kind || !(TASK_KINDS as readonly string[]).includes(kind)) {
      return;
    }
    event.preventDefault();
    addNode(kind as TaskKind);
  }

  /**
   * Document-metadata edits (DESIGN.md §6). These mutate the same reactive
   * `workflow` object task edits use, so `dirty` and `save()` pick them up with
   * no extra plumbing. Optional fields (title/summary) are removed when cleared,
   * not stored as "" — matching the inspector's optional-field convention
   * (see writeForTask in forms/forForm.ts).
   *
   * Each edit **reassigns** `workflow.document` to a fresh object rather than
   * mutating a key in place. `dirty` compares `serializeWorkflow(workflow)`,
   * which only enumerates the keys that exist — so *adding* a previously-absent
   * optional key (e.g. first `title`) wouldn't invalidate the derived if we
   * mutated in place. Replacing the whole `document` reference always does.
   */
  function setTaskQueue(value: string) {
    if (!workflow) {
      return;
    }
    workflow.document = { ...workflow.document, taskQueue: value };
    clearSaveFeedback();
  }

  function setOptionalDoc(field: 'title' | 'summary', value: string) {
    if (!workflow) {
      return;
    }
    const nextDoc = { ...workflow.document };
    if (value.trim() !== '') {
      nextDoc[field] = value;
    } else {
      delete nextDoc[field];
    }
    workflow.document = nextDoc;
    clearSaveFeedback();
  }

  function renameSelected(newName: string) {
    const list = currentList();
    const id = selectedId;
    if (!list || !id || !workflow) {
      return;
    }
    // Capture the scope path before mutating: if the renamed task is part of it,
    // the name-based URL is now stale and must be rewritten.
    const pathBefore = scopePath;
    const outcome = applyRename(list, id, newName);
    if (outcome === 'ok') {
      ensureTaskIds(workflow);
      renameError = null;
      clearSaveFeedback();
      if (pathBefore.some((step) => step.taskId === id)) {
        // (Dormant with the current UI: the selected task is a child of the open
        // scope, never an ancestor in the path — but keep this correct.) The
        // renamed task is part of the open path, so rewrite the path segments.
        const rewritten = pathBefore.map((step) =>
          step.taskId === id ? { ...step, label: newName } : step,
        );
        // replaceState: the user experiences this as one edit, not a navigation,
        // so it shouldn't add a back-button entry.
        goToScope(rewritten, { replaceState: true });
      } else {
        // The selected task's name changed — keep `?selected` pointing at it, or
        // selection would drop (it's resolved from the name).
        setSelectedParam(newName);
      }
    } else {
      renameError = outcome;
    }
  }

  /**
   * Save through the single validation gate (PUT /api/workflows/[name], §4). The
   * server runs ensureTaskIds/syncWorkflowType and returns the canonical saved
   * workflow, reflected back so client and disk don't drift.
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

  /** Whether a keydown target is an editable field we shouldn't hijack. */
  function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    const tag = target.tagName;
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      target.isContentEditable
    );
  }

  function onKeydown(event: KeyboardEvent) {
    // Cmd/Ctrl+S — the universal Save shortcut — instead of the browser's own.
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void save();
      return;
    }
    // Escape deselects — but not while the user is mid-edit in a form field, so
    // Escape keeps its natural in-field behavior there.
    if (
      event.key === 'Escape' &&
      selectedId &&
      !isEditableTarget(event.target)
    ) {
      deselect();
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
    select: (id) => selectById(id),
    deselect: () => deselect(),
    drill: (node: FlowNode, field) => {
      // Navigate by URL so the drilled-into scope is shareable and survives
      // refresh/back/forward. The new scope URL carries no `?selected`, so
      // selection clears (it's derived from that param).
      goToScope([...scopePath, { taskId: node.id, label: node.name, field }]);
    },
    moveUp: (id) => mutate((list) => void moveTask(list, id, 'up')),
    moveDown: (id) => mutate((list) => void moveTask(list, id, 'down')),
    remove: (id) => {
      const wasSelected = selectedId === id;
      mutate((list) => removeTask(list, id));
      // Drop the now-stale `?selected` if we removed the selected task.
      if (wasSelected) {
        deselect();
      }
    },
  };

  function navigate(index: number) {
    goToScope(index < 0 ? [] : scopePath.slice(0, index + 1));
  }

  // Inspector toolbar handlers: reuse the exact same `actions` the canvas used,
  // keyed by the selected id, so move/delete behaviour (including
  // remove-clears-selection) is identical to the old on-card controls.
  function moveSelectedUp() {
    if (selectedId) {
      actions.moveUp(selectedId);
    }
  }

  function moveSelectedDown() {
    if (selectedId) {
      actions.moveDown(selectedId);
    }
  }

  function deleteSelected() {
    if (selectedId) {
      actions.remove(selectedId);
    }
  }

  function drillSelected(field: ScopeField) {
    if (selectedNode) {
      actions.drill(selectedNode, field);
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
  <title>{workflowDisplayName ?? m.app_name()}</title>
</svelte:head>

<div class="editor">
  <header>
    <span class="product">{m.app_name()}</span>
    {#if workflow}
      <span class="workflow-name">{workflowDisplayName}</span>
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
    {#if scopeError}
      <div class="scope-banner" role="status">{m.scope_not_found()}</div>
    {/if}
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
      <aside class="sidebar">
        <section class="palette-section">
          <NodePalette onadd={addNode} atRoot={scopePath.length === 0} />
        </section>

        <WorkflowDetails
          directory={data.name}
          document={workflow.document}
          ontaskqueue={setTaskQueue}
          ontitle={(v) => setOptionalDoc('title', v)}
          onsummary={(v) => setOptionalDoc('summary', v)}
        />
      </aside>

      <main class="stage">
        <Breadcrumb path={scopePath} onnavigate={navigate} />
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="canvas-wrap"
          ondragover={onCanvasDragOver}
          ondrop={onCanvasDrop}
        >
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
              atRoot={scopePath.length === 0}
              first={selectedFirst}
              last={selectedLast}
              onrename={renameSelected}
              onpatch={patchSelected}
              onmoveup={moveSelectedUp}
              onmovedown={moveSelectedDown}
              ondelete={deleteSelected}
              ondrill={drillSelected}
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

  .scope-banner {
    margin: 0;
    padding: 0.6rem 1rem;
    font-size: 0.85rem;
    background: #eff6ff;
    color: #1e40af;
    border-bottom: 1px solid #e2e8f0;
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

  .sidebar {
    display: flex;
    flex-direction: column;
    width: 240px;
    border-right: 1px solid #e2e8f0;
    overflow: auto;
  }

  /* MAIN section — the node palette takes most of the sidebar height. */
  .palette-section {
    flex: 1;
    min-height: 0;
    padding: 1rem;
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
