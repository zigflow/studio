<script lang="ts">
  import { resolve } from '$app/paths';
  import { m } from '$lib/paraglide/messages';

  let { data } = $props();
</script>

<svelte:head>
  <title>{m.app_name()}</title>
</svelte:head>

<h1>{m.workflows_heading()}</h1>

{#if data.workflows.length === 0}
  <p>{m.workflows_empty()}</p>
{:else}
  <ul>
    {#each data.workflows as wf (wf.name)}
      <li>
        <!-- Link text is the resolved display name (DESIGN.md §6); the URL is
             still built from the routing/directory name. -->
        <a
          href={resolve('/workflows/[name]/[...scope]', {
            name: wf.name,
            scope: '',
          })}
        >
          {wf.displayName}
        </a>
        {#if wf.displayName !== wf.name}
          <small class="dir"
            >{m.workflows_directory_caption({ name: wf.name })}</small
          >
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .dir {
    color: #64748b;
  }
</style>
