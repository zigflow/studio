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
  Duration,
  Export,
  ExpressionDuration,
  ForTask,
  Input,
  Output,
  Schema,
  SetTask,
  SwitchCase,
  SwitchTask,
  TaskBase,
  TaskMetadata,
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

// --- common TaskBase fields --------------------------------------------------
//
// Every task extends TaskBase (`if`/`input`/`output`/`export`/`then`/`metadata`).
// These read/write helpers edit those shared fields in addition to a kind's own
// form, preserving anything the editor doesn't surface (notably
// `metadata.__zigflow_id`, §2.3, and non-string metadata entries).

export interface DurationForm {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  milliseconds: string;
}

export interface CommonFieldsForm {
  /** `task.if` — a runtime expression guard. */
  if: string;
  /** JSON text for `input.schema`. */
  inputSchema: string;
  /** `output.as` — a jq expression string or an object (string-vs-object, like `set`). */
  outputAs: string;
  /** JSON text for `output.schema`. */
  outputSchema: string;
  exportAs: string;
  exportSchema: string;
  /** `metadata.heartbeat` — a Duration (integers only, per the schema). */
  heartbeat: DurationForm;
  /** Other `metadata` entries as plaintext string key/values (excludes id/heartbeat). */
  metadata: SetEntry[];
}

const EMPTY_DURATION_FORM: DurationForm = {
  days: '',
  hours: '',
  minutes: '',
  seconds: '',
  milliseconds: '',
};

/**
 * Validate/parse a JSON text field: blank is valid (→ undefined); otherwise it
 * must be valid JSON. Used for the `schema` sub-objects (arbitrary embeddable
 * JSON Schema documents) that don't warrant a structured form.
 */
export function parseJsonField(raw: string): {
  valid: boolean;
  value: unknown;
} {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { valid: true, value: undefined };
  }
  try {
    return { valid: true, value: JSON.parse(trimmed) };
  } catch {
    return { valid: false, value: undefined };
  }
}

/** Whether a JSON text field has content that doesn't parse (drives inline errors). */
export function isInvalidJsonField(raw: string): boolean {
  return !parseJsonField(raw).valid;
}

function formatJson(value: unknown): string {
  return value === undefined ? '' : JSON.stringify(value, null, 2);
}

function readDurationForm(duration: Duration | undefined): DurationForm {
  if (!duration) {
    return { ...EMPTY_DURATION_FORM };
  }
  return {
    days: durationField(duration.days),
    hours: durationField(duration.hours),
    minutes: durationField(duration.minutes),
    seconds: durationField(duration.seconds),
    milliseconds: durationField(duration.milliseconds),
  };
}

/**
 * Build a `Duration` from the heartbeat form. Only integer values are kept — the
 * schema's duration fields are integer-only (unlike `wait`'s expression-capable
 * durations), so an expression typed here is dropped rather than stored invalid.
 */
function buildIntegerDuration(form: DurationForm): Duration | undefined {
  const duration: Duration = {};
  const fields: ReadonlyArray<[keyof Duration, string]> = [
    ['days', form.days],
    ['hours', form.hours],
    ['minutes', form.minutes],
    ['seconds', form.seconds],
    ['milliseconds', form.milliseconds],
  ];
  for (const [field, raw] of fields) {
    const parsed = parseDurationField(raw);
    if (typeof parsed === 'number') {
      duration[field] = parsed;
    }
  }
  return Object.keys(duration).length > 0 ? duration : undefined;
}

function isEmptyObject(obj: object): boolean {
  return Object.keys(obj).length === 0;
}

/** Apply schema JSON to a container: blank removes it; invalid keeps the prior value. */
function applySchema(
  next: { schema?: Schema },
  raw: string,
  prior: Schema | undefined,
): void {
  const parsed = parseJsonField(raw);
  if (!parsed.valid) {
    // Don't lose the last valid schema while the user is mid-edit with bad JSON.
    if (prior !== undefined) {
      next.schema = prior;
    } else {
      delete next.schema;
    }
    return;
  }
  if (parsed.value === undefined) {
    delete next.schema;
  } else {
    // A fallback JSON field — the parsed value is the embedded schema document.
    next.schema = parsed.value as Schema;
  }
}

/** Set/clear an `as` field, reusing the `set`-value string-vs-object parse. */
function applyAs(
  next: { as?: string | Record<string, unknown> },
  raw: string,
): void {
  if (raw.trim() === '') {
    delete next.as;
  } else {
    next.as = parseSetValue(raw) as string | Record<string, unknown>;
  }
}

