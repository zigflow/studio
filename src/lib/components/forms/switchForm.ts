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
import type { SwitchCase, SwitchTask } from '$lib/types/zigflow';

/**
 * Form ↔ task mapping for `switch` (DESIGN.md §6), paired with
 * `SwitchForm.svelte`. Each case is a single-key `{ name: { when?, then } }`
 * object; the `then` dropdown options come from `thenOptions` in
 * `commonFields.ts` (shared with the task-level `then`).
 */

export interface SwitchCaseForm {
  name: string;
  when: string;
  then: string;
}

export function readSwitchCases(task: SwitchTask): SwitchCaseForm[] {
  return task.switch.map((item) => {
    const [name, branch] = Object.entries(item)[0];
    return { name, when: branch.when ?? '', then: branch.then };
  });
}

export function writeSwitchTask(
  task: SwitchTask,
  cases: SwitchCaseForm[],
): SwitchTask {
  const items = cases
    .filter((entry) => entry.name.trim() !== '')
    .map((entry) => {
      const branch: SwitchCase = { then: entry.then };
      if (entry.when.trim() !== '') {
        branch.when = entry.when;
      }
      return { [entry.name]: branch };
    });
  return { ...task, switch: items };
}
