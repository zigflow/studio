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

import { containerField, isContainerKind } from './drilldown';

describe('containerField', () => {
  it('maps container kinds to their drill-in field', () => {
    expect(containerField('do')).toBe('do');
    expect(containerField('for')).toBe('do');
    expect(containerField('fork')).toBe('branches');
    // try drills into its `try` body only; `catch` is deferred until editing.
    expect(containerField('try')).toBe('try');
  });

  it('returns null for non-container kinds (including switch)', () => {
    for (const kind of [
      'switch',
      'call',
      'set',
      'wait',
      'raise',
      'listen',
      'run',
    ] as const) {
      expect(containerField(kind)).toBeNull();
    }
  });
});

describe('isContainerKind', () => {
  it('is true only for do/for/fork/try', () => {
    expect(isContainerKind('do')).toBe(true);
    expect(isContainerKind('for')).toBe(true);
    expect(isContainerKind('fork')).toBe(true);
    expect(isContainerKind('try')).toBe(true);
    expect(isContainerKind('switch')).toBe(false);
    expect(isContainerKind('set')).toBe(false);
  });
});
