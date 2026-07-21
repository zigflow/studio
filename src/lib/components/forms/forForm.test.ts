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

import type { ForTask } from '../../types/zigflow';
import { readForForm, writeForTask } from './forForm';

describe('for form', () => {
  it('preserves the loop body and drops blank optional fields', () => {
    const task: ForTask = {
      for: { in: '${ .items }', each: 'item' },
      do: [{ step: { set: { a: 1 } } }],
    };
    expect(readForForm(task)).toEqual({
      in: '${ .items }',
      each: 'item',
      at: '',
      while: '',
    });

    const written = writeForTask(task, {
      in: '${ .rows }',
      each: '',
      at: 'idx',
      while: '',
    });
    expect(written.for).toEqual({ in: '${ .rows }', at: 'idx' });
    expect('while' in written).toBe(false);
    // The body is untouched.
    expect(written.do).toBe(task.do);
  });
});
