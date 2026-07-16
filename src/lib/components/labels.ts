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
import type { TaskKind } from '../graph/model';
import { m } from '../paraglide/messages';

/**
 * The localized display label for a task kind. An explicit `switch` (not a
 * dynamic `m[key]()` lookup) so Paraglide can tree-shake, per the message-key
 * convention recorded in DESIGN.md §6. Shared by the node card and the palette.
 */
export function kindLabel(kind: TaskKind): string {
  switch (kind) {
    case 'call':
      return m.kind_call();
    case 'do':
      return m.kind_do();
    case 'for':
      return m.kind_for();
    case 'fork':
      return m.kind_fork();
    case 'listen':
      return m.kind_listen();
    case 'raise':
      return m.kind_raise();
    case 'run':
      return m.kind_run();
    case 'set':
      return m.kind_set();
    case 'switch':
      return m.kind_switch();
    case 'try':
      return m.kind_try();
    case 'wait':
      return m.kind_wait();
    default: {
      const unreachable: never = kind;
      return String(unreachable);
    }
  }
}
