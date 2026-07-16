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
import type { Task } from '../types/zigflow';
import type { TaskKind } from './model';

/**
 * Minimal, schema-valid default bodies for each task kind (DESIGN.md §3).
 *
 * Used when a node is added from the palette. Every default must pass
 * `validateWorkflow()` when wrapped in a workflow shell — this is asserted in the
 * test suite; a default that fails validation on its own is a bug.
 *
 * Notes:
 * - `try`/`catch` seed a placeholder step in *both* `try` and `catch.do`, because
 *   the schema requires `minItems: 1` there (unlike `do`/`for`/`fork`, which
 *   permit an empty list). An empty Try node would fail validation the instant it
 *   is created.
 * - `call` and `run` each have several sub-types; the defaults pick the one with a
 *   dedicated inspector form (`call: http`) or the simplest shape (`run: shell`).
 *   The inspector can switch sub-type afterwards.
 *
 * Each call returns a fresh object graph, so callers may mutate the result freely.
 */
export function createDefaultTask(kind: TaskKind): Task {
  switch (kind) {
    case 'call':
      return {
        call: 'http',
        with: { method: 'GET', endpoint: { uri: 'https://example.com' } },
      };
    case 'do':
      return { do: [] };
    case 'for':
      return { for: { in: '${ .items }' }, do: [] };
    case 'fork':
      return { fork: { branches: [] } };
    case 'listen':
      return {
        listen: { to: { one: { with: { type: 'com.example.event' } } } },
      };
    case 'raise':
      return { raise: { error: 'error' } };
    case 'run':
      return { run: { shell: { command: 'echo hello' } } };
    case 'set':
      return { set: { result: 'value' } };
    case 'switch':
      return { switch: [{ default: { then: 'continue' } }] };
    case 'try':
      return {
        try: [{ attempt: { set: { result: 'value' } } }],
        catch: { do: [{ handle: { set: { result: 'value' } } }] },
      };
    case 'wait':
      return { wait: { seconds: 1 } };
    default: {
      // Exhaustiveness guard: a new TaskKind must add a default above.
      const unreachable: never = kind;
      throw new Error(`No default body for task kind: ${String(unreachable)}`);
    }
  }
}
