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
import type { TaskKind } from '$lib/graph/model';
import type { Task } from '$lib/types/zigflow';
import type { Component } from 'svelte';

import CallForm from './CallForm.svelte';
import ForForm from './ForForm.svelte';
import JsonFallbackForm from './JsonFallbackForm.svelte';
import SetForm from './SetForm.svelte';
import SwitchForm from './SwitchForm.svelte';
import WaitForm from './WaitForm.svelte';

/**
 * The props the inspector invokes every task form with. Each dedicated form
 * accepts a narrower `task` (e.g. `CallHttpTask`) and most ignore
 * `siblingNames`; the inspector always passes the full set with the task that
 * matches the kind, so the registry stores every form behind this one shape.
 * The kind→task-type correspondence (`call` ⇒ `CallHttpTask`, …) is what makes
 * indexing sound; it holds by construction of `taskKind()` and is asserted at
 * the insertion boundary below, not proven to the compiler.
 */
export type TaskFormComponent = Component<{
  task: Task;
  siblingNames: string[];
  onchange: (task: Task) => void;
}>;

/** The inspector form for one task kind. */
export interface TaskFormDefinition {
  component: TaskFormComponent;
}

// Each dedicated form is typed for a narrower `task` than the registry's uniform
// shape and is only ever rendered for its own kind (the inspector selects by
// kind), so the prop type is erased here, at the single point of insertion.
function form(component: unknown): TaskFormDefinition {
  return { component: component as TaskFormComponent };
}

/**
 * The shared read-only fallback (JSON view / sub-canvas hint). Kinds without a
 * dedicated form point here, so "does this kind have its own form yet?" is
 * derivable by comparing its `component` against this reference — there is no
 * separate flag to keep in sync.
 */
export const fallbackForm: TaskFormComponent =
  JsonFallbackForm as unknown as TaskFormComponent;

/**
 * Which inspector form each task kind uses (DESIGN.md §6). A full
 * `Record<TaskKind, …>` — not `Partial` — so a kind added to `TASK_KINDS` fails
 * to compile until it is given an entry here, the same exhaustiveness property
 * `containerField` relies on. `call`/`set`/`wait`/`switch`/`for` have dedicated
 * editors; the rest fall back to the read-only view until their own forms land
 * (DESIGN.md §8).
 */
export const taskForms: Record<TaskKind, TaskFormDefinition> = {
  call: form(CallForm),
  set: form(SetForm),
  wait: form(WaitForm),
  switch: form(SwitchForm),
  for: form(ForForm),
  do: { component: fallbackForm },
  fork: { component: fallbackForm },
  try: { component: fallbackForm },
  raise: { component: fallbackForm },
  listen: { component: fallbackForm },
  run: { component: fallbackForm },
};
