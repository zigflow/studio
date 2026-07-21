<script lang="ts">
  import { m } from '$lib/paraglide/messages';
  import type { CallTask } from '$lib/types/zigflow';

  import CallHttpForm from './CallHttpForm.svelte';
  import JsonFallbackForm from './JsonFallbackForm.svelte';
  import { type CallType, switchCallType } from './callForm';

  let { task, onchange }: { task: CallTask; onchange: (t: CallTask) => void } =
    $props();

  // Explicit label lookup — no dynamic `m[key]()` (DESIGN.md §6).
  const typeOptions: ReadonlyArray<[CallType, () => string]> = [
    ['http', m.form_call_type_http],
    ['grpc', m.form_call_type_grpc],
    ['activity', m.form_call_type_activity],
  ];

  // Per-type `with` cache so switching call type and back doesn't lose data:
  // each switch stashes the outgoing type's current `with` and restores any
  // previously-stashed `with` for the incoming one (else a default). Purely
  // transient UI state, re-created fresh whenever the inspector re-keys on a new
  // selection — nothing is persisted on the task. Mirrors WaitForm keeping both
  // modes' fields in local state across a mode switch.
  const withCache: Partial<Record<CallType, unknown>> = {};

  function selectType(next: CallType) {
    if (next === task.call) {
      return;
    }
    // `task.with` already reflects the latest edits to the current type.
    withCache[task.call] = task.with;
    onchange(switchCallType(task, next, withCache[next]));
  }
</script>

<label>
  <span>{m.form_call_type()}</span>
  <select
    value={task.call}
    onchange={(e) => selectType(e.currentTarget.value as CallType)}
  >
    {#each typeOptions as [value, label] (value)}
      <option {value}>{label()}</option>
    {/each}
  </select>
</label>

<!-- HTTP is the only call type with a dedicated form; gRPC/Activity fall back to
     the read-only JSON view until their own forms land (§8). This is the single
     http-vs-fallback shape guard (moved out of Inspector so it isn't duplicated). -->
{#if task.call === 'http'}
  <CallHttpForm {task} {onchange} />
{:else}
  <JsonFallbackForm {task} />
{/if}
