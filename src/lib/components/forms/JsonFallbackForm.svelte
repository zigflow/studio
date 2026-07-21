<script lang="ts">
  import { isContainerKind } from '$lib/editor/drilldown';
  import { taskKind } from '$lib/graph/model';
  import { m } from '$lib/paraglide/messages';
  import type { Task } from '$lib/types/zigflow';

  // Shared inspector fallback for task kinds without a dedicated form
  // (DESIGN.md §6). A container kind (fork/try/do) shows the "open the
  // sub-canvas" hint — its structure is edited by drilling in, not here; every
  // other such kind shows a read-only JSON view. This is exactly what the
  // Inspector's former kind dispatch rendered for these kinds, extracted so the
  // one fallback lives in one place rather than being duplicated per registry
  // entry.
  let { task }: { task: Task } = $props();

  const kind = $derived(taskKind(task));
</script>

{#if isContainerKind(kind)}
  <p class="hint">{m.inspector_subcanvas_hint()}</p>
{:else}
  <p class="hint">{m.inspector_fallback_hint()}</p>
  <pre>{JSON.stringify(task, null, 2)}</pre>
{/if}

<style>
  /* Matches the hint/pre styling these elements had while they lived in
     Inspector.svelte, so moving them here is purely structural. */
  .hint {
    margin: 0;
    color: #64748b;
    font-size: 0.85rem;
  }

  pre {
    margin: 0;
    padding: 0.5rem;
    background: #f1f5f9;
    border-radius: 0.4rem;
    font-size: 0.75rem;
    overflow: auto;
  }
</style>
