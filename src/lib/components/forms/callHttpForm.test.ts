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

import type { CallHttpTask } from '../../types/zigflow';
import { readHttpForm, writeHttpTask } from './callHttpForm';

describe('http form', () => {
  it('reads method/endpoint and preserves other with-fields on write', () => {
    const task: CallHttpTask = {
      call: 'http',
      with: {
        method: 'GET',
        endpoint: { uri: 'https://a.example' },
        headers: { 'x-test': '1' },
      },
      then: 'end',
    };
    expect(readHttpForm(task)).toEqual({
      method: 'GET',
      endpoint: 'https://a.example',
    });

    const written = writeHttpTask(task, {
      method: 'POST',
      endpoint: 'https://b.example',
    });
    expect(written.with.method).toBe('POST');
    expect(written.with.endpoint).toEqual({ uri: 'https://b.example' });
    // Untouched fields preserved.
    expect(written.with.headers).toEqual({ 'x-test': '1' });
    expect(written.then).toBe('end');
  });
});
