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
import { describe, expect, it } from 'vitest';

import { TASK_KINDS } from '../../graph/model';
import { taskForms } from './taskForms';

describe('taskForms registry', () => {
  // The `Record<TaskKind, …>` type already makes a missing kind a compile
  // error; this proves the same coverage at runtime, so the guarantee doesn't
  // rest on the type alone.
  it('has a real form entry for every task kind', () => {
    for (const kind of TASK_KINDS) {
      const definition = taskForms[kind];
      expect(definition, `no registry entry for kind: ${kind}`).toBeDefined();
      expect(
        definition.component,
        `entry for kind "${kind}" has no component`,
      ).toBeTruthy();
    }
  });

  it('has no keys beyond the known task kinds', () => {
    expect(Object.keys(taskForms).sort()).toEqual([...TASK_KINDS].sort());
  });
});
