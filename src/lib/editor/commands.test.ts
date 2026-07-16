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

import type { TaskList } from '../types/zigflow';
import { applyRename } from './commands';

function list(): TaskList {
  return [
    { a: { set: { x: 1 }, metadata: { __zigflow_id: 'id-a' } } },
    { b: { set: { x: 2 }, metadata: { __zigflow_id: 'id-b' } } },
  ];
}

const nameAt = (l: TaskList, i: number): string => Object.keys(l[i])[0];

describe('applyRename', () => {
  it('renames on success', () => {
    const l = list();
    expect(applyRename(l, 'id-a', 'renamed')).toBe('ok');
    expect(nameAt(l, 0)).toBe('renamed');
  });

  it('maps a duplicate name to "duplicate" and leaves the list untouched', () => {
    const l = list();
    expect(applyRename(l, 'id-a', 'b')).toBe('duplicate');
    expect(nameAt(l, 0)).toBe('a');
    expect(nameAt(l, 1)).toBe('b');
  });

  it('rejects an empty/whitespace name before mutating', () => {
    const l = list();
    expect(applyRename(l, 'id-a', '   ')).toBe('empty');
    expect(nameAt(l, 0)).toBe('a');
  });

  it('reports a missing task id', () => {
    const l = list();
    expect(applyRename(l, 'nope', 'x')).toBe('not-found');
  });

  it('treats renaming a task to its own name as ok', () => {
    const l = list();
    expect(applyRename(l, 'id-a', 'a')).toBe('ok');
    expect(nameAt(l, 0)).toBe('a');
  });
});
