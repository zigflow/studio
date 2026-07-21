<script lang="ts">
  import {
    type CommonFieldsForm,
    readCommonFields,
    thenOptions,
    writeCommonFields,
    writeThen,
  } from '$lib/editor/commonFields';
  import { isInvalidJsonField } from '$lib/editor/formValues';
  import { m } from '$lib/paraglide/messages';
  import type { Task } from '$lib/types/zigflow';
  import { untrack } from 'svelte';

  let {
    task,
    onchange,
    siblingNames,
    hideThen,
  }: {
    task: Task;
    onchange: (t: Task) => void;
    /** Same-scope sibling names, for the `then` goto options. */
    siblingNames: string[];
    /** Hide the `then` field (root do-workflows are independent, §1.2). */
    hideThen: boolean;
  } = $props();

  // Snapshot once; the parent re-keys the inspector on selection change.
  let form = $state<CommonFieldsForm>(untrack(() => readCommonFields(task)));

  function emit() {
    onchange(writeCommonFields(task, form));
  }

  // Heartbeat is an (integer-only) Duration — reuse `wait`'s unit labels.
  const durationUnits: ReadonlyArray<
    [keyof CommonFieldsForm['heartbeat'], string]
  > = [
    ['days', m.form_wait_days()],
    ['hours', m.form_wait_hours()],
    ['minutes', m.form_wait_minutes()],
    ['seconds', m.form_wait_seconds()],
    ['milliseconds', m.form_wait_milliseconds()],
  ];

  function addMeta() {
    form.metadata.push({ key: '', value: '' });
    emit();
  }
  function removeMeta(index: number) {
    form.metadata.splice(index, 1);
    emit();
  }
</script>

<!-- Common TaskBase fields shared by every kind (DESIGN.md §6), in addition to
     the kind-specific form above. Collapsed by default — advanced/rarely used. -->
<details class="common">
  <summary>{m.inspector_common_heading()}</summary>

  <label>
    <span>{m.inspector_if_label()}</span>
    <input
      value={form.if}
      oninput={(e) => {
        form.if = e.currentTarget.value;
        emit();
      }}
    />
  </label>

  <fieldset>
    <legend>{m.inspector_input_legend()}</legend>
    <label>
      <span>{m.inspector_schema_label()}</span>
      <textarea
        rows="2"
        value={form.inputSchema}
        oninput={(e) => {
          form.inputSchema = e.currentTarget.value;
          emit();
        }}></textarea>
    </label>
    {#if isInvalidJsonField(form.inputSchema)}
      <p class="error">{m.inspector_json_error()}</p>
    {/if}
  </fieldset>

  <fieldset>
    <legend>{m.inspector_output_legend()}</legend>
    <label>
      <span>{m.inspector_as_label()}</span>
      <input
        value={form.outputAs}
        oninput={(e) => {
          form.outputAs = e.currentTarget.value;
          emit();
        }}
      />
    </label>
    <label>
      <span>{m.inspector_schema_label()}</span>
      <textarea
        rows="2"
        value={form.outputSchema}
        oninput={(e) => {
          form.outputSchema = e.currentTarget.value;
          emit();
        }}></textarea>
    </label>
    {#if isInvalidJsonField(form.outputSchema)}
      <p class="error">{m.inspector_json_error()}</p>
    {/if}
  </fieldset>

  <fieldset>
    <legend>{m.inspector_export_legend()}</legend>
    <label>
      <span>{m.inspector_as_label()}</span>
      <input
        value={form.exportAs}
        oninput={(e) => {
          form.exportAs = e.currentTarget.value;
          emit();
        }}
      />
    </label>
    <label>
      <span>{m.inspector_schema_label()}</span>
      <textarea
        rows="2"
        value={form.exportSchema}
        oninput={(e) => {
          form.exportSchema = e.currentTarget.value;
          emit();
        }}></textarea>
    </label>
    {#if isInvalidJsonField(form.exportSchema)}
      <p class="error">{m.inspector_json_error()}</p>
    {/if}
  </fieldset>

  <fieldset>
    <legend>{m.inspector_metadata_legend()}</legend>

    <span class="sublabel">{m.inspector_heartbeat_label()}</span>
    {#each durationUnits as [unit, label] (unit)}
      <label>
        <span>{label}</span>
        <input
          value={form.heartbeat[unit]}
          oninput={(e) => {
            form.heartbeat[unit] = e.currentTarget.value;
            emit();
          }}
        />
      </label>
    {/each}

    {#each form.metadata as entry, index (index)}
      <div class="meta-entry">
        <label>
          <span>{m.form_set_key()}</span>
          <input
            value={entry.key}
            oninput={(e) => {
              form.metadata[index].key = e.currentTarget.value;
              emit();
            }}
          />
        </label>
        <label>
          <span>{m.form_set_value()}</span>
          <input
            value={entry.value}
            oninput={(e) => {
              form.metadata[index].value = e.currentTarget.value;
              emit();
            }}
          />
        </label>
        <button
          type="button"
          title={m.inspector_metadata_remove()}
          aria-label={m.inspector_metadata_remove()}
          onclick={() => removeMeta(index)}>✕</button
        >
      </div>
    {/each}
    <button type="button" onclick={addMeta}>{m.inspector_metadata_add()}</button
    >
  </fieldset>

  <!-- Task-level `then` — last field in the section. Hidden for a root
       do-workflow: top-level workflows are independent (§1.2), so a goto between
       them is meaningless; any loaded then there is preserved with no editor
       exposed (§1.1). -->
  {#if !hideThen}
    <label>
      <span>{m.inspector_then_label()}</span>
      <select
        value={task.then ?? 'continue'}
        onchange={(e) => onchange(writeThen(task, e.currentTarget.value))}
      >
        {#each thenOptions(siblingNames) as option (option)}
          <option value={option}>{option}</option>
        {/each}
      </select>
    </label>
  {/if}
</details>

<style>
  .common {
    margin-top: 0.25rem;
    padding-top: 0.5rem;
    border-top: 1px solid #e2e8f0;
  }

  summary {
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
  }

  fieldset {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin: 0.5rem 0 0;
    padding: 0.5rem;
  }

  legend {
    padding: 0 0.25rem;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #64748b;
  }

  .sublabel {
    font-size: 0.75rem;
    color: #64748b;
  }

  textarea {
    resize: vertical;
  }

  /* Stack key/value/remove vertically so the row never overflows the panel,
     matching SetForm's `.entry` convention. */
  .meta-entry {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.5rem;
    margin-top: 0.3rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.4rem;
  }

  .error {
    margin: 0;
    color: #b91c1c;
    font-size: 0.8rem;
  }
</style>
