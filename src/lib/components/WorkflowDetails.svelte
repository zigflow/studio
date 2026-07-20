<script lang="ts">
  import { browser } from '$app/environment';
  import { m } from '$lib/paraglide/messages';
  import type { ZigflowDocumentMeta } from '$lib/types/zigflow';

  type Props = {
    /** Routing/directory name — read-only, never a document field (DESIGN.md §6). */
    directory: string;
    document: ZigflowDocumentMeta;
    ontaskqueue: (value: string) => void;
    ontitle: (value: string) => void;
    onsummary: (value: string) => void;
  };

  let { directory, document, ontaskqueue, ontitle, onsummary }: Props =
    $props();
</script>

<!--
  Rendered client-only. SSR-hydrated inputs on this page don't get their
  oninput handlers wired (root cause undetermined — the palette, also SSR'd, is
  fine); client rendering makes the inputs client-created, which works. The gate
  is kept *inside* this component (not around it in the page) so the page's
  sibling hydration — notably the palette — isn't disturbed, mirroring how
  Canvas.svelte isolates its own browser-only render.
-->
{#if browser}
  <section class="details">
    <h2>{m.details_heading()}</h2>

    <label>
      <span>{m.details_task_queue()}</span>
      <input
        value={document.taskQueue}
        oninput={(e) => ontaskqueue(e.currentTarget.value)}
      />
    </label>
    <label>
      <span>{m.details_title()}</span>
      <input
        value={document.title ?? ''}
        oninput={(e) => ontitle(e.currentTarget.value)}
      />
    </label>
    <label>
      <span>{m.details_summary()}</span>
      <textarea
        rows="2"
        value={document.summary ?? ''}
        oninput={(e) => onsummary(e.currentTarget.value)}></textarea>
    </label>

    <!-- Read-only: directory (routing id), version (Publish-time only, §5.4), and
       dsl (never user-editable). -->
    <dl>
      <dt>{m.details_directory()}</dt>
      <dd>{directory}</dd>
      <dt>{m.details_version()}</dt>
      <dd>{document.version}</dd>
      <dt>{m.details_dsl()}</dt>
      <dd>{document.dsl}</dd>
    </dl>
  </section>
{/if}

<style>
  .details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    border-top: 1px solid #e2e8f0;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 0.85rem;
  }

  h2 {
    margin: 0;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    color: #334155;
  }

  input,
  textarea {
    padding: 0.3rem 0.4rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.3rem;
    font: inherit;
    font-size: 0.85rem;
    resize: vertical;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.15rem 0.5rem;
    margin: 0;
  }

  dt {
    color: #64748b;
  }

  dd {
    margin: 0;
    color: #0f172a;
    overflow-wrap: anywhere;
  }
</style>
