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

import type { CallTask } from '../../types/zigflow';
import { switchCallType } from './callForm';

describe('switchCallType', () => {
  it('changes call + with but preserves TaskBase fields', () => {
    const task = {
      call: 'http',
      with: { method: 'GET', endpoint: { uri: 'https://x.example' } },
      if: '${ .ready }',
      then: 'end',
      metadata: { __zigflow_id: 'id-1' },
    } as unknown as CallTask;

    const grpc = switchCallType(task, 'grpc', undefined);
    expect(grpc.call).toBe('grpc');
    expect(grpc.with).toEqual({}); // grpc has no dedicated form yet (§8)
    // TaskBase rides through untouched.
    expect(grpc.if).toBe('${ .ready }');
    expect(grpc.then).toBe('end');
    expect(grpc.metadata?.__zigflow_id).toBe('id-1');
  });

  it('uses the HTTP default when switching to http with no cached with', () => {
    const task = { call: 'grpc', with: {} } as unknown as CallTask;
    const http = switchCallType(task, 'http', undefined);
    expect(http.call).toBe('http');
    expect(http.with).toEqual({
      method: 'GET',
      endpoint: { uri: 'https://example.com' },
    });
  });

  it('restores a cached with so a type round-trip preserves prior data', () => {
    const httpWith = {
      method: 'POST',
      endpoint: { uri: 'https://api.example' },
      headers: { 'x-a': '1' },
    };
    const grpcTask = {
      call: 'grpc',
      with: {},
      then: 'end',
    } as unknown as CallTask;

    const restored = switchCallType(grpcTask, 'http', httpWith);
    expect(restored.call).toBe('http');
    expect(restored.with).toBe(httpWith); // exact prior object restored
    expect(restored.then).toBe('end');
  });
});
