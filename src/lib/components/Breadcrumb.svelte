<script lang="ts">
  import type { ScopePath } from '$lib/graph/model';
  import { m } from '$lib/paraglide/messages';

  type Props = {
    path: ScopePath;
    /** Navigate to a crumb: -1 = root, otherwise truncate the path to index + 1. */
    onnavigate: (index: number) => void;
  };

  let { path, onnavigate }: Props = $props();
</script>

<nav class="breadcrumb" aria-label={m.breadcrumb_nav_label()}>
  <ol>
    <li>
      {#if path.length === 0}
        <span aria-current="page">{m.breadcrumb_root()}</span>
      {:else}
        <button type="button" onclick={() => onnavigate(-1)}>
          {m.breadcrumb_root()}
        </button>
      {/if}
    </li>
    {#each path as step, index (step.taskId + index)}
      <li>
        <span class="sep" aria-hidden="true">›</span>
        {#if index === path.length - 1}
          <!-- step.label is the task's own name (user data), not translated -->
          <span aria-current="page">{step.label}</span>
        {:else}
          <button type="button" onclick={() => onnavigate(index)}>
            {step.label}
          </button>
        {/if}
      </li>
    {/each}
  </ol>
</nav>

<style>
  .breadcrumb {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #e2e8f0;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 0.85rem;
  }

  ol {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  button {
    padding: 0.1rem 0.3rem;
    border: 0;
    border-radius: 0.25rem;
    background: transparent;
    color: #4338ca;
    font: inherit;
    cursor: pointer;
  }

  button:hover {
    background: #eef2ff;
    text-decoration: underline;
  }

  [aria-current='page'] {
    font-weight: 600;
    color: #0f172a;
  }

  .sep {
    color: #94a3b8;
  }
</style>