export function readCommonFields(task: TaskBase): CommonFieldsForm {
  return {
    if: task.if ?? '',
    inputSchema: formatJson(task.input?.schema),
    outputAs:
      task.output?.as === undefined ? '' : formatSetValue(task.output.as),
    outputSchema: formatJson(task.output?.schema),
    exportAs:
      task.export?.as === undefined ? '' : formatSetValue(task.export.as),
    exportSchema: formatJson(task.export?.schema),
    heartbeat: readDurationForm(task.metadata?.heartbeat),
    metadata: readMetadataEntries(task.metadata),
  };
}

/** Metadata entries the generic key/value list manages: string values, minus id/heartbeat. */
export function readMetadataEntries(
  metadata: TaskMetadata | undefined,
): SetEntry[] {
  if (!metadata) {
    return [];
  }
  return Object.entries(metadata)
    .filter(
      ([key, value]) =>
        key !== '__zigflow_id' &&
        key !== 'heartbeat' &&
        typeof value === 'string',
    )
    .map(([key, value]) => ({ key, value: value as string }));
}

export function writeMetadata(
  prior: TaskMetadata | undefined,
  heartbeat: DurationForm,
  entries: SetEntry[],
): TaskMetadata | undefined {
  const next: TaskMetadata = { ...(prior ?? {}) };
  // Drop the string-valued keys this editor manages; they're re-added from
  // `entries`. `__zigflow_id` (§2.3) and any non-string entries stay untouched.
  for (const [key, value] of Object.entries(prior ?? {})) {
    if (
      key !== '__zigflow_id' &&
      key !== 'heartbeat' &&
      typeof value === 'string'
    ) {
      delete next[key];
    }
  }
  for (const { key, value } of entries) {
    const trimmed = key.trim();
    if (
      trimmed === '' ||
      trimmed === '__zigflow_id' ||
      trimmed === 'heartbeat'
    ) {
      continue;
    }
    next[trimmed] = value;
  }
  const built = buildIntegerDuration(heartbeat);
  if (built) {
    next.heartbeat = built;
  } else {
    delete next.heartbeat;
  }
  return isEmptyObject(next) ? undefined : next;
}

function writeInput(
  prior: Input | undefined,
  schemaRaw: string,
): Input | undefined {
  const next: Input = { ...(prior ?? {}) };
  applySchema(next, schemaRaw, prior?.schema);
  return isEmptyObject(next) ? undefined : next;
}

function writeOutput(
  prior: Output | undefined,
  asRaw: string,
  schemaRaw: string,
): Output | undefined {
  const next: Output = { ...(prior ?? {}) };
  applyAs(next, asRaw);
  applySchema(next, schemaRaw, prior?.schema);
  return isEmptyObject(next) ? undefined : next;
}

function writeExport(
  prior: Export | undefined,
  asRaw: string,
  schemaRaw: string,
): Export | undefined {
  const next: Export = { ...(prior ?? {}) };
  applyAs(next, asRaw);
  applySchema(next, schemaRaw, prior?.schema);
  return isEmptyObject(next) ? undefined : next;
}

export function writeCommonFields<T extends TaskBase>(
  task: T,
  form: CommonFieldsForm,
): T {
  const next: T = { ...task };

  if (form.if.trim() !== '') {
    next.if = form.if;
  } else {
    delete next.if;
  }

  const input = writeInput(task.input, form.inputSchema);
  if (input) {
    next.input = input;
  } else {
    delete next.input;
  }

  const output = writeOutput(task.output, form.outputAs, form.outputSchema);
  if (output) {
    next.output = output;
  } else {
    delete next.output;
  }

  const exported = writeExport(task.export, form.exportAs, form.exportSchema);
  if (exported) {
    next.export = exported;
  } else {
    delete next.export;
  }

  const metadata = writeMetadata(task.metadata, form.heartbeat, form.metadata);
  if (metadata) {
    next.metadata = metadata;
  } else {
    delete next.metadata;
  }

  return next;
}

/**
 * Set/clear a task-level `then`. `continue` is the schema default, so selecting
 * it drops the property (keeping YAML minimal), matching the optional-field
 * convention used elsewhere.
 */
export function writeThen<T extends TaskBase>(task: T, value: string): T {
  const next: T = { ...task };
  if (value === 'continue') {
    delete next.then;
  } else {
    next.then = value;
  }
  return next;
}
