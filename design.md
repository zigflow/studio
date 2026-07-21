# Zigflow Studio — Design Doc

Zigflow Studio — a drag-and-drop editor for [Zigflow](https://zigflow.dev)
workflows.

> **Naming.** The product is called **Zigflow Studio**. Refer to it as
> "Zigflow Studio" or "Studio" throughout the UI and docs — never "Zigflow
> Editor" or "the editor". (Some prose below still says "the editor" as a
> common noun; treat "Zigflow Studio"/"Studio" as the canonical name going
> forward.)

- **Stack:** SvelteKit (`adapter-node`), TypeScript,
  [SvelteFlow](https://svelteflow.dev) (`@xyflow/svelte`)
- **Source of truth:** the generated Zigflow YAML. The graph is a
  *view* of it, never an independent model.
- **Scope of this doc:** the PoC. Sections marked **(future)** are
  decided in shape but explicitly not built yet.

This document exists so that decisions made once don't need to be re-derived
in every session or every tool (chat, Claude Code, a new contributor). Where
a decision has a rationale that isn't obvious, the rationale is included —
future-you (or future-Claude) should be able to tell *why*, not just *what*.

---

## 1. What Zigflow is, and why that shapes the editor

Zigflow is a declarative DSL that compiles YAML into Temporal workflows. It's
a deliberate subset of the **Open Workflow Specification (OWS)** — formerly
"Serverless Workflow," renamed as of mid-2026; use "Open Workflow
Specification" in written docs, either name is fine in conversation.

Canonical references:
- Schema: `https://zigflow.dev/schema.yaml` /
  `https://zigflow.dev/schema.json` (pinned versions under
  `/schemas/<version>/`)
- AI-friendly reference: `https://zigflow.dev/llms.txt`
- MCP server (read-only, useful for validation during development): `https://mcp.zigflow.dev`

### 1.1 The critical structural fact: this is a tree, not a graph

A workflow is:

```yaml
document: { dsl, taskQueue, workflowType, version, ... }
do: [ { stepName: { <one of 11 task types> } }, ... ]
```

`do` is **positional** — array order is execution order, not free-form
edges. Of the 11 task types (`call`, `do`, `for`, `fork`, `listen`, `raise`,
`run`, `set`, `switch`, `try`, `wait`):

- `do`, `for`, `fork`, `try` **nest child task lists inline** (`do.do`,
  `for.do`, `fork.branches`, `try.try` / `try.catch.do`). These are
  genuinely tree-shaped and get a "drill into sub-canvas" UI, matching
  Zigflow's own editor (breadcrumb: `Order Processing › Switch › Electronic
  Branch`).
- `switch` **does not nest anything.** Each case is `{ when, then }` — no
  nested `do`. `then` is a flow directive: `continue` (default), `exit`,
  `end`, or **the name of another task in the same scope** (a goto). The
  branches you *see* in Zigflow's UI under a Switch are ordinary sibling
  tasks elsewhere in the same list, reached via jump — not children of the
  Switch node.
- Any task's `then` can do this same goto, not just Switch's. In practice
  the editor only exposes authoring a goto for Switch (its whole purpose is
  branching), but must **preserve** an arbitrary `then: taskName` on any
  other task if one is present in loaded YAML, even without a dedicated
  editor for it.

**Consequence:** the editor does not treat SvelteFlow as a general graph
tool with a "compile graph → tree" step. That direction is lossy and hard to
keep valid. Instead:

- The canonical model is one in-memory `ZigflowWorkflow` tree.
- SvelteFlow renders a **projection** of whichever single scope (root, or
  inside a Fork/For/Try) the user has drilled into — see §3.
- Edits (add/remove/rename/reorder task) are **direct mutations of the
  tree** at a resolved scope path. There is no separate graph representation
  to reconcile.
- Switch is rendered as an annotation (`then: taskName` in its inspector,
  optionally a dashed "goto" edge overlay for visualization), not a
  container with branches inside it.

### 1.2 Always multi-workflow

Zigflow's `do` task supports two root-level shapes: a single implicit
workflow (`document.workflowType` names it), or multiple named workflows
(`do: [{ workflow1: { do: [...] } }, { workflow2: { do: [...] } }]`, where
`document.workflowType` is ignored and each name is unique in scope).

**Decision: the editor always uses the multi-workflow shape**, even for a
single workflow — `do: [{ myWorkflow: { do: [...] } }]` is valid and
functionally identical to the single-workflow form. This removes an entire
mode/branch from the editor: there's no "does every top-level task happen to
be bare `do`" ambiguity to detect or guard against, and no separate
single-vs-multi UI path.

**Sync rule:** `document.workflowType` is derived, not user-edited. On every
save, set it to the name of the **first** entry in the root `do` list. If the
user renames the first workflow, or reorders so a different one is first,
`workflowType` follows. Renaming a workflow that isn't first has no effect on
`workflowType`.

No special handling for an empty project (`do: []`, or `do: [{ w: [] }]`) —
these are valid workflows that just don't do anything yet. Do not add
defensive UI to prevent or warn about this; per project philosophy (§7),
avoid getting in the user's way for cases the schema itself allows.

---

## 2. Data model

### 2.1 Types

`src/lib/types/zigflow.ts` defines `ZigflowWorkflow`, `ZigflowDocumentMeta`,
`Task` (a union of the 11 task-kind interfaces), `TaskList`, `NamedTask`
(`{ [name: string]: Task }`), and shared building blocks (`Duration`,
`RuntimeExpression`, `FlowDirective`, `Schema`).

These mirror the OWS spec almost exactly. **In an environment with package
registry access, generate/import these from
`@open-workflow-specification/sdk-typescript`** rather than hand-maintain
them — they were hand-written only where that wasn't available. Nothing in
the graph/mutation/store layers should depend on *how* the types are
produced, only on their shape, so swapping the source is a types-only
change.

### 2.2 Zigflow vs. OWS: the one divergence

Per `zigflow/zigflow` PR #340 (`[BREAKING]: replace name and namespace with
taskQueue and workflowType`), Zigflow's `document` renames OWS's fields:

| OWS | Zigflow |
| --- | --- |
| `namespace` | `taskQueue` |
| `name` | `workflowType` |

Nothing else — not the task tree, not any other document field — diverges.
`src/lib/mapper/document.ts` provides `toOwsDocument()` / `fromOwsDocument()`,
a pure bidirectional rename, used only at boundaries where OWS-shaped tooling
is needed. **The app's internal model, storage format, and API always use
Zigflow's field names** — the mapper is not on the hot path.

### 2.3 Node identity: `__zigflow_id`

Zigflow's schema already reserves `metadata.__zigflow_id` on every task
("system-generated... should not be modified by users") — the editor uses
this directly rather than inventing its own convention. It's how a task's
identity survives rename/reorder/reload across an editing session.

`ensureTaskIds(workflow)` walks the whole tree once and assigns an id to any
task missing one. Call it:
- Once, right after a workflow is loaded from disk (covers hand-authored or
  third-party YAML with no ids).
- Once, right after any tree mutation that introduces new tasks with
  pre-seeded children (e.g. a new Try/Catch node's placeholder steps — see
  §4.4) so a freshly added container can be drilled into immediately.

---

## 3. Graph ↔ tree projection

`src/lib/graph/`:

- **`model.ts`** — `FlowNode` / `FlowEdge` / `FlowGraph` types; a `ScopePath`
  (array of `{ taskId, label, field }` steps) locating which TaskList is
  currently on screen. Empty path = the workflow root `do` list.
- **`scope.ts`** — `resolveScope(workflow, path)` walks a `ScopePath` from
  the root and returns the target `TaskList` plus a setter closure. Also
  `siblingNames()` (for Switch `then` dropdowns) and `findById()`.
  A step's `field` is load-bearing specifically for `try`, which owns two
  child lists (`try` and `catch.do`) that `taskId` alone cannot tell apart;
  for `do`/`for`/`fork` there is a single child list, so `field` is
  redundant but harmless.
- **`treeToGraph.ts`** — pure projection: one scope's `TaskList` → SvelteFlow
  nodes + edges. Three layouts:
  - **`sequential`** (`do`/`for`/`try` bodies): vertical stack,
    array-order position, solid edges between consecutive nodes. A `for`
    body is entered with `field: 'do'`, the same as a plain `do` — a `for`
    task carries both `for` (config) and `do` (body), and only the `do`
    list is a drill-in scope. Task classification therefore checks `for`
    before `do`, so a loop is not misread as a plain `do`.
  - **`parallel`** (`fork.branches`): horizontal lanes, no edges between
    them (they run concurrently, not in sequence).
  - **`independent`** (the **root** scope, empty `ScopePath`): vertical stack
    of unconnected cards — **no edges and no connection handles**. Top-level
    workflows are independent (§1.2): array order only feeds the `workflowType`
    sync rule, never execution order, so any edge or connector dot between them
    would wrongly imply a pipeline. Handles are suppressed via a `showHandles`
    flag on the node data (false only for this layout). `goto` edges can't
    arise here anyway — Switch can't appear at root under the
    root-restricted-to-`do` rule (§6).
  - Plus **derived, informational `goto` edges** for Switch cases whose
    `then` names a sibling task — dashed, never written back to the tree
    (`sequential`/`parallel` only; never at root). These are derived for Switch
    cases only. §1.1 notes any task's `then` can be a goto; such a `then` is
    preserved verbatim in the tree (it stays authoritative), but only Switch's
    is drawn as an edge — a non-Switch goto has no visual.
- **`mutations.ts`** — the only functions that change the tree:
  `renameTask`, `updateTaskBody`, `addTask`, `removeTask`, `moveTask`,
  `ensureTaskIds`, `syncWorkflowType`. All operate on a resolved
  `TaskList` reference from `resolveScope`.
  These are pure array/object operations, so they re-render the canvas only
  when applied to a *reactive* tree: the editor holds the loaded workflow as
  reactive state (Svelte 5 `$state`) at the page/store level, not as a plain
  loaded value. Reactivity is a property of *where* a mutation is applied
  (the reactive proxy) — the functions themselves are unchanged and stay
  plain, testable tree operations.
- **`defaults.ts`** — a minimal, **schema-valid** starting body for each task
  kind, used when a node is added from the palette. Note: `try`/`catch` need
  a seeded placeholder step in both `try` and `catch.do` (unlike `do`/`for`,
  which allow an empty list) because the schema requires `minItems: 1` there
  — an empty Try node would fail validation the instant it's created.

**Reordering is explicit** (move up/down controls on each node), not free XY
dragging — node position is auto-laid-out from array order and has no
independent meaning, so there's nothing for free dragging to *mean*. This
matches Zigflow's own UI, which shows a fixed vertical chain with a
"+ Add Node" affordance rather than a freeform canvas.

---

## 4. Validation

**Single source of truth:** `src/lib/schema/validate.ts` compiles the
bundled `zigflow.schema.yaml` with Ajv (2020-12 dialect) and exports
`validateWorkflow(doc)`. This is the **only** validation path in the app —
called from the save API route, and available to any client-side pre-check
that wants it. There is deliberately no separate, hand-maintained set of
"UI validation rules" to keep in sync with the schema.

The bundled schema is always sourced from the Zigflow CLI (`zigflow schema
-o yaml`, via the `update-schema` script), never from the public website,
and with no fallback. The CLI is the final authority on what a workflow must
satisfy; bundling from any other source risks drift between "whatever the
editor validates against" and "whatever the CLI/runtime actually enforces",
which is precisely what this single-source rule exists to prevent. If the
CLI is unavailable, `update-schema` fails loudly rather than refreshing from
a second source — the devcontainer and GitHub Action install the CLI. Note
this covers pure JSON-Schema-expressible rules only —
jq expression syntax, determinism rules (`uuid`/`timestamp`/`now` only valid
inside `set`), and task-name-uniqueness-within-scope are additional Zigflow
CLI (`zigflow validate`) checks not expressible as JSON Schema, and are out
of scope for this editor's validation layer. The CLI remains the final
authority before a workflow actually runs.

One narrow exception is enforced at the *mutation* layer rather than here:
`renameTask` and `addTask` (§3) reject a name that already exists in the
exact `TaskList` being written to. It isn't schema-expressible, but the
editor's own resolution logic (`resolveScope`/`findById`/`siblingNames`, §3)
looks tasks up by name within a scope, so a duplicate name in one scope
actively breaks that logic — unlike the sparse-but-valid states §7 leaves
alone. The guard is deliberately narrow (exact name, exact list); all
broader uniqueness and semantic checks still defer to `zigflow validate`.

---

## 5. Storage & persistence

### 5.1 PoC: plain `fs`

`src/lib/server/workflowStore.ts` defines a `WorkflowStore` interface
(`list`, `load`, `save`, `remove`, `exists`); `FsWorkflowStore` is the only
implementation, reading/writing `<ZIGFLOW_STORAGE_DIR>/<project>/workflow.yaml`.
Persistence is entirely the operator's concern (e.g. a Kubernetes PVC behind
that env var) — the app has no opinion about it beyond the interface. This
is the seam a future S3-backed store, or a store that also triggers a Git
push on publish, plugs into without touching API routes.

### 5.2 YAML parsing

`src/lib/yaml/serialize.ts` uses **`yaml` (eemeli/yaml)**, not `js-yaml` —
chosen specifically because `yaml` also exposes a `Document`/CST API that
preserves comments, key order, and formatting. Today this module does plain
parse-to-object / stringify-from-object (no more capable than `js-yaml`
would be), but if lossless round-tripping becomes a requirement, upgrading
is a one-file change rather than a library swap.

### 5.3 History **(future)**

Not built in the PoC. Agreed shape for when it is: one sibling file per
project, `map[isoTimestamp]: workflow` (a plain object keyed by ISO 8601
timestamp string, value = the full workflow at that point). ISO 8601 keys
sort correctly as plain strings, so no separate ordering field or timestamp
parsing is needed to list history chronologically. `save()` is the seam this
hangs off. Retention/pruning policy is undecided and doesn't need to be
until this is actually built.

### 5.4 Publish / GitOps **(future)**

Not built in the PoC — "Save" only ever writes to disk; it does not touch
`document.version` (that's a Publish-time concern only). When built:
Publish pushes to a Git repo/branch configured via app config (a config
file, populated by the platform's Kubernetes setup — not env vars, per
current preference), gated behind a commit-message dialog. GitOps is
expected to be the primary strategy, possibly the only one, though the
`WorkflowStore`-style seam should allow a future S3 (or similar)
alternative.

### 5.5 Testing a workflow **(future)**

Not built in the PoC. When a "Test" button exists, its production execution
path dispatches each run to a **separate container** (e.g. a Kubernetes Job),
never the app's own server process. Arbitrary, user-submitted workflow
execution must stay isolated from the serving container.

The `zigflow` CLI binary present in the production Docker image is a
convenience for non-Kubernetes deployments and manual debugging — it is
**not** the Test feature's actual execution path. Nobody reading the
Dockerfile later should assume the serving container runs user workflows
in-process.

### 5.6 Explicitly out of scope

No auth, no multi-user conflict detection, no locking. Last write wins.
This is intentional — a platform team's own auth layer (e.g. Dex) sits in
front of this app; it doesn't belong here unless/until there are paying
customers who need it.

---

## 6. UI structure

- **Project list** (`/workflows`) — list existing workflows, create a new one.
`/` redirects here.
- **Display naming — one rule, to stop the project-name mixup.** What a human
  is shown as a "name" is *never* the on-disk project/directory name; that is a
  storage/routing identifier, not a display name.
  - A **workflow project's** display name is `document.title` if present,
    otherwise `document.workflowType` (both live on `ZigflowDocumentMeta`).
    Never the on-disk directory name. That directory name does still govern
    URLs (`/workflows/[name]/...`), so it may still need to appear *somewhere*
    (e.g. a subtitle or secondary detail), just never as the primary displayed
    name. `GET /api/workflows` returns this resolved as `{ name, displayName }`
    per workflow (routing name + display name); the project list renders
    `displayName` as the link text and shows `name` as a muted caption only when
    the two differ. The **editor header** (and the browser tab `<title>`)
    follows the same rule — it shows the resolved display name, not `data.name`;
    the routing/directory name is surfaced as a "Directory" row in the
    read-only details sidebar (its acceptable secondary-detail home).
  - An **individual task** in any `do` list — including a top-level workflow,
    which is itself just a task under the root `do` (§1.2) — is always referred
    to by its own name: the string key of its `{ [name]: Task }` entry (§2.1),
    never any other property. This is already how the breadcrumb and canvas
    label tasks; it is stated here as the general rule so future work doesn't
    reintroduce the project-name mixup.
- **Editor** (`/workflows/[name]/[...scope]`) — three-pane layout:
  - Left: two stacked sections. **Top (primary, most of the height): a node
    palette** — the single list of which kinds can be added in the current
    scope. Each kind is one chip that is **both clickable** (appends a node of
    that kind to the *end* of the current scope — the discoverable,
    keyboard-accessible path) **and draggable** onto the canvas (same append; a
    mouse accelerator). There is deliberately no separate dropdown/"Add" control
    — the chips are the one place kinds are listed. **At the root scope the
    palette offers only `do`** (empty `ScopePath` ⇒ every root entry must be a
    `do`-kind workflow, §1.2); deeper scopes offer all of `TASK_KINDS`. The
    heading/hint are scope-aware ("Add a workflow" at root vs "Add a node"
    deeper). **Below (demoted, smaller): the "Workflow Details" panel**, now
    partly editable — see the document-field rule below.
  - Center: the canvas — breadcrumb (scope path) + SvelteFlow view of the
    current scope + "+ Add Node" control. **Dropping a palette chip anywhere on
    the canvas always appends to the end of the current scope's list** — the
    drop position is never read, so this introduces no free XY placement and
    array order stays the only ordering (§3); reordering is the inspector's
    move-up/move-down controls. **At the root scope the canvas draws the
    top-level workflow cards with no edges and no connection handles between
    them** — they are independent (§1.2), so array order is meaningful only for
    the `workflowType` derivation, never for implying sequential execution; the
    connecting line + connector dots appear only at non-root scopes (a `do`/
    `for`/`try` body). The breadcrumb's root segment is a
    generic, translated "Workflow" label (not the project name — that already
    sits in the header, and the root scope's label is a distinct identifier
    from the project name); every later segment is the actual scope-path task
    name and is clickable to navigate back to that level (the second-to-last
    segment is always the immediate parent scope).
  - Right: inspector for the selected task (or workflow-level document
    metadata when nothing's selected). Workflow-global save/validation
    errors are *not* shown here — they render as a banner below the header
    (see **Save & dirty state** below).
- **Document-field editability** (the "Workflow Details" panel). Edits write
  directly into the same reactive `workflow` object task edits use, so they ride
  the existing dirty/`save()` plumbing with nothing new added. Per field:
  - `taskQueue` — **editable** (required by the schema).
  - `title`, `summary` — **editable, optional**: clearing the input removes the
    property entirely rather than storing `""` (same convention as the
    inspector's optional fields, `writeForTask` in `inspectorForms.ts`).
  - `tags` — editable per schema but a key/value map; a dedicated editor is
    **deferred as a follow-up**, not wired here yet. (Its values are `unknown`,
    not just strings, so the Set task's string key/value form can't be reused
    verbatim without risking lossy coercion — it needs its own typed editor.)
  - `version` — **read-only** for now; only ever set at Publish time (§5.4, not
    built), so no editor until then.
  - `dsl` — **never** user-editable.
  - `workflowType` — **derived**, never hand-edited (§1.2). Surfaced as a
    **read-only "Workflow Type" row** in the panel (alongside Directory/Version/
    DSL) with a muted note that it's auto-derived from the *first* top-level
    workflow's name and any direct edit is overwritten on save. It is edited
    only indirectly, by renaming the first root workflow (see the Inspector
    relabel below).
  - Directory (the routing/filesystem name) is **not a document field at all**
    and stays permanently read-only.
  - **Rendering caveat:** the panel (`WorkflowDetails.svelte`) is rendered
    **client-only** (`{#if browser}` *inside* the component, like
    `Canvas.svelte`). SSR-hydrated inputs on this page do not get their
    `oninput` handlers wired — a latent hydration issue that also affects the
    inspector when it is server-rendered via a `?selected=` deep link (it
    normally dodges this because it is created client-side on click); the
    palette, though SSR'd, is unaffected. Keeping the gate inside the component
    (not around it in the page) avoids disturbing sibling hydration (the
    palette). Root cause is unresolved and worth a dedicated look — see the
    build note.
- **Scope lives in the URL** (`[...scope]`, one rest-param route — a zero-
  segment match is the root, so it also covers `/workflows/[name]`). This is
  what makes refresh, back/forward, and shared links open the drilled-into
  scope instead of always the root. The scheme:
  - Each segment is a task **name** (unique within its scope per the §4
    mutation-layer guard). For `do`/`for`/`fork` the name alone suffices — the
    child list is implied by the task's kind (`do`/`for` → `do`, `fork` →
    `branches`). A `try` owns two child lists, so its name segment is followed
    by a literal `try` or `catch` selector, e.g. a URL ending
    `…/orderProcessing/fulfilOrder/try` (or `…/fulfilOrder/catch`).
    (`try`/`catch` are therefore reserved: a task named exactly `try`/`catch`
    can't be a scope segment — a fine trade for the readable grammar.)
  - `scope.ts` provides the pure `scopePathToUrlSegments` / `resolveUrlSegments`
    inverse pair. The route's `load` resolves the URL to a `ScopePath` for
    first-paint (no root-then-jump flash); the page then re-resolves the same
    segments against its *live* (possibly-edited) workflow, so drilling into a
    just-added, unsaved container still works. Drill-in and breadcrumb navigate
    via `goto()`; a rename of a task in the open path rewrites the URL with
    `replaceState` (one edit, not a navigation).
  - **Names, not ids, in the URL** — deliberately, for readable and shareable
    links. The trade-off: a rename breaks any previously shared deep link into
    that task (names aren't stable identity — `__zigflow_id` is, but ids are
    kept out of the URL for readability). A stale or malformed link falls back
    to the root scope with a brief notice rather than 404-ing the whole page.
  - **Selection rides in a `?selected=<taskName>` query param** on the same
    route (name-based, same rename-invalidates-old-links trade-off as scope
    segments), resolved against the current scope's list. It's a query, not a
    path segment — selection is "which item in the current scope is focused,"
    not a different view — and not a hash fragment: a hash never reaches the
    server, so it couldn't drive the SSR first paint and would reintroduce the
    flash-of-no-selection the scope fix removed. Selecting/deselecting/renaming
    update it via `replaceState`, not `goto`/pushState, so browser history
    records scope changes only, not every click; changing scope drops it. A
    stale or absent name is silently "nothing selected" (a valid state) — no
    notice, unlike a bad scope segment.
- **Node component** (`TaskNode.svelte`) — a card per task: icon/kind
  glyph, name, one-line subtitle (method+endpoint for `call`, duration for
  `wait`, etc.). The card is **informational**: **single-clicking it selects
  the task** (showing it in the inspector). All per-task actions —
  move-up/move-down/delete, and drill-in for containers — live in the
  inspector (see below), shown only for the selected task, so the canvas stays
  clutter-free. Drilling into a container's sub-canvas (`do`/`for`/`fork`/`try`)
  is an explicit inspector button, never the *single* card click: a single
  click cannot disambiguate select from drill, and `try` in particular exposes
  *two* drill targets — its `try` body and its `catch` handler — that need
  distinct buttons.
  - **Double-click as a drill accelerator.** Container nodes
    (`do`/`for`/`fork`/`try`) also support **double-click** as a shortcut for
    the inspector's Open action — it opens the same sub-canvas the Open
    button does. The explicit inspector button(s) remain the
    discoverable/accessible primary path; double-click is a mouse-only
    accelerator layered on top. For `try`, double-click deliberately opens the
    **`try` body** (not `catch`) — `catch` stays reachable only via its own
    inspector button. Non-container kinds have nothing to drill into, so
    double-click just re-selects them. It is detected in the canvas via
    SvelteFlow's own node-click event (`event.detail === 2`), *not* a DOM
    handler on the card: SvelteFlow/d3-zoom stop `dblclick` propagation before
    it reaches Svelte's delegated listener root, and selecting on the first
    click must not rebuild the node (which recreated the card mid-gesture and
    swallowed the second click) — so selection rides a context-driven CSS class
    instead of the `nodes` array. A node double-click does not zoom the pane
    (SvelteFlow only zooms on background double-clicks); the empty-pane
    double-click-to-zoom is unchanged.
- **Selection is UI-only state**, held in the editor layer and never part of
  the workflow tree (per the UI/domain split in §"Editor architecture" of
  `AGENTS.md`). It is cleared whenever the visible scope changes — drilling
  into a container, or navigating via the breadcrumb — because a selection
  pointing at a node that's no longer on screen is worse than no selection.
- **Save & dirty state.** Save PUTs the in-memory workflow to
  `PUT /api/workflows/[name]`, the single validation gate (§4), triggered by
  a Save button or **Cmd/Ctrl+S**. (On-disk save only; Publish/GitOps stays
  future — §5.4.)
  - **Dirty state is a snapshot comparison** — serialized current workflow
    `!==` serialized last-saved workflow — not a flag toggled by each
    mutation. This is more robust: an edit followed by an undo back to the
    saved state correctly reads as clean, and no future mutation entry point
    can forget to set a flag. A successful save adopts the server-returned
    (id-filled, `workflowType`-synced) workflow as the new saved snapshot, so
    client and disk don't drift.
  - **Save/validation errors render as a full-width banner below the header,
    not in the inspector pane.** They are workflow-global — a list of schema
    error paths that may span several tasks — so the inspector, which is
    about the one *selected* task, is the wrong home for them. Each error
    shows its raw JSON-pointer path and message plus a derived "in {task}"
    hint naming the enclosing task. A failed *request* (network/server) gets
    its own distinct message, never conflated with "the workflow is invalid".
  - **The "in {task}" hint is bounded by how Ajv reports against this
    schema.** The task union uses `oneOf` + `unevaluatedProperties`, so an
    invalid nested task typically surfaces as errors at the *enclosing
    container* boundary (e.g. a bad `wait` reported on `/do/0/orderProcessing`
    rather than `.../waitForPayment/wait`). The hint therefore names the
    nearest task the path resolves to, which may be a container, not the
    deepest offending field. That granularity is why the PoC shows a flat
    list of paths + hints rather than click-to-navigate-to-the-exact-field —
    the schema's own error reporting wouldn't reliably support the latter.
    Revisit only if precise error localization becomes a priority.
- **Inspector forms** — dedicated forms exist for `call`/http, `set` (the
  object / key-value form), `wait`, `switch` (case list with `when`/`then`),
  and `for`. `fork`/`try` show a pointer to their sub-canvas rather than an
  inline branch/step editor. A `set` given as a single expression string
  (the less common form) falls back to the generic JSON editor rather than
  getting its own form — proportionate to how rarely that form is used, not
  a gap to close by default. `raise`/`listen`/`run`/other `call` sub-types
  likewise fall back to a JSON textarea for now — the pattern for adding a
  dedicated form is established and should be extended over time. Switch
  `then` authoring is scoped to `continue`/`exit`/`end` plus same-scope
  sibling task names (via `siblingNames()`). Loaded YAML may contain a
  `then` naming a task in a *different* scope (a cross-scope goto); that
  value is preserved on load and save but is not editable through the
  dropdown — editing such a field would coerce it to an in-scope option.
  A documented limitation, revisited only if cross-scope gotos prove common
  in practice.
  - **Root-scope workflow relabel.** For a `do` task at the **root** scope (a
    top-level workflow entry — reusing the same `atRoot` detection the palette's
    root restriction uses, §6/§1.2), the rename field is labelled **"Workflow
    Type"** instead of "Name", with a note that it sets *this* workflow's own
    type. It stays fully editable via the same `renameTask` call — only the
    label/copy change. This uses a **dedicated** message key
    `inspector_workflow_type_label` (never `inspector_name_label`), deliberately
    marking that a root workflow's name *is* its Temporal workflow type, not a
    cosmetic label swap. It differs from the read-only Workflow Type row in
    Workflow Details: that row only ever mirrors the *first* workflow (§1.2), so
    renaming a second/third root workflow here doesn't change that document
    field.
  - **Common `TaskBase` fields** (`CommonFieldsForm.svelte`, a collapsed
    "Advanced" section shown for *every* kind, below the kind-specific form).
    Every task extends `taskBase`, so these are shared: `if` (a runtime-
    expression guard); `input.schema`, `output` (`as` + `schema`), `export`
    (`as` + `schema`); and `metadata` (a `heartbeat` `Duration` reusing `wait`'s
    duration inputs — integer-only per the schema — plus a generic plaintext
    key/value list for other entries). Conventions reused, not reinvented:
    optional fields are removed when cleared (like Title/Summary); `as` uses the
    same string-vs-object parse as `set` values (`parseSetValue`); each `schema`
    is an arbitrary embedded JSON-Schema doc edited as a **JSON textarea**
    (invalid JSON shows an inline error and keeps the last valid value). The
    metadata key/value list **never** exposes or overwrites `metadata.__zigflow_id`
    (§2.3) or `heartbeat`, and preserves any non-string metadata entries
    untouched. The read/write logic lives in `inspectorForms.ts`
    (`read/writeCommonFields`, `writeMetadata`, `writeThen`), unit-tested.
  - **Task-level `then`** ("On completion") is a dropdown at the bottom of the
    inspector, reusing `thenOptions(siblingNames)`; `continue` (the default)
    drops the property. It is **hidden for a root do-workflow** — top-level
    workflows are independent (§1.2), so a goto between them is meaningless; any
    `then` present on such a workflow in loaded YAML is preserved without
    exposing an editor (§1.1). (Distinct from Switch's per-case `then`.)
- **Internationalisation (i18n).** All user-visible text in the UI must go
  through an i18n library — there are no hardcoded strings in components. For
  this PoC only two locales are supported: `en` (US English, and the fallback
  for anything unmatched) and `en-GB`. Locale is determined **solely** from
  the browser's `Accept-Language` header, resolved server-side per request —
  there is no in-app language switcher and no locale persistence to build yet.
  A non-base locale file must carry **only** values that differ from the base
  (`en`); byte-identical duplicates (and orphan keys the base lacks) are
  rejected by `npm run check:locales` (`scripts/check-locale-duplication.mjs`),
  wired into `npm run check` and CI so the cleanup can't silently regress. This
  reads the base/locale list from the inlang config, so new locales are covered
  automatically.
  This is a binding constraint on every component-building step from here on
  (inspector forms, canvas, node palette, …): new components must be authored
  against the i18n library, not with inline English. **Follow-up:** the
  components already built in earlier steps (Canvas, Inspector, TaskNode, page
  routes) currently hold hardcoded English strings and must be retrofitted —
  tracked as follow-up work (§8), not done in the pass that introduced this
  rule.
- **i18n library — Paraglide JS v2 (`@inlang/paraglide-js`).** Chosen over
  `svelte-i18n` because its `preferredLanguage` strategy resolves the locale
  from `Accept-Language` server-side (as required above) and is request-safe
  via `AsyncLocalStorage`, whereas `svelte-i18n`'s module-global locale store
  has a known SSR cross-request leak. Two costs come with this choice:
  - Paraglide is a *compiler* with generated output (gitignored), so a compile
    step must run before type-checking — already wired via an `i18n:compile`
    script fronting `check`/`check:watch`.
  - Message keys must be **flat and kind-suffixed** (`kind_*`, `subtitle_*`, …)
    and selected with explicit `switch` statements, never dynamic lookup
    (`m[key]()`), because dynamic lookup defeats Paraglide's tree-shaking. This
    constrains how future inspector-form message keys should be organized.

---

## 7. Design philosophy notes

A few recurring principles worth stating explicitly, since they've guided
several decisions above and should guide future ones:

- **Don't get in the user's way for things the schema itself allows.**
  Empty `do: []`, a Try node that's momentarily just placeholders, a
  workflow with one task — these are all valid, so the editor shouldn't add
  defensive friction (warnings, blocked states) around them just because
  they look sparse. Spend effort on genuine invalid states, not on states
  that are merely minimal.
- **One central place for each kind of rule.** One validator (schema-driven,
  §4), one place node identity is assigned (§2.3), one place `then` options
  are computed (sibling names + directives, used identically by Switch cases
  and any task's own `then`). Avoid parallel, hand-maintained copies of a
  rule that need to be kept in sync by discipline rather than by
  construction.
- **Prefer decisions that are cheap now and don't f
