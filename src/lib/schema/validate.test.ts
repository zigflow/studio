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

import type { ZigflowWorkflow } from '../types/zigflow';
import { validateWorkflow } from './validate';

function validWorkflow(): ZigflowWorkflow {
  return {
    document: {
      dsl: '1.0.0',
      taskQueue: 'order-processing',
      workflowType: 'orderProcessing',
      version: '0.1.0',
    },
    do: [{ orderProcessing: { do: [{ noop: { set: { done: true } } }] } }],
  };
}

describe('validateWorkflow', () => {
  it('accepts a valid workflow', () => {
    const result = validateWorkflow(validWorkflow());
    expect(result.valid).toBe(true);
  });

  it('rejects a workflow missing document.dsl with a useful error path', () => {
    const workflow = validWorkflow();
    // @ts-expect-error deliberately removing a required field for the test
    delete workflow.document.dsl;

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(false);
    if (result.valid) {
      return;
    }

    const missingDsl = result.errors.find(
      (err) => err.params.missingProperty === 'dsl',
    );
    expect(missingDsl).toBeDefined();
    expect(missingDsl?.path).toBe('/document');
    expect(missingDsl?.message).toContain('dsl');
  });
});
