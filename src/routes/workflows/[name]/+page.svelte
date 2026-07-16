<script lang="ts">
  import Breadcrumb from '$lib/components/Breadcrumb.svelte';
  import Canvas from '$lib/components/Canvas.svelte';
  import Inspector from '$lib/components/Inspector.svelte';
  import NodePalette from '$lib/components/NodePalette.svelte';
  import type { CanvasActions } from '$lib/components/canvas';
  import { applyRename } from '$lib/editor/commands';
  import type { RenameOutcome } from '$lib/editor/commands';
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

  // Reset editor state when navigating to a different workflow (the page instance
  // is reused across route params). `seenName` is a plain closure variable.
  let seenName: string | undefined;
  $effect(() => {
    if (seenName !== data.name) {
      seenName = data.name;
      workflow = data.workflow;
      scopePath = [];
      selectedId = null;
      renameError = null;
    }
  });

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
    } else {
      renameError = outcome;
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

<div class="editor">
  <header>
    <span class="product">{m.app_name()}</span>
    {#if workflow}
      <span class="workflow-name">{data.name}</span>
    {/if}
  </header>

  {#if !workflow}
    <p class="error">{m.editor_load_error({ name: data.name })}</p>
  {:else}
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
