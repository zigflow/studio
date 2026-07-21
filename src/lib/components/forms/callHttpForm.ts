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
import { endpointText } from '$lib/editor/subtitle';
import type { CallHttpTask } from '$lib/types/zigflow';

/**
 * Form ↔ task mapping for `call: http` (DESIGN.md §6), paired with
 * `CallHttpForm.svelte`. `read*` flattens the task into a string-friendly form;
 * `write*` merges edits back onto the original task, preserving untouched
 * `with` fields and `TaskBase`.
 */

export interface HttpForm {
  method: string;
  endpoint: string;
}

export function readHttpForm(task: CallHttpTask): HttpForm {
  return {
    method: task.with.method,
    endpoint: endpointText(task.with.endpoint),
  };
}

export function writeHttpTask(
  task: CallHttpTask,
  form: HttpForm,
): CallHttpTask {
  return {
    ...task,
    with: {
      ...task.with,
      method: form.method,
      endpoint: { uri: form.endpoint },
    },
  };
}
