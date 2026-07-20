<script lang="ts">
  import { TASK_KINDS } from '$lib/graph/model';
  import type { TaskKind } from '$lib/graph/model';
  import { m } from '$lib/paraglide/messages';

  import { DND_TASK_KIND_MIME } from './canvas';
  import { kindLabel } from './labels';

  let { onadd, atRoot }: { onadd: (kind: TaskKind) => void; atRoot: boolean } =
    $props();

  // At the workflow root (empty scope) every entry must itself be a `do`-kind
  // workflow (DESIGN.md §1.2), so only `do` may be added there. Deeper scopes
  // offer all kinds. Derived from the caller's `atRoot`, which comes from the
  // page's scope-path state (empty path = root) — no separate scope check.
  const kinds = $derived<readonly TaskKind[]>(atRoot ? ['do'] : TASK_KINDS);

  function onDragStart(event: DragEvent, kind: TaskKind) {
    // Carry only the kind. The drop target (the canvas) appends a new node of
    // this kind to the END of the current scope — it never reads the cursor
    // position — so array order stays the only ordering (DESIGN.md §3).
    event.dataTransfer?.setData(DND_TASK_KIND_MIME, kind);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
    }
  }
</script>

<div class="palette">
  <h2>{atRoot ? m.palette_heading_root() : m.palette_heading()}</h2>
  <p class="hint">{atRoot ? m.palette_hint_root() : m.palette_drag_hint()}</p>

  <!-- The single list of addable kinds for this scope. Each chip both adds on
       click (the discoverable, keyboard-accessible path) and can be dragged onto
       the canvas — the drop appends to the end of the current scope, same as a
       click (DESIGN.md §3/§6). -->
  <ul class="kinds">
    {#each kinds as kind (kind)}
      <li>
        <button
          type="button"
          class="chip"
          draggable="true"
          onclick={() => onadd(kind)}
          ondragstart={(e) => onDragStart(e, kind)}
        >
          {kindLabel(kind)}
        </button>
      </li>
    {/each}
  </ul>
</div>

<style>
  .palette {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
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

  .hint {
    margin: 0;
    color: #64748b;
    font-size: 0.78rem;
  }

  .kinds {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .chip {
    display: inline-block;
    padding: 0.2rem 0.5rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.3rem;
    background: #f8fafc;
    color: #334155;
    font: inherit;
    cursor: grab;
    user-select: none;
  }

  .chip:hover {
    background: #eef2ff;
  }

  .chip:active {
    cursor: grabbing;
  }
</style>
