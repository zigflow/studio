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
import {
  DuplicateTaskNameError,
  TaskNotInListError,
  renameTask,
} from '../graph/mutations';
import type { TaskList } from '../types/zigflow';

/**
 * Thin editor-layer wrappers that turn a mutation's *thrown* failure into a value
 * the inspector can render inline, instead of letting it break the page. The
 * mutation functions (DESIGN.md §3) stay fail-fast; this is where the UI's
 * "surface it as a validation message" policy lives.
 */

/** Outcome of an attempted rename — `'ok'` or a reason the inspector can show. */
export type RenameOutcome = 'ok' | 'empty' | 'duplicate' | 'not-found';

/**
 * Attempt to rename a task, mapping the guard's exceptions to outcomes.
 * `DuplicateTaskNameError` (the §4 within-scope uniqueness guard) becomes
 * `'duplicate'`; an empty/whitespace name is rejected as `'empty'` before the
 * mutation runs. On `'ok'` the list has been renamed in place; on any other
 * outcome it is untouched.
 */
export function applyRename(
  list: TaskList,
  taskId: string,
  newName: string,
): RenameOutcome {
  if (newName.trim() === '') {
    return 'empty';
  }
  try {
    renameTask(list, taskId, newName);
    return 'ok';
  } catch (err) {
    if (err instanceof DuplicateTaskNameError) {
      return 'duplicate';
    }
    if (err instanceof TaskNotInListError) {
      return 'not-found';
    }
    throw err;
  }
}
