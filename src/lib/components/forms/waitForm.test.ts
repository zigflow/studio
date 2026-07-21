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

import type { WaitTask } from '../../types/zigflow';
import { readWaitForm, writeWaitTask } from './waitForm';

describe('wait form', () => {
  it('round-trips a duration and only writes non-empty fields', () => {
    const task: WaitTask = { wait: { minutes: 1, seconds: 30 } };
    const form = readWaitForm(task);
    expect(form).toEqual({
      mode: 'duration',
      days: '',
      hours: '',
      minutes: '1',
      seconds: '30',
      milliseconds: '',
    });
    expect(writeWaitTask(task, form).wait).toEqual({ minutes: 1, seconds: 30 });
  });

  it('handles the until form', () => {
    const task: WaitTask = { wait: { until: '2026-01-01T00:00:00Z' } };
    expect(readWaitForm(task)).toEqual({
      mode: 'until',
      until: '2026-01-01T00:00:00Z',
    });
    const written = writeWaitTask(task, { mode: 'until', until: 'X' });
    expect(written.wait).toEqual({ until: 'X' });
  });
});
