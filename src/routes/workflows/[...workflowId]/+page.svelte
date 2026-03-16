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
  import { exportToYaml } from '$lib/export/yaml';
  import { t } from '$lib/i18n/index.svelte';
  import {
    addForkBranch,
    addSwitchBranch,
    addWorkflow,
    emptyFlowGraph,
    getGraphAtPath,
    insertNodeAtPath,
    moveNode,
    referencedWorkflowNames,
    removeForkBranch,
    removeNode,
    removeSwitchBranch,
    removeWorkflow,
    renameWorkflowReferences,
    replaceNode,
    updateGraphAtPath,
    updateTrySection,
    updateWorkflowName,
  } from '$lib/tasks/actions';
  import type {
    FlowGraph,
    GraphPath,
    Node,
    NodeType,
    WorkflowFile,
  } from '$lib/tasks/model';
  import Breadcrumb from '$lib/ui/Breadcrumb.svelte';
  import Canvas from '$lib/ui/Canvas.svelte';
  import ContextIndicator from '$lib/ui/ContextIndicator.svelte';
  import Inspector from '$lib/ui/Inspector.svelte';
  import Sidebar from '$lib/ui/Sidebar.svelte';
  import { onMount, untrack } from 'svelte';

  import type { PageProps } from './$types';

  // Type alias for resolve() casts — satisfies Pathname = "/"  | "/workflows" | `/workflows/${string}`
  type WfPath = `/workflows/${string}`;

  // Props from load()
  let { data }: PageProps = $props();

  // ---------------------------------------------------------------------------
  // Workflow state (IR)
  // ---------------------------------------------------------------------------

  // The workflow file is loaded from disk by the server load function.
  // _initialWorkflowId captures the root workflow ID once; it never changes.
  // workflowFile is mutable state — untrack intentionally captures initial value.
  const _initialWorkflowId = untrack(() => data.workflowFile.order[0]!);

  let workflowFile = $state<WorkflowFile>(untrack(() => data.workflowFile));

  // ---------------------------------------------------------------------------
  // Save state machine
  // ---------------------------------------------------------------------------

  type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

  let saveStatus = $state<SaveStatus>('idle');
  let lastSaveError = $state<string | undefined>(undefined);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let savePending = false;

  // Derive the workflow file name from route data. Using $derived avoids
  // capturing a stale closure over `data` that Svelte would warn about.
  const wfFileName = $derived(data.workflowId);

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
      // Another save is running; remember to run again once it finishes.
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
    const fileName = wfFileName;
    const snapshot = $state.snapshot(workflowFile);
    try {
      const res = await fetch(
        `/api/workflows/${encodeURIComponent(fileName)}`,
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

  function handleSave(): void {
    if (saveStatus !== 'dirty' && saveStatus !== 'error') return;
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    doSave();
  }

  // ---------------------------------------------------------------------------
  // Query param ↔ GraphPath sync
  //
  // Param format: ?selected=<segment1>/<segment2>/...
  // Single segment: selected node at root (e.g. ?selected=<uuid>)
  // Two segments:   navigation into a branch (e.g. ?selected=<uuid>/<uuid>)
  //
  // URL segments are node/branch IDs (which equal metadata.__zigflow_id).
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // ID helpers — node.id === metadata.__zigflow_id (invariant from factories).
  // ---------------------------------------------------------------------------

  function getNodeHashId(node: Node): string {
    return node.id;
  }

  function getBranchHashId(branch: { id: string }): string {
    return branch.id;
  }

  // Convert internal GraphPath segments (node.id / branch.id) to URL-safe
  // hash segments (__zigflow_id). Traverses the WorkflowFile to resolve each
  // segment; returns [] if the path cannot be fully resolved.
  function graphPathToHashSegments(
    file: WorkflowFile,
    path: GraphPath,
  ): string[] {
    const wf = file.workflows[path.workflowId];
    if (!wf || path.segments.length === 0) return [];

    const hashSegs: string[] = [];
    let graph: FlowGraph = wf.root;
    let i = 0;

    while (i < path.segments.length) {
      const nodeId = path.segments[i]!;
      const node = graph.nodes[nodeId];
      if (!node) break;

      hashSegs.push(getNodeHashId(node));

      if (node.type === 'loop') {
        graph = node.bodyGraph;
        i += 1;
        continue;
      }

      // switch, fork, try — next segment identifies the sub-graph
      i += 1;
      if (i >= path.segments.length) break;
      const subId = path.segments[i]!;

      if (node.type === 'switch') {
        const branch = node.branches.find((b) => b.id === subId);
        if (!branch) break;
        hashSegs.push(getBranchHashId(branch));
        graph = branch.graph;
      } else if (node.type === 'fork') {
        const branch = node.branches.find((b) => b.id === subId);
        if (!branch) break;
        hashSegs.push(getBranchHashId(branch));
        graph = branch.graph;
      } else if (node.type === 'try') {
        // 'tryGraph' and 'catchGraph' are stable string constants, not IDs.
        hashSegs.push(subId);
        graph =
          subId === 'catchGraph'
            ? (node.catchGraph ?? node.tryGraph)
            : node.tryGraph;
      }

      i += 1;
    }

    return hashSegs;
  }

  // Since node.id === metadata.__zigflow_id, hash segments ARE the node IDs.
  function findNodeByHashId(
    graph: FlowGraph,
    hashId: string,
  ): Node | undefined {
    return graph.nodes[hashId];
  }

  // Convert URL hash segments (__zigflow_id) back to internal GraphPath
  // segments (node.id / branch.id). Returns null if any segment cannot be
  // resolved.
  function hashSegmentsToGraphPath(
    file: WorkflowFile,
    workflowId: string,
    hashSegs: string[],
  ): GraphPath | null {
    const wf = file.workflows[workflowId];
    if (!wf) return null;
    if (hashSegs.length === 0) return { workflowId, segments: [] };

    const segments: string[] = [];
    let graph: FlowGraph = wf.root;
    let i = 0;

    while (i < hashSegs.length) {
      const hashId = hashSegs[i]!;
      const node = findNodeByHashId(graph, hashId);
      if (!node) return null;

      segments.push(node.id);

      if (node.type === 'loop') {
        graph = node.bodyGraph;
        i += 1;
        continue;
      }

      // switch, fork, try
      i += 1;
      if (i >= hashSegs.length) break;
      const subHashId = hashSegs[i]!;

      if (node.type === 'switch') {
        const branch = node.branches.find(
          (b) => getBranchHashId(b) === subHashId,
        );
        if (!branch) return null;
        segments.push(branch.id);
        graph = branch.graph;
      } else if (node.type === 'fork') {
        const branch = node.branches.find(
          (b) => getBranchHashId(b) === subHashId,
        );
        if (!branch) return null;
        segments.push(branch.id);
        graph = branch.graph;
      } else if (node.type === 'try') {
        if (subHashId !== 'tryGraph' && subHashId !== 'catchGraph') return null;
        segments.push(subHashId);
        graph =
          subHashId === 'catchGraph'
            ? (node.catchGraph ?? node.tryGraph)
            : node.tryGraph;
      }

      i += 1;
    }

    return { workflowId, segments };
  }

  // Parse ?selected= segments into graphPath + selectedNodeId.
  //
  // Single segment: treat as selected node at root.
  // Two or more segments: treat as navigation path (switch/fork/try/loop).
  // Invalid or missing segments fall back gracefully to root with no selection.
  function parseSelectedSegments(
    file: WorkflowFile,
    defaultWorkflowId: string,
    segs: string[],
  ): { graphPath: GraphPath; selectedNodeId: string | null } {
    const defaultPath: GraphPath = {
      workflowId: defaultWorkflowId,
      segments: [],
    };

    if (segs.length === 0) {
      return { graphPath: defaultPath, selectedNodeId: null };
    }

    if (segs.length === 1) {
      const wf = file.workflows[defaultWorkflowId];
      if (wf) {
        const node = findNodeByHashId(wf.root, segs[0]!);
        if (node) {
          return { graphPath: defaultPath, selectedNodeId: node.id };
        }
      }
      return { graphPath: defaultPath, selectedNodeId: null };
    }

    // Two or more segments: navigation path
    const path = hashSegmentsToGraphPath(file, defaultWorkflowId, segs);
    if (path) {
      return { graphPath: path, selectedNodeId: null };
    }

    return { graphPath: defaultPath, selectedNodeId: null };
  }

  // ---------------------------------------------------------------------------
  // Navigation state — GraphPath
  //
  // graphPath.workflowId identifies the active workflow.
  // graphPath.segments encodes the path into nested sub-graphs.
  //
  // State is initialised from data.selectedSegments (parsed from ?selected=)
  // and kept in sync via a $effect that re-runs on URL navigation.
  // ---------------------------------------------------------------------------

  // Parse URL params synchronously so both SSR and hydration start with the
  // correct graphPath and selectedNodeId. untrack suppresses the reactivity
  // warning for data.selectedSegments since the initial capture is intentional.
  const _initialParsed = untrack(() =>
    parseSelectedSegments(
      data.workflowFile,
      _initialWorkflowId,
      data.selectedSegments,
    ),
  );

  let selectedWorkflowId = $state<string>(_initialWorkflowId);
  let graphPath = $state<GraphPath>(_initialParsed.graphPath);
  let selectedNodeId = $state<string | null>(_initialParsed.selectedNodeId);
  // Controls whether the Inspector panel is open. Initialised from the URL so
  // that a refresh or deep-link with ?selected=<id> reopens the Inspector for
  // the selected node, matching the behaviour of an explicit node click.
  let inspectorOpen = $state(_initialParsed.selectedNodeId !== null);

  // Re-seed state from URL on any SvelteKit navigation that changes
  // data.selectedSegments. workflowFile is read via untrack so user edits do
  // not reset navigation state. With pushState-only navigation,
  // data.selectedSegments never changes after the initial load, so this
  // effect fires only once on mount in that case.
  const selectedSegments = $derived(data.selectedSegments ?? []);

  $effect(() => {
    const parsed = parseSelectedSegments(
      untrack(() => workflowFile),
      _initialWorkflowId,
      selectedSegments,
    );
    graphPath = parsed.graphPath;
    selectedNodeId = parsed.selectedNodeId;
    inspectorOpen = parsed.selectedNodeId !== null;
  });

  // ---------------------------------------------------------------------------
  // Derive the current FlowGraph (Step 5)
  // ---------------------------------------------------------------------------

  const currentGraph = $derived.by((): FlowGraph | null => {
    try {
      // Snapshot workflowFile to a plain object before traversing so that
      // getGraphAtPath returns a non-proxied FlowGraph. This prevents Svelte
      // reactive proxy objects from reaching SvelteFlow (via Canvas) and
      // silences the "Use $state.raw for nodes" performance warning.
      return getGraphAtPath($state.snapshot(workflowFile), graphPath);
    } catch {
      return null;
    }
  });

  // ---------------------------------------------------------------------------
  // Breadcrumb labels + segment boundaries (for navigating back by crumb index)
  //
  // boundaries[i] = number of segments in graphPath.segments that correspond
  // to crumb i. Used by handleNavigate to trim segments precisely.
  // ---------------------------------------------------------------------------

  type CrumbInfo = { crumbs: string[]; boundaries: number[] };

  function buildCrumbInfo(file: WorkflowFile, path: GraphPath): CrumbInfo {
    const crumbs: string[] = [];
    const boundaries: number[] = [];

    const wf = file.workflows[path.workflowId];
    if (!wf) return { crumbs: [], boundaries: [] };

    crumbs.push(wf.name);
    boundaries.push(0); // root = 0 segments consumed

    let graph: FlowGraph = wf.root;
    let i = 0;

    while (i < path.segments.length) {
      const nodeId = path.segments[i];
      if (!nodeId) break;
      const node = graph.nodes[nodeId];
      if (!node) break;

      if (node.type === 'loop') {
        crumbs.push(`${node.name} › body`);
        boundaries.push(i + 1);
        graph = node.bodyGraph;
        i += 1;
        continue;
      }

      // switch, fork, try — consume two segments
      const nextI = i + 1;
      if (nextI >= path.segments.length) break;
      const subId = path.segments[nextI];
      if (!subId) break;

      if (node.type === 'switch') {
        const branch = node.branches.find((b) => b.id === subId);
        crumbs.push(`${node.name} › ${branch?.label ?? subId}`);
        boundaries.push(nextI + 1);
        if (branch) graph = branch.graph;
        i = nextI + 1;
      } else if (node.type === 'fork') {
        const branch = node.branches.find((b) => b.id === subId);
        crumbs.push(`${node.name} › ${branch?.label ?? subId}`);
        boundaries.push(nextI + 1);
        if (branch) graph = branch.graph;
        i = nextI + 1;
      } else if (node.type === 'try') {
        const label = subId === 'catchGraph' ? 'catch' : 'try';
        crumbs.push(`${node.name} › ${label}`);
        boundaries.push(nextI + 1);
        graph =
          subId === 'catchGraph'
            ? (node.catchGraph ?? node.tryGraph)
            : node.tryGraph;
        i = nextI + 1;
      } else {
        break;
      }
    }

    return { crumbs, boundaries };
  }

  const crumbInfo = $derived(buildCrumbInfo(workflowFile, graphPath));
  const breadcrumbs = $derived(crumbInfo.crumbs);

  // ---------------------------------------------------------------------------
  // Context indicator label — derives a human-readable sentence that describes
  // exactly where the user is currently editing.
  // ---------------------------------------------------------------------------

  function buildContextLabel(file: WorkflowFile, path: GraphPath): string {
    const wf = file.workflows[path.workflowId];
    if (!wf) return '';

    if (path.segments.length === 0) {
      return `Editing Workflow: ${wf.name}`;
    }

    let graph: FlowGraph = wf.root;
    let i = 0;
    let label = '';

    while (i < path.segments.length) {
      const nodeId = path.segments[i];
      if (!nodeId) break;
      const node = graph.nodes[nodeId];
      if (!node) break;

      if (node.type === 'loop') {
        label = `Editing Loop Body: ${node.name}`;
        graph = node.bodyGraph;
        i += 1;
        continue;
      }

      const nextI = i + 1;
      if (nextI >= path.segments.length) break;
      const subId = path.segments[nextI];
      if (!subId) break;

      if (node.type === 'switch') {
        const branch = node.branches.find((b) => b.id === subId);
        label = `Editing Switch Branch: ${branch?.label ?? subId}`;
        if (branch) graph = branch.graph;
        i = nextI + 1;
      } else if (node.type === 'fork') {
        const branch = node.branches.find((b) => b.id === subId);
        label = `Editing Fork Branch: ${branch?.label ?? subId}`;
        if (branch) graph = branch.graph;
        i = nextI + 1;
      } else if (node.type === 'try') {
        const section = subId === 'catchGraph' ? 'catch' : 'try';
        label = `Editing Try Section: ${section} (${node.name})`;
        graph =
          subId === 'catchGraph'
            ? (node.catchGraph ?? node.tryGraph)
            : node.tryGraph;
        i = nextI + 1;
      } else {
        break;
      }
    }

    return label;
  }

  const contextLabel = $derived(buildContextLabel(workflowFile, graphPath));

  // ---------------------------------------------------------------------------
  // Selected node (resolved from current graph)
  // ---------------------------------------------------------------------------

  const selectedNode = $derived<Node | null>(
    selectedNodeId && currentGraph
      ? (currentGraph.nodes[selectedNodeId] ?? null)
      : null,
  );

  // ---------------------------------------------------------------------------
  // Navigation helpers
  //
  // All navigation is performed via goto() so the URL stays in sync and
  // browser back/forward work correctly. The $effect above re-syncs local
  // state when data.selectedSegments changes after navigation.
  // ---------------------------------------------------------------------------

  // Navigate into a LoopNode's bodyGraph (single sub-graph).
  function navigateInto(nodeId: string): void {
    const newPath: GraphPath = {
      ...graphPath,
      segments: [...graphPath.segments, nodeId],
    };
    const hashSegs = graphPathToHashSegments(workflowFile, newPath);
    if (hashSegs.length === 0) return;
    graphPath = newPath;
    selectedNodeId = null;
    inspectorOpen = false;
    history.pushState(
      null,
      '',
      resolve(
        `/workflows/${data.workflowId}?selected=${hashSegs.join('/')}` as WfPath,
      ),
    );
  }

  // Navigate into a branch or named section of a SwitchNode, ForkNode, or TryNode.
  // For TryNode use branchId = 'tryGraph' or 'catchGraph'.
  function navigateIntoBranch(nodeId: string, branchId: string): void {
    const newPath: GraphPath = {
      ...graphPath,
      segments: [...graphPath.segments, nodeId, branchId],
    };
    const hashSegs = graphPathToHashSegments(workflowFile, newPath);
    if (hashSegs.length === 0) return;
    graphPath = newPath;
    selectedNodeId = null;
    inspectorOpen = false;
    history.pushState(
      null,
      '',
      resolve(
        `/workflows/${data.workflowId}?selected=${hashSegs.join('/')}` as WfPath,
      ),
    );
  }

  // Navigate up one level in the crumb trail.
  function navigateBack(): void {
    const { boundaries } = crumbInfo;
    if (boundaries.length <= 1) return;
    const targetBoundary = boundaries[boundaries.length - 2] ?? 0;
    const newPath: GraphPath = {
      ...graphPath,
      segments: graphPath.segments.slice(0, targetBoundary),
    };
    graphPath = newPath;
    selectedNodeId = null;
    inspectorOpen = false;
    if (newPath.segments.length === 0) {
      history.pushState(
        null,
        '',
        resolve(`/workflows/${data.workflowId}` as WfPath),
      );
    } else {
      const hashSegs = graphPathToHashSegments(workflowFile, newPath);
      history.pushState(
        null,
        '',
        resolve(
          `/workflows/${data.workflowId}?selected=${hashSegs.join('/')}` as WfPath,
        ),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  function handleWorkflowSelect(id: string): void {
    selectedWorkflowId = id;
    graphPath = { workflowId: id, segments: [] };
    selectedNodeId = null;
    inspectorOpen = false;
    history.pushState(
      null,
      '',
      resolve(`/workflows/${data.workflowId}` as WfPath),
    );
  }

  function uniqueWorkflowName(base: string): string {
    const existing = new Set(
      Object.values(workflowFile.workflows).map((wf) => wf.name),
    );
    if (!existing.has(base)) return base;
    let n = 2;
    while (existing.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  }

  function handleAddWorkflow(): void {
    workflowFile = addWorkflow(
      workflowFile,
      uniqueWorkflowName('new-workflow'),
    );
    markDirty();
    const newId = workflowFile.order[workflowFile.order.length - 1]!;
    selectedWorkflowId = newId;
    graphPath = { workflowId: newId, segments: [] };
    selectedNodeId = null;
    inspectorOpen = false;
    history.pushState(
      null,
      '',
      resolve(`/workflows/${data.workflowId}` as WfPath),
    );
  }

  function handleDeleteWorkflow(id: string): void {
    if (workflowFile.order.length <= 1) return; // guard: never remove the last one
    const wf = workflowFile.workflows[id];
    if (wf && referencedWorkflowNames(workflowFile).has(wf.name)) return; // guard: in use

    const wasSelected = selectedWorkflowId === id;
    const prevIndex = workflowFile.order.indexOf(id);

    workflowFile = removeWorkflow(workflowFile, id);
    markDirty();

    if (wasSelected) {
      // Pick the previous workflow in the list, or fall back to the first one.
      const nextId =
        workflowFile.order[Math.max(0, prevIndex - 1)] ??
        workflowFile.order[0]!;
      selectedWorkflowId = nextId;
      graphPath = { workflowId: nextId, segments: [] };
      selectedNodeId = null;
      inspectorOpen = false;
      history.pushState(
        null,
        '',
        resolve(`/workflows/${data.workflowId}` as WfPath),
      );
    }
  }

  function handleRenameWorkflow(id: string, newName: string): void {
    const wf = workflowFile.workflows[id];
    if (!wf || wf.name === newName) return;
    const oldName = wf.name;
    workflowFile = updateWorkflowName(workflowFile, id, newName);
    workflowFile = renameWorkflowReferences(workflowFile, oldName, newName);
    markDirty();
  }

  function handleNodeSelect(nodeId: string | null): void {
    if (!nodeId) {
      // Guard: if nothing is selected, there is nothing to deselect. Skip the
      // URL update so that a branch navigation that just set selectedNodeId =
      // null (synchronously) is not immediately overwritten by the async
      // onselectionchange deselect event from SvelteFlow.
      if (selectedNodeId === null) return;
      selectedNodeId = null;
      inspectorOpen = false;
      // Stay in the current sub-graph if we navigated into one; only return to
      // root when deselecting from the root graph.
      if (graphPath.segments.length === 0) {
        history.pushState(
          null,
          '',
          resolve(`/workflows/${data.workflowId}` as WfPath),
        );
      } else {
        const hashSegs = graphPathToHashSegments(workflowFile, graphPath);
        history.pushState(
          null,
          '',
          resolve(
            `/workflows/${data.workflowId}?selected=${hashSegs.join('/')}` as WfPath,
          ),
        );
      }
      return;
    }
    const node = currentGraph?.nodes[nodeId];
    if (!node) return;
    const zid = getNodeHashId(node);
    selectedNodeId = nodeId;
    inspectorOpen = true;
    history.pushState(
      null,
      '',
      resolve(
        `/workflows/${data.workflowId}?selected=${encodeURIComponent(zid)}` as WfPath,
      ),
    );
  }

  // Navigate to a crumb by its index. The Breadcrumb component passes the
  // array index; we map it to a segment count using boundaries.
  function handleNavigate(index: number): void {
    const boundary = crumbInfo.boundaries[index] ?? 0;
    const newPath: GraphPath = {
      ...graphPath,
      segments: graphPath.segments.slice(0, boundary),
    };
    graphPath = newPath;
    selectedNodeId = null;
    inspectorOpen = false;
    if (newPath.segments.length === 0) {
      history.pushState(
        null,
        '',
        resolve(`/workflows/${data.workflowId}` as WfPath),
      );
    } else {
      const hashSegs = graphPathToHashSegments(workflowFile, newPath);
      history.pushState(
        null,
        '',
        resolve(
          `/workflows/${data.workflowId}?selected=${hashSegs.join('/')}` as WfPath,
        ),
      );
    }
  }

  // Insert a new node into the currently active graph (Step 5 wiring).
  function handleInsert(nodeType: NodeType) {
    workflowFile = insertNodeAtPath(workflowFile, graphPath, nodeType);
    markDirty();
  }

  // Apply a pure FlowGraph transform at the current graphPath, threading the
  // result back up to produce a new WorkflowFile.
  function updateCurrentGraph(transform: (g: FlowGraph) => FlowGraph): void {
    try {
      workflowFile = updateGraphAtPath(workflowFile, graphPath, transform);
      markDirty();
    } catch (err) {
      console.error('updateCurrentGraph failed:', err);
    }
  }

  function handleDelete(): void {
    const id = selectedNodeId;
    if (!id) return;
    selectedNodeId = null;
    inspectorOpen = false;
    history.pushState(
      null,
      '',
      resolve(`/workflows/${data.workflowId}` as WfPath),
    );
    updateCurrentGraph((g) => removeNode(g, id));
  }

  const selectedNodeIndex = $derived(
    selectedNodeId && currentGraph
      ? currentGraph.order.indexOf(selectedNodeId)
      : -1,
  );
  const canMoveUp = $derived(selectedNodeIndex > 0);
  const canMoveDown = $derived(
    selectedNodeIndex >= 0 &&
      currentGraph !== null &&
      selectedNodeIndex < currentGraph.order.length - 1,
  );

  function handleMoveUp() {
    const id = selectedNodeId;
    if (!id || !canMoveUp) return;
    updateCurrentGraph((g) => moveNode(g, id, selectedNodeIndex - 1));
  }

  function handleMoveDown() {
    const id = selectedNodeId;
    if (!id || !canMoveDown) return;
    updateCurrentGraph((g) => moveNode(g, id, selectedNodeIndex + 1));
  }

  // ---------------------------------------------------------------------------
  // Navigation callbacks (forwarded from Inspector)
  // ---------------------------------------------------------------------------

  function handleEnterNode(nodeId: string) {
    navigateInto(nodeId);
  }

  function handleEnterBranch(nodeId: string, branchId: string) {
    navigateIntoBranch(nodeId, branchId);
  }

  // ---------------------------------------------------------------------------
  // Branch management callbacks (forwarded from Inspector)
  // ---------------------------------------------------------------------------

  function resolveNode(nodeId: string): Node | null {
    return currentGraph?.nodes[nodeId] ?? null;
  }

  function handleAddBranch(nodeId: string) {
    const node = resolveNode(nodeId);
    if (!node) return;
    if (node.type === 'switch') {
      updateCurrentGraph((g) =>
        replaceNode(g, addSwitchBranch(node, 'new-branch')),
      );
    } else if (node.type === 'fork') {
      updateCurrentGraph((g) =>
        replaceNode(g, addForkBranch(node, 'new-branch')),
      );
    }
  }

  function handleRemoveBranch(nodeId: string, branchId: string) {
    const node = resolveNode(nodeId);
    if (!node) return;
    if (node.type === 'switch') {
      updateCurrentGraph((g) =>
        replaceNode(g, removeSwitchBranch(node, branchId)),
      );
    } else if (node.type === 'fork') {
      updateCurrentGraph((g) =>
        replaceNode(g, removeForkBranch(node, branchId)),
      );
    }
  }

  // Add a catchGraph to a TryNode and navigate into it immediately.
  // Replace a node in the current graph with an updated version emitted by
  // an Inspector editor. Uses replaceNode to minimise the diff.
  function handleNodeUpdate(updatedNode: Node): void {
    updateCurrentGraph((g) => replaceNode(g, updatedNode));
  }

  function handleAddCatch(nodeId: string) {
    const node = resolveNode(nodeId);
    if (!node || node.type !== 'try' || node.catchGraph !== undefined) return;
    updateCurrentGraph((g) =>
      replaceNode(g, updateTrySection(node, 'catchGraph', emptyFlowGraph())),
    );
    navigateIntoBranch(nodeId, 'catchGraph');
  }

  // Sync state when the browser navigates back/forward through pushState entries.
  // pushState does not re-run load(), so $page.data won't update — we read the
  // URL directly from window.location and parse it here instead.
  onMount(() => {
    function handlePopstate() {
      const url = new URL(window.location.href);
      const selected = url.searchParams.get('selected');
      const segs = selected ? selected.split('/').filter(Boolean) : [];
      const parsed = parseSelectedSegments(
        workflowFile,
        _initialWorkflowId,
        segs,
      );
      graphPath = parsed.graphPath;
      selectedNodeId = parsed.selectedNodeId;
      inspectorOpen = parsed.selectedNodeId !== null;
    }
    window.addEventListener('popstate', handlePopstate);

    function handleKeydown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (saveStatus === 'dirty' || saveStatus === 'error') {
          handleSave();
        }
      }
    }
    window.addEventListener('keydown', handleKeydown);

    return () => {
      window.removeEventListener('popstate', handlePopstate);
      window.removeEventListener('keydown', handleKeydown);
    };
  });

  // Expose navigation helpers so child components can invoke them in future.
  // Currently unused in the template; defined here so the API is established.
  export { navigateInto, navigateIntoBranch, navigateBack };

  // ---------------------------------------------------------------------------
  // YAML export
  // ---------------------------------------------------------------------------

  let exportOutput = $state<string>('');
  let exportError = $state<string>('');
  let showExport = $state(false);

  function handleExport() {
    const result = exportToYaml(workflowFile);
    if (result.ok) {
      exportOutput = result.yaml;
      exportError = '';
    } else {
      exportOutput = '';
      exportError = result.errors.join('\n');
    }
    showExport = true;
  }
</script>

<div class="editor-root">
  <!-- Sidebar: document + workflow list -->
  <Sidebar
    file={workflowFile}
    {selectedWorkflowId}
    onworkflowselect={handleWorkflowSelect}
    onaddworkflow={handleAddWorkflow}
    onworkflowdelete={handleDeleteWorkflow}
    onworkflowrename={handleRenameWorkflow}
  />

  <!-- Main area: breadcrumb + context indicator + canvas + inspector -->
  <div class="editor-main">
    <div class="editor-topbar">
      <Breadcrumb crumbs={breadcrumbs} onnavigate={handleNavigate} />
      <div class="topbar-actions">
        <span class="save-status" data-testid="save-status">
          {#if saveStatus === 'saving'}
            {t('editor.saving')}
          {:else if saveStatus === 'saved'}
            {t('editor.saved')}
          {:else if saveStatus === 'dirty'}
            {t('editor.unsaved')}
          {:else if saveStatus === 'error'}
            <span title={lastSaveError}>{t('editor.saveFailed')}</span>
          {/if}
        </span>
        {#if saveStatus === 'error'}
          <button class="save-btn" onclick={handleSave} type="button">
            {t('editor.save')}
          </button>
        {/if}
        <button class="export-btn" onclick={handleExport} type="button">
          {t('editor.exportYaml')}
        </button>
      </div>
    </div>

    <ContextIndicator label={contextLabel} />

    <div class="editor-canvas-area">
      {#if currentGraph !== null}
        <Canvas
          graph={currentGraph}
          {selectedNodeId}
          onnodeselect={handleNodeSelect}
          oninsert={handleInsert}
          onenternode={handleEnterNode}
          onenterbranch={handleEnterBranch}
        />
      {:else}
        <div class="canvas-placeholder">{t('editor.noGraph')}</div>
      {/if}

      <Inspector
        node={inspectorOpen ? selectedNode : null}
        {canMoveUp}
        {canMoveDown}
        onmoveup={handleMoveUp}
        onmovedown={handleMoveDown}
        ondelete={handleDelete}
        onupdate={handleNodeUpdate}
        onenternode={handleEnterNode}
        onenterbranch={handleEnterBranch}
        onaddbranch={handleAddBranch}
        onremovebranch={handleRemoveBranch}
        onaddcatch={handleAddCatch}
      />
    </div>
  </div>
</div>

<!-- YAML export overlay -->
{#if showExport}
  <div
    class="export-overlay"
    role="dialog"
    aria-modal="true"
    aria-label={t('editor.exportDialog')}
  >
    <div class="export-dialog">
      <div class="export-dialog-header">
        <h2>{t('export.title')}</h2>
        <button
          class="export-close-btn"
          onclick={() => {
            showExport = false;
          }}
          type="button"
          aria-label={t('export.close')}>✕</button
        >
      </div>
      {#if exportError}
        <pre class="export-error">{exportError}</pre>
      {:else}
        <pre class="export-code">{exportOutput}</pre>
      {/if}
    </div>
  </div>
{/if}

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
    padding-right: 1rem;
  }

  .topbar-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .save-status {
    font-size: 0.75rem;
    color: #888;
    white-space: nowrap;
  }

  .save-btn {
    padding: 0.3rem 0.75rem;
    background: #fff;
    color: #333;
    border: 1px solid #ccc;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
  }

  .save-btn:hover:not(:disabled) {
    background: #f5f5f5;
    border-color: #aaa;
  }

  .save-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .export-btn {
    padding: 0.3rem 0.75rem;
    background: #1a56cc;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
  }

  .export-btn:hover {
    background: #1344a8;
  }

  .editor-canvas-area {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .canvas-placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #888;
    font-size: 0.9rem;
  }

  /* Export overlay */
  .export-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .export-dialog {
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    width: min(720px, 90vw);
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .export-dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #eee;
  }

  .export-dialog-header h2 {
    margin: 0;
    font-size: 1rem;
  }

  .export-close-btn {
    background: none;
    border: none;
    font-size: 1rem;
    cursor: pointer;
    color: #666;
    padding: 0.25rem;
    line-height: 1;
  }

  .export-code,
  .export-error {
    flex: 1;
    margin: 0;
    padding: 1rem 1.25rem;
    overflow-y: auto;
    font-size: 0.8rem;
    white-space: pre-wrap;
    font-family: 'Courier New', monospace;
  }

  .export-error {
    color: #c0392b;
    background: #fff5f5;
  }
</style>
