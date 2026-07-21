<script lang="ts">
  import { m } from '$lib/paraglide/messages';
  import type { CallHttpTask } from '$lib/types/zigflow';
  import { untrack } from 'svelte';

  import { readHttpForm, writeHttpTask } from './callHttpForm';
  import type { HttpForm } from './callHttpForm';

  let {
    task,
    onchange,
  }: { task: CallHttpTask; onchange: (t: CallHttpTask) => void } = $props();

  // Local, uncontrolled-after-init form state; the parent keys the inspector by
  // node id, so this reinitializes when a different task is selected. `untrack`
  // documents that only the initial task snapshot seeds the buffer.
  let form = $state<HttpForm>(untrack(() => readHttpForm(task)));

  function update(patch: Partial<HttpForm>) {
    form = { ...form, ...patch };
    onchange(writeHttpTask(task, form));
  }
</script>

<label>
  <span>{m.form_http_method()}</span>
  <input
    value={form.method}
    oninput={(e) => update({ method: e.currentTarget.value })}
  />
</label>
<label>
  <span>{m.form_http_endpoint()}</span>
  <input
    value={form.endpoint}
    oninput={(e) => update({ endpoint: e.currentTarget.value })}
  />
</label>
