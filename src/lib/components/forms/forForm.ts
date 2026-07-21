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
import type { ForTask } from '$lib/types/zigflow';

/**
 * Form ↔ task mapping for `for` (DESIGN.md §6), paired with `ForForm.svelte`.
 * Edits the loop config and optional `while` guard only; the loop body (`do`)
 * and `TaskBase` fields are preserved by spread.
 */

export interface ForForm {
  in: string;
  each: string;
  at: string;
  while: string;
}

export function readForForm(task: ForTask): ForForm {
  return {
    in: task.for.in,
    each: task.for.each ?? '',
    at: task.for.at ?? '',
    while: task.while ?? '',
  };
}

export function writeForTask(task: ForTask, form: ForForm): ForTask {
  const forConfig: ForTask['for'] = { in: form.in };
  if (form.each.trim() !== '') {
    forConfig.each = form.each;
  }
  if (form.at.trim() !== '') {
    forConfig.at = form.at;
  }
  // Spread preserves the loop body (`do`) and TaskBase fields; only the loop
  // config and the optional `while` guard are replaced here.
  const next: ForTask = { ...task, for: forConfig };
  if (form.while.trim() !== '') {
    next.while = form.while;
  } else {
    delete next.while;
  }
  return next;
}
