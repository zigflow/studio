<script lang="ts">
  import {
    readSwitchCases,
    thenOptions,
    writeSwitchTask,
  } from '$lib/editor/inspectorForms';
  import type { SwitchCaseForm } from '$lib/editor/inspectorForms';
  import { m } from '$lib/paraglide/messages';
  import type { SwitchTask } from '$lib/types/zigflow';
  import { untrack } from 'svelte';

  let {
    task,
    siblingNames,
    onchange,
  }: {
    task: SwitchTask;
    siblingNames: string[];
    onchange: (t: SwitchTask) => void;
  } = $props();

  // Snapshot once; parent re-keys the inspector on selection change.
  let cases = $state<SwitchCaseForm[]>(untrack(() => readSwitchCases(task)));

  // `then` offers the three flow directives plus this scope's sibling task names
  // (DESIGN.md §3 — the concrete consumer of siblingNames()).
  const options = $derived(thenOptions(siblingNames));

  function emit() {
    onchange(writeSwitchTask(task, cases));
  }

  function updateField(index: number, patch: Partial<SwitchCaseForm>) {
    cases[index] = { ...cases[index], ...patch };
    emit();
  }
  function addCase() {
    cases.push({ name: `case${cases.length + 1}`, when: '', then: 'continue' });
    emit();
  }
  function removeCase(index: number) {
    cases.splice(index, 1);
    emit();
  }
</script>

{#if cases.length === 0}
  <p class="hint">{m.form_switch_empty()}</p>
{/if}

{#each cases as switchCase, index (index)}
  <div class="case">
    <label>
      <span>{m.form_switch_case_name()}</span>
      <input
        value={switchCase.name}
        oninput={(e) => updateField(index, { name: e.currentTarget.value })}
      />
    </label>
    <label>
      <span>{m.form_switch_when()}</span>
      <input
        value={switchCase.when}
        oninput={(e) => updateField(index, { when: e.currentTarget.value })}
      />
    </label>
    <label>
      <span>{m.form_switch_then()}</span>
      <select
        value={switchCase.then}
        onchange={(e) => updateField(index, { then: e.currentTarget.value })}
      >
        {#each options as option (option)}
          <option value={option}>{option}</option>
        {/each}
      </select>
    </label>
    <button
      type="button"
      title={m.form_switch_remove()}
      aria-label={m.form_switch_remove()}
      onclick={() => removeCase(index)}>✕</button
    >
  </div>
{/each}

<button type="button" onclick={addCase}>{m.form_switch_add()}</button>

<style>
  .case {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.5rem;
    margin-bottom: 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.4rem;
  }
</style>
