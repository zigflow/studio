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

import { validateWorkflow } from '../schema/validate';
import type { Task, ZigflowWorkflow } from '../types/zigflow';
import { createDefaultTask } from './defaults';
import { TASK_KINDS } from './model';

/** Wrap a single task in a minimal, otherwise-valid workflow for validation. */
function shell(task: Task): ZigflowWorkflow {
  return {
    document: {
      dsl: '1.0.0',
      taskQueue: 'q',
      workflowType: 'main',
      version: '0.1.0',
    },
    do: [{ main: { do: [{ node: task }] } }],
  };
}

describe('createDefaultTask', () => {
  it.each(TASK_KINDS)('produces a schema-valid default for %s', (kind) => {
    const result = validateWorkflow(shell(createDefaultTask(kind)));
    if (!result.valid) {
      // Surface the schema errors in the failure message.
      throw new Error(
        `default "${kind}" failed validation: ${JSON.stringify(result.errors, null, 2)}`,
      );
    }
    expect(result.valid).toBe(true);
  });
});
