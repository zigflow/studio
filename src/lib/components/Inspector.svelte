<script lang="ts">
  import type { RenameOutcome } from '$lib/editor/commands';
  import { containerField, isContainerKind } from '$lib/editor/drilldown';
  import type { ScopeField, TaskKind } from '$lib/graph/model';
  import { m } from '$lib/paraglide/messages';
  import type { Task } from '$lib/types/zigflow';
  import { untrack } from 'svelte';

  import CommonFieldsForm from './forms/CommonFieldsForm.svelte';
  import { isSetObjectForm } from './forms/setForm';
  import {
    type TaskFormComponent,
    fallbackForm,
    taskForms,
  } from './forms/taskForms';
  import { kindLabel } from './labels';

  type Props = {
    name: string;
    task: Task;
    kind: TaskKind;
    siblingNames: string[];
    renameError: RenameOutcome | null;
    /**
     * Whether the selected task lives at the root scope (a top-level workflow
     * entry). Same root detection the palette uses (DESIGN.md §1.2/§6); for a
     * root `do` task the rename field is relabelled to "Workflow Type".
     */
    atRoot: boolean;
    /** Selected task is first in its scope — disables "move up". */
    first: boolean;
    /** Selected task is last in its scope — disables "move down". */
    last: boolean;
    onrename: (newName: string) => void;
    onpatch: (task: Task) => void;
    onmoveup: () => void;
    onmovedown: () => void;
    ondelete: () => void;
    /** Drill into one of the selected container's child lists (DESIGN.md §3). */
    ondrill: (field: ScopeField) => void;
  };

  let {
    name,
    task,
    kind,
    siblingNames,
    renameError,
    atRoot,
    first,
    last,
    onrename,
    onpatch,
    onmoveup,
    onmovedown,
    ondelete,
    ondrill,
  }: Props = $props();

  // A root-scope `do` task IS a top-level workflow, so its name is its Temporal
  // workflow type (§1.2) — the rename field is relabelled accordingly. This is a
  // deliberate distinction, not a synonym for "Name": see inspector_name_label
  // vs inspector_workflow_type_label.
  const isRootWorkflow = $derived(atRoot && kind === 'do');

  // Local edit buffer for the name; committed on blur/Enter so we don't rename on
  // every keystroke. Snapshotted once (the parent keys this component by node id);
  // a rejected rename keeps the user's typed value so they can fix it.
  let nameInput = $state(untrack(() => name));

  // Kind-specific form, chosen from the registry (DESIGN.md §6) rather than an
  // inline dispatch. One kind still needs a shape guard here: `set`'s dedicated
  // form handles only the object (key/value) form, so a string/expression `set`
  // falls back to the read-only view. (`call`'s http-vs-fallback split now lives
  // inside CallForm, which owns all three call types.) Everything else is a
  // straight kind lookup.
  const SelectedForm: TaskFormComponent = $derived.by(() => {
    if ('set' in task && !isSetObjectForm(task)) return fallbackForm;
    return taskForms[kind].component;
  });
</script>

<div class="inspector">
  <h2>{m.inspector_heading()}</h2>

  <!-- Whole-task controls (DESIGN.md §6): these act on the selected task, not on
       any single field, so they sit in a toolbar above the per-field forms. -->
  <div class="task-actions">
    <button type="button" disabled={first} onclick={onmoveup}
      >{m.node_move_up()}</button
    >
    <button type="button" disabled={last} onclick={onmovedown}
      >{m.node_move_down()}</button
    >
    {#if kind === 'try'}
      <!-- Try owns two child lists; each gets its own drill affordance so the
           choice between `try` and `catch.do` is explicit (DESIGN.md §3). -->
      <button type="button" class="drill" onclick={() => ondrill('try')}
        >{m.node_open_try()}</button
      >
      <button type="button" class="drill" onclick={() => ondrill('catch')}
        >{m.node_open_catch()}</button
      >
    {:else if isContainerKind(kind)}
      {@const field = containerField(kind)}
      {#if field}
        <button type="button" class="drill" onclick={() => ondrill(field)}
          >{m.node_open()}</button
        >
      {/if}
    {/if}
    <button type="button" class="delete" onclick={ondelete}
      >{m.node_delete()}</button
    >
  </div>

  <label>
    <span
      >{isRootWorkflow
        ? m.inspector_workflow_type_label()
        : m.inspector_name_label()}</span
    >
    <input
      value={nameInput}
      oninput={(e) => (nameInput = e.currentTarget.value)}
      onchange={() => onrename(nameInput)}
    />
  </label>
  {#if renameError === 'duplicate'}
    <p class="error">{m.inspector_rename_error_duplicate()}</p>
  {:else if renameError === 'empty'}
    <p class="error">{m.inspector_rename_error_empty()}</p>
  {/if}
  {#if isRootWorkflow}
    <p class="hint">{m.inspector_workflow_type_note()}</p>
  {/if}

  <p class="kind-row">{m.inspector_kind_label()}: {kindLabel(kind)}</p>

  <SelectedForm {task} {siblingNames} onchange={onpatch} />

  <!-- Common TaskBase fields (if/input/output/export/metadata, and `then` as its
       last field), shared by every kind, in addition to the kind form above
       (DESIGN.md §6). `then` is hidden for a root do-workflow (§1.2). -->
  <CommonFieldsForm
    {task}
    {siblingNames}
    hideThen={isRootWorkflow}
    onchange={onpatch}
  />
</div>

<style>
  .inspector {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-family: ui-sans-serif, system-ui, sans-serif;
  }

  h2 {
    margin: 0;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
  }

  .kind-row {
    margin: 0;
    font-size: 0.8rem;
    color: #475569;
  }

  .task-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .task-actions button {
    padding: 0.2rem 0.5rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.25rem;
    background: #f8fafc;
    color: #334155;
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .task-actions button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .task-actions button.delete {
    color: #b91c1c;
  }

  .task-actions button.drill {
    border-color: #6366f1;
    color: #4338ca;
  }

  .error {
    margin: 0;
    color: #b91c1c;
    font-size: 0.8rem;
  }

  .hint {
    margin: 0;
    color: #64748b;
    font-size: 0.85rem;
  }

  :global(.inspector label) {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.8rem;
    color: #334155;
  }

  :global(.inspector input),
  :global(.inspector select) {
    padding: 0.3rem 0.4rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.3rem;
    font: inherit;
    font-size: 0.85rem;
  }

  :global(.inspector fieldset) {
    border: 1px solid #e2e8f0;
    border-radius: 0.4rem;
    margin: 0;
  }

  :global(.inspector .radio) {
    flex-direction: row;
    align-items: center;
    gap: 0.3rem;
  }
</style>
