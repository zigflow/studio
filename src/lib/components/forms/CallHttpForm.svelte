<script lang="ts">
  import { isInvalidJsonField } from '$lib/editor/formValues';
  import { m } from '$lib/paraglide/messages';
  import type { CallHttpTask } from '$lib/types/zigflow';
  import { untrack } from 'svelte';

  import HttpMapField from './HttpMapField.svelte';
  import {
    HTTP_METHODS,
    type HttpForm,
    type HttpMethodOption,
    type HttpOutput,
    inferMethodOption,
    readHttpForm,
    writeHttpTask,
  } from './callHttpForm';

  let {
    task,
    onchange,
  }: { task: CallHttpTask; onchange: (t: CallHttpTask) => void } = $props();

  // Local, uncontrolled-after-init form state; the parent keys the inspector by
  // node id, so this reinitializes when a different task is selected. `untrack`
  // documents that only the initial task snapshot seeds the buffer.
  let form = $state<HttpForm>(untrack(() => readHttpForm(task)));

  // Which method-select option is shown, inferred ONCE at load (see
  // `inferMethodOption`). Transient UI state — not re-inferred while editing and
  // never stored on the task; `other` reveals a free-text field. Re-derived
  // fresh only on the next load (a fresh page load or reselecting the task).
  let methodOption = $state<HttpMethodOption>(
    untrack(() => inferMethodOption(form.method)),
  );

  // Explicit label lookup — no dynamic `m[key]()` (DESIGN.md §6).
  const outputOptions: ReadonlyArray<[HttpOutput, () => string]> = [
    ['raw', m.form_http_output_raw],
    ['content', m.form_http_output_content],
    ['response', m.form_http_output_response],
  ];

  function update(patch: Partial<HttpForm>) {
    form = { ...form, ...patch };
    onchange(writeHttpTask(task, form));
  }

  function selectMethodOption(option: HttpMethodOption) {
    methodOption = option;
    // A known method writes that literal. Choosing "Other" keeps the current
    // value as the free-text starting point (it is NOT blanked), so nothing is
    // written until the user edits the revealed field.
    if (option !== 'other') {
      update({ method: option });
    }
  }
</script>

<label>
  <span>{m.form_http_method()}</span>
  <select
    value={methodOption}
    onchange={(e) =>
      selectMethodOption(e.currentTarget.value as HttpMethodOption)}
  >
    {#each HTTP_METHODS as method (method)}
      <option value={method}>{method}</option>
    {/each}
    <option value="other">{m.form_http_method_other()}</option>
  </select>
</label>
{#if methodOption === 'other'}
  <label>
    <span>{m.form_http_method_custom()}</span>
    <input
      value={form.method}
      oninput={(e) => update({ method: e.currentTarget.value })}
    />
  </label>
{/if}
<label>
  <span>{m.form_http_endpoint()}</span>
  <input
    value={form.endpoint}
    oninput={(e) => update({ endpoint: e.currentTarget.value })}
  />
</label>
<label>
  <span>{m.form_http_output()}</span>
  <select
    value={form.output}
    onchange={(e) => update({ output: e.currentTarget.value as HttpOutput })}
  >
    {#each outputOptions as [value, label] (value)}
      <option {value}>{label()}</option>
    {/each}
  </select>
</label>
<label class="checkbox">
  <input
    type="checkbox"
    checked={form.redirect}
    onchange={(e) => update({ redirect: e.currentTarget.checked })}
  />
  {m.form_http_redirect()}
</label>
<label>
  <span>{m.form_http_body()}</span>
  <textarea
    rows="3"
    value={form.body}
    oninput={(e) => update({ body: e.currentTarget.value })}></textarea>
</label>
{#if isInvalidJsonField(form.body)}
  <p class="error">{m.inspector_json_error()}</p>
{/if}
<HttpMapField
  label={m.form_http_headers()}
  value={form.headers}
  onchange={(v) => update({ headers: v })}
/>
<HttpMapField
  label={m.form_http_query()}
  value={form.query}
  onchange={(v) => update({ query: v })}
/>

<style>
  /* Row layout for the checkbox + its label (the inspector's global `label`
     rule stacks column); mirrors WaitForm's `.radio` convention. */
  .checkbox {
    flex-direction: row;
    align-items: center;
    gap: 0.3rem;
  }

  /* JSON editor styling — the inspector's global rules cover input/select but
     not textarea (matches SetForm/CommonFieldsForm). */
  textarea {
    padding: 0.3rem 0.4rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.3rem;
    font: inherit;
    font-size: 0.85rem;
    resize: vertical;
  }

  .error {
    margin: 0;
    color: #b91c1c;
    font-size: 0.8rem;
  }
</style>
