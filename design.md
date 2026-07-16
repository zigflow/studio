# Zigflow Editor — Design Doc

A drag-and-drop editor for [Zigflow](https://zigflow.dev) workflows.

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
- **`treeToGraph.ts`** — pure projection: one scope's `TaskList` → SvelteFlow
  nodes + edges. Two layouts:
  - **`sequential`** (root, and `do`/`for`/`try` bodies): vertical stack,
    array-order position, solid edges between consecutive nodes.
  - **`parallel`** (`fork.branches`): horizontal lanes, no edges between
    them (they run concurrently, not in sequence).
  - Plus **derived, informational `goto` edges** for Switch cases whose
    `then` names a sibling task — dashed, never written back to the tree.
- **`mutations.ts`** — the only functions that change the tree:
  `renameTask`, `updateTaskBody`, `addTask`, `removeTask`, `moveTask`,
  `ensureTaskIds`, `syncWorkflowType`. All operate on a resolved
  `TaskList` reference from `resolveScope`.
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

The bundled schema should be refreshed periodically from
`https://zigflow.dev/schema.yaml` (a script for this, `update-schema`, is
part of the PoC). Note this covers pure JSON-Schema-expressible rules only —
jq expression syntax, determinism rules (`uuid`/`timestamp`/`now` only valid
inside `set`), and task-name-uniqueness-within-scope are additional Zigflow
CLI (`zigflow validate`) checks not expressible as JSON Schema, and are out
of scope for this editor's validation layer. The CLI remains the final
authority before a workflow actually runs.

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

### 5.5 Explicitly out of scope

No auth, no multi-user conflict detection, no locking. Last write wins.
This is intentional — a platform team's own auth layer (e.g. Dex) sits in
front of this app; it doesn't belong here unless/until there are paying
customers who need it.

---

## 6. UI structure

- **Project list** (`/`) — list existing workflows, create a new one.
- **Editor** (`/workflows/[name]`) — three-pane layout:
  - Left: read-only workflow details (task queue, version, DSL) — matches
    Zigflow's own "Workflow Details" panel.
  - Center: the canvas — breadcrumb (scope path) + SvelteFlow view of the
    current scope + "+ Add Node" control.
  - Right: inspector for the selected task (or workflow-level document
    metadata when nothing's selected), plus validation errors.
- **Node component** (`TaskNode.svelte`) — a card per task: icon/kind
  glyph, name, one-line subtitle (method+endpoint for `call`, duration for
  `wait`, etc.), inline move-up/move-down/delete/drill-in controls.
- **Inspector forms** — dedicated forms exist for `call`/http, `set`,
  `wait`, `switch` (case list with `when`/`then`, `then` populated from
  sibling names), and `for`. `fork`/`try` show a pointer to their sub-canvas
  rather than an inline branch/step editor. `raise`/`listen`/`run`/other
  `call` sub-types fall back to a JSON textarea for now — the pattern for
  adding a dedicated form is established and should be extended over time.

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
- **Prefer decisions that are cheap now and don't foreclose the expensive
  version later**, over deferring the decision entirely. Library choices
  (`yaml` over `js-yaml`), interfaces (`WorkflowStore`), and file-naming
  conventions (history file shape) are examples: picking the shape now costs
  little, and avoids a rewrite later when the deferred feature actually gets
  built.

---

## 8. Open items / things to revisit

- Full inspector forms for `fork`, `try`, `raise`, `listen`, `run`, and the
  `grpc`/`activity` `call` sub-types.
- Lossless YAML round-tripping (comments, key order) — decide if/when
  needed; library choice already supports it (§5.2).
- History retention/pruning policy — not needed until history (§5.3) is
  built.
- Publish strategy implementation, commit-message dialog, and Git config
  file schema (§5.4).
- Whether `@open-workflow-specification/sdk-typescript` should replace the
  hand-written types in `src/lib/types/zigflow.ts` once package registry
  access is available, and how much of its own tooling (validation,
  serialization, Mermaid export) is worth reusing versus staying entirely
  on Zigflow's own schema for validation.
