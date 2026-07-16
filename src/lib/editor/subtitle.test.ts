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

import type { Task } from '../types/zigflow';
import { taskSubtitle } from './subtitle';

describe('taskSubtitle', () => {
  it('describes an http call with method and endpoint', () => {
    const task: Task = {
      call: 'http',
      with: { method: 'POST', endpoint: { uri: 'https://example.com/x' } },
    };
    expect(taskSubtitle(task)).toEqual({
      key: 'call_http',
      method: 'POST',
      endpoint: 'https://example.com/x',
    });
  });

  it('reads a bare-string endpoint', () => {
    const task: Task = {
      call: 'http',
      with: { method: 'GET', endpoint: 'https://example.com' },
    };
    expect(taskSubtitle(task)).toMatchObject({
      endpoint: 'https://example.com',
    });
  });

  it('describes an activity call by name', () => {
    const task: Task = {
      call: 'activity',
      with: { name: 'chargeCard', taskQueue: 'payments' },
    };
    expect(taskSubtitle(task)).toEqual({
      key: 'call_activity',
      name: 'chargeCard',
    });
  });

  it('formats a wait duration compactly', () => {
    expect(taskSubtitle({ wait: { seconds: 30 } })).toEqual({
      key: 'wait',
      duration: '30s',
    });
    expect(taskSubtitle({ wait: { minutes: 1, seconds: 30 } })).toEqual({
      key: 'wait',
      duration: '1m 30s',
    });
  });

  it('describes wait-until', () => {
    expect(taskSubtitle({ wait: { until: '2026-01-01T00:00:00Z' } })).toEqual({
      key: 'wait_until',
      time: '2026-01-01T00:00:00Z',
    });
  });

  it('describes for over its collection (not as a plain do)', () => {
    const task: Task = { for: { in: '${ .items }' }, do: [] };
    expect(taskSubtitle(task)).toEqual({
      key: 'for',
      collection: '${ .items }',
    });
  });

  it('counts fork branches, switch cases, and do steps', () => {
    expect(
      taskSubtitle({ fork: { branches: [{ a: { set: { x: 1 } } }] } }),
    ).toEqual({ key: 'fork', count: 1 });
    expect(taskSubtitle({ switch: [{ c: { then: 'continue' } }] })).toEqual({
      key: 'switch',
      count: 1,
    });
    expect(
      taskSubtitle({
        do: [{ a: { set: { x: 1 } } }, { b: { set: { y: 2 } } }],
      }),
    ).toEqual({ key: 'do', count: 2 });
  });

  it('describes try', () => {
    const task: Task = {
      try: [{ a: { set: { x: 1 } } }],
      catch: { do: [{ b: { set: { y: 2 } } }] },
    };
    expect(taskSubtitle(task)).toEqual({ key: 'try' });
  });

  it('returns none for kinds without a distinctive subtitle', () => {
    expect(taskSubtitle({ set: { x: 1 } })).toEqual({ key: 'none' });
    expect(taskSubtitle({ raise: { error: 'boom' } })).toEqual({ key: 'none' });
    expect(taskSubtitle({ run: { shell: { command: 'ls' } } })).toEqual({
      key: 'none',
    });
  });
});
