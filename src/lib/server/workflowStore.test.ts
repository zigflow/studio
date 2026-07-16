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
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { ZigflowWorkflow } from '../types/zigflow';
import {
  FsWorkflowStore,
  UnsafeWorkflowNameError,
  WorkflowNotFoundError,
} from './workflowStore';

function sample(): ZigflowWorkflow {
  return {
    document: {
      dsl: '1.0.0',
      taskQueue: 'q',
      workflowType: 'sample',
      version: '0.1.0',
    },
    do: [{ sample: { do: [{ noop: { set: { done: true } } }] } }],
  };
}

let dir: string;
let store: FsWorkflowStore;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'zigflow-store-'));
  store = new FsWorkflowStore(dir);
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('FsWorkflowStore', () => {
  it('round-trips a workflow through save then load', async () => {
    const workflow = sample();
    expect(await store.exists('sample')).toBe(false);

    await store.save('sample', workflow);

    expect(await store.exists('sample')).toBe(true);
    expect(await store.list()).toContain('sample');
    expect(await store.load('sample')).toEqual(workflow);
  });

  it('throws WorkflowNotFoundError for a missing workflow', async () => {
    await expect(store.load('does-not-exist')).rejects.toBeInstanceOf(
      WorkflowNotFoundError,
    );
  });

  it.each(['../escape', '..', 'a/b', 'foo/../../etc/passwd', '.hidden', ''])(
    'rejects the unsafe name %j',
    async (name) => {
      await expect(store.load(name)).rejects.toBeInstanceOf(
        UnsafeWorkflowNameError,
      );
      await expect(store.save(name, sample())).rejects.toBeInstanceOf(
        UnsafeWorkflowNameError,
      );
    },
  );

  it('removes a workflow', async () => {
    await store.save('temp', sample());
    expect(await store.exists('temp')).toBe(true);
    await store.remove('temp');
    expect(await store.exists('temp')).toBe(false);
  });
});
