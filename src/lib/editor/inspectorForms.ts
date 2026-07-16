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
import type {
  CallHttpTask,
  ExpressionDuration,
  ForTask,
  SetTask,
  SwitchCase,
  SwitchTask,
  WaitTask,
} from '../types/zigflow';
import { endpointText } from './subtitle';

/**
 * Pure form ↔ task mappings for the inspector (DESIGN.md §6). Each `read*` pulls
 * a flat, string-friendly form model out of a task; each `write*` merges edited
 * values back onto the *original* task, so untouched parts — `TaskBase` fields
 * (`if`/`then`/`metadata`/…) and, for containers, nested task lists — are
 * preserved. Keeping this logic here (not in the Svelte components) makes the
 * edit→patch mapping unit-testable without a browser.
 */

// --- shared value parsing ----------------------------------------------------

const INTEGER = /^-?\d+$/;

/**
 * Parse a `set` value string. Tries JSON first, so `true`/`42`/`"x"` become the
 * right primitive; anything that isn't valid JSON (notably a runtime expression
 * like `${ .x }`) is kept verbatim as a string.
 */
export function parseSetValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Render a `set` value back to an editable string (inverse of parseSetValue). */
export function formatSetValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * Parse one duration field: blank → omitted, an integer literal → a number, and
 * anything else (a runtime expression) kept as a string — matching the schema's
 * `integer | runtimeExpression` union for wait durations.
 */
export function parseDurationField(raw: string): number | string | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return undefined;
  }
  return INTEGER.test(trimmed) ? Number(trimmed) : trimmed;
}

// --- set ---------------------------------------------------------------------

export interface SetEntry {
  key: string;
  value: string;
}

/** Whether a `set` task uses the object form this editor supports (vs a string). */
export function isSetObjectForm(
  task: SetTask,
): task is SetTask & { set: Record<string, unknown> } {
  return typeof task.set === 'object' && task.set !== null;
}

export function readSetEntries(set: Record<string, unknown>): SetEntry[] {
  return Object.entries(set).map(([key, value]) => ({
    key,
    value: formatSetValue(value),
  }));
}

export function writeSetTask(task: SetTask, entries: SetEntry[]): SetTask {
  const set: Record<string, unknown> = {};
  for (const { key, value } of entries) {
    if (key.trim() === '') {
      continue;
    }
    set[key] = parseSetValue(value);
  }
  return { ...task, set };
}

// --- call: http --------------------------------------------------------------

export interface HttpForm {
  method: string;
  endpoint: string;
}

export function readHttpForm(task: CallHttpTask): HttpForm {
  return {
    method: task.with.method,
    endpoint: endpointText(task.with.endpoint),
  };
}

export function writeHttpTask(
  task: CallHttpTask,
  form: HttpForm,
): CallHttpTask {
  return {
    ...task,
    with: {
      ...task.with,
      method: form.method,
      endpoint: { uri: form.endpoint },
    },
  };
}

// --- wait --------------------------------------------------------------------

export type WaitForm =
  | {
      mode: 'duration';
      days: string;
      hours: string;
      minutes: string;
      seconds: string;
      milliseconds: string;
    }
  | { mode: 'until'; until: string };

function durationField(value: number | string | undefined): string {
  return value === undefined ? '' : String(value);
}

export function readWaitForm(task: WaitTask): WaitForm {
  if ('until' in task.wait) {
    return { mode: 'until', until: String(task.wait.until) };
  }
  const d = task.wait;
  return {
    mode: 'duration',
    days: durationField(d.days),
    hours: durationField(d.hours),
    minutes: durationField(d.minutes),
    seconds: durationField(d.seconds),
    milliseconds: durationField(d.milliseconds),
  };
}

export function writeWaitTask(task: WaitTask, form: WaitForm): WaitTask {
  if (form.mode === 'until') {
    return { ...task, wait: { until: form.until } };
  }
  const duration: ExpressionDuration = {};
  const fields: ReadonlyArray<[keyof ExpressionDuration, string]> = [
    ['days', form.days],
    ['hours', form.hours],
    ['minutes', form.minutes],
    ['seconds', form.seconds],
    ['milliseconds', form.milliseconds],
  ];
  for (const [field, raw] of fields) {
    const parsed = parseDurationField(raw);
    if (parsed !== undefined) {
      duration[field] = parsed;
    }
  }
  return { ...task, wait: duration };
}

// --- for ---------------------------------------------------------------------

export interface ForForm {
  in: string;
  each: string;
  at: string;
  while: string;
}

export function readForForm(task: ForTask): ForForm {
  return {
    in: task.for.in,
    each: task.for.each ?? '',
    at: task.for.at ?? '',
    while: task.while ?? '',
  };
}

export function writeForTask(task: ForTask, form: ForForm): ForTask {
  const forConfig: ForTask['for'] = { in: form.in };
  if (form.each.trim() !== '') {
    forConfig.each = form.each;
  }
  if (form.at.trim() !== '') {
    forConfig.at = form.at;
  }
  // Spread preserves the loop body (`do`) and TaskBase fields; only the loop
  // config and the optional `while` guard are replaced here.
  const next: ForTask = { ...task, for: forConfig };
  if (form.while.trim() !== '') {
    next.while = form.while;
  } else {
    delete next.while;
  }
  return next;
}

// --- switch ------------------------------------------------------------------

export interface SwitchCaseForm {
  name: string;
  when: string;
  then: string;
}

/** The `then` options for a switch case: the three directives, then siblings. */
export function thenOptions(siblingNames: string[]): string[] {
  return ['continue', 'exit', 'end', ...siblingNames];
}

export function readSwitchCases(task: SwitchTask): SwitchCaseForm[] {
  return task.switch.map((item) => {
    const [name, branch] = Object.entries(item)[0];
    return { name, when: branch.when ?? '', then: branch.then };
  });
}

export function writeSwitchTask(
  task: SwitchTask,
  cases: SwitchCaseForm[],
): SwitchTask {
  const items = cases
    .filter((entry) => entry.name.trim() !== '')
    .map((entry) => {
      const branch: SwitchCase = { then: entry.then };
      if (entry.when.trim() !== '') {
        branch.when = entry.when;
      }
      return { [entry.name]: branch };
    });
  return { ...task, switch: items };
}
