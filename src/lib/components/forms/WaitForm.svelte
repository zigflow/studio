<script lang="ts">
  import { m } from '$lib/paraglide/messages';
  import type { WaitTask } from '$lib/types/zigflow';
  import { untrack } from 'svelte';

  import { readWaitForm, writeWaitTask } from './waitForm';
  import type { WaitForm } from './waitForm';

  let { task, onchange }: { task: WaitTask; onchange: (t: WaitTask) => void } =
    $props();

  // Snapshot once; parent re-keys the inspector on selection change.
  const init = untrack(() => readWaitForm(task));
  let mode = $state<'duration' | 'until'>(init.mode);
  let days = $state(init.mode === 'duration' ? init.days : '');
  let hours = $state(init.mode === 'duration' ? init.hours : '');
  let minutes = $state(init.mode === 'duration' ? init.minutes : '');
  let seconds = $state(init.mode === 'duration' ? init.seconds : '');
  let milliseconds = $state(init.mode === 'duration' ? init.milliseconds : '');
  let until = $state(init.mode === 'until' ? init.until : '');

  function emit() {
    const form: WaitForm =
      mode === 'duration'
        ? { mode, days, hours, minutes, seconds, milliseconds }
        : { mode, until };
    onchange(writeWaitTask(task, form));
  }
</script>

<fieldset>
  <legend>{m.form_wait_mode()}</legend>
  <label class="radio">
    <input
      type="radio"
      value="duration"
      checked={mode === 'duration'}
      onchange={() => {
        mode = 'duration';
        emit();
      }}
    />
    {m.form_wait_mode_duration()}
  </label>
  <label class="radio">
    <input
      type="radio"
      value="until"
      checked={mode === 'until'}
      onchange={() => {
        mode = 'until';
        emit();
      }}
    />
    {m.form_wait_mode_until()}
  </label>
</fieldset>

{#if mode === 'duration'}
  <label>
    <span>{m.form_wait_days()}</span>
    <input
      value={days}
      oninput={(e) => {
        days = e.currentTarget.value;
        emit();
      }}
    />
  </label>
  <label>
    <span>{m.form_wait_hours()}</span>
    <input
      value={hours}
      oninput={(e) => {
        hours = e.currentTarget.value;
        emit();
      }}
    />
  </label>
  <label>
    <span>{m.form_wait_minutes()}</span>
    <input
      value={minutes}
      oninput={(e) => {
        minutes = e.currentTarget.value;
        emit();
      }}
    />
  </label>
  <label>
    <span>{m.form_wait_seconds()}</span>
    <input
      value={seconds}
      oninput={(e) => {
        seconds = e.currentTarget.value;
        emit();
      }}
    />
  </label>
  <label>
    <span>{m.form_wait_milliseconds()}</span>
    <input
      value={milliseconds}
      oninput={(e) => {
        milliseconds = e.currentTarget.value;
        emit();
      }}
    />
  </label>
{:else}
  <label>
    <span>{m.form_wait_until()}</span>
    <input
      value={until}
      oninput={(e) => {
        until = e.currentTarget.value;
        emit();
      }}
    />
  </label>
{/if}
