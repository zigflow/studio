<script lang="ts">
  import { m } from '$lib/paraglide/messages';
  import type { ForTask } from '$lib/types/zigflow';
  import { untrack } from 'svelte';

  import { readForForm, writeForTask } from './forForm';
  import type { ForForm } from './forForm';

  let { task, onchange }: { task: ForTask; onchange: (t: ForTask) => void } =
    $props();

  // Snapshot the initial task into the edit buffer; parent re-keys on selection.
  let form = $state<ForForm>(untrack(() => readForForm(task)));

  function update(patch: Partial<ForForm>) {
    form = { ...form, ...patch };
    onchange(writeForTask(task, form));
  }
</script>

<label>
  <span>{m.form_for_in()}</span>
  <input
    value={form.in}
    oninput={(e) => update({ in: e.currentTarget.value })}
  />
</label>
<label>
  <span>{m.form_for_each()}</span>
  <input
    value={form.each}
    oninput={(e) => update({ each: e.currentTarget.value })}
  />
</label>
<label>
  <span>{m.form_for_at()}</span>
  <input
    value={form.at}
    oninput={(e) => update({ at: e.currentTarget.value })}
  />
</label>
<label>
  <span>{m.form_for_while()}</span>
  <input
    value={form.while}
    oninput={(e) => update({ while: e.currentTarget.value })}
  />
</label>
