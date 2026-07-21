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

import type { SwitchTask } from '../../types/zigflow';
import { readSwitchCases, writeSwitchTask } from './switchForm';

describe('switch form', () => {
  it('round-trips cases and omits blank when / unnamed cases', () => {
    const task: SwitchTask = {
      switch: [
        { electronic: { when: '${ .card }', then: 'ship' } },
        { fallback: { then: 'continue' } },
      ],
    };
    expect(readSwitchCases(task)).toEqual([
      { name: 'electronic', when: '${ .card }', then: 'ship' },
      { name: 'fallback', when: '', then: 'continue' },
    ]);

    const written = writeSwitchTask(task, [
      { name: 'electronic', when: '${ .card }', then: 'ship' },
      { name: 'fallback', when: '', then: 'end' },
      { name: '', when: 'x', then: 'continue' },
    ]);
    expect(written.switch).toEqual([
      { electronic: { when: '${ .card }', then: 'ship' } },
      { fallback: { then: 'end' } },
    ]);
  });
});
