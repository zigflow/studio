/*
 * Copyright 2025 - 2026 Zigflow authors <https://github.com/zigflow/studio/graphs/contributors>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { durationField, parseDurationField } from '$lib/editor/formValues';
import type { ExpressionDuration, WaitTask } from '$lib/types/zigflow';

/**
 * Form ↔ task mapping for `wait` (DESIGN.md §6), paired with `WaitForm.svelte`.
 * A `wait` is either a duration (its fields kept as expression-capable strings)
 * or an absolute `until` time.
 */

export type WaitForm =
  | {
      mode: 'duration';
      days: string;
      hours: string;
      minutes: string;
      seconds: string;
      milliseconds: string;
    }
  | { mode: 'until'; until: string };

export function readWaitForm(task: WaitTask): WaitForm {
  if ('until' in task.wait) {
    return { mode: 'until', until: String(task.wait.until) };
  }
  const d = task.wait;
  return {
    mode: 'duration',
    days: durationField(d.days),
    hours: durationField(d.hours),
    minutes: durationField(d.minutes),
    seconds: durationField(d.seconds),
    milliseconds: durationField(d.milliseconds),
  };
}

export function writeWaitTask(task: WaitTask, form: WaitForm): WaitTask {
  if (form.mode === 'until') {
    return { ...task, wait: { until: form.until } };
  }
  const duration: ExpressionDuration = {};
  const fields: ReadonlyArray<[keyof ExpressionDuration, string]> = [
    ['days', form.days],
    ['hours', form.hours],
    ['minutes', form.minutes],
    ['seconds', form.seconds],
    ['milliseconds', form.milliseconds],
  ];
  for (const [field, raw] of fields) {
    const parsed = parseDurationField(raw);
    if (parsed !== undefined) {
      duration[field] = parsed;
    }
  }
  return { ...task, wait: duration };
}
