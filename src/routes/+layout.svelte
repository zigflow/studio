<script lang="ts">
  import favicon from '$lib/assets/favicon.svg';

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<style>
  /* Reset the browser's default 8px body margin. Without this, the editor's
     `height: 100vh` sits inside a margined body, overflowing the viewport by
     16px and showing a permanent page scrollbar (which reads as the inspector
     panel scrolling). Not present anywhere else, so it's set once here. */
  :global(body) {
    margin: 0;
  }
</style>
