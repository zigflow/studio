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

/**
 * Zigflow workflow model (DESIGN.md §2.1).
 *
 * These types mirror the Open Workflow Specification (OWS) almost exactly, with
 * the single Zigflow divergence in the `document` block (see §2.2 and
 * {@link ZigflowDocumentMeta}). They are hand-written here because package
 * registry access was not available at authoring time.
 *
 * IMPORTANT: in an environment with registry access these should ideally be
 * generated/imported from `@open-workflow-specification/sdk-typescript` instead
 * of hand-maintained. Nothing in the graph/mutation/store layers should depend
 * on *how* these types are produced, only on their shape, so swapping the source
 * is a types-only change.
 *
 * The `Task` union is discriminated *structurally* — by which task-kind key is
 * present (`call`, `do`, `for`, ...) — rather than by an explicit `kind` field,
 * because that is the OWS wire shape the model must round-trip losslessly.
 */

/** A runtime expression, e.g. `${ .order.total }` (schema: `runtimeExpression`). */
export type RuntimeExpression = string;

/** A flow directive: a built-in outcome or the name of a sibling task (goto). */
export type FlowDirective = 'continue' | 'exit' | 'end' | (string & {});

/** A relative duration. Every field is optional but at least one is required. */
export interface Duration {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
}

/** A duration whose numeric fields may also be runtime expressions (used by `wait`). */
export interface ExpressionDuration {
  days?: number | RuntimeExpression;
  hours?: number | RuntimeExpression;
  minutes?: number | RuntimeExpression;
  seconds?: number | RuntimeExpression;
  milliseconds?: number | RuntimeExpression;
}

/** A schema definition attached to input/output (schema: `schema`). */
export interface Schema {
  format?: string;
  document?: unknown;
}

export interface Input {
  schema?: Schema;
  [key: string]: unknown;
}

export interface Output {
  as?: string | Record<string, unknown>;
  schema?: Schema;
  [key: string]: unknown;
}

export interface Export {
  as?: string | Record<string, unknown>;
  schema?: Schema;
}

/**
 * Task metadata. `__zigflow_id` is the system-generated node identity the editor
 * relies on to track a task across rename/reorder/reload (DESIGN.md §2.3).
 */
export interface TaskMetadata {
  __zigflow_id?: string;
  heartbeat?: Duration;
  [key: string]: unknown;
}

/** Fields inherited by every task (schema: `taskBase`). */
export interface TaskBase {
  if?: RuntimeExpression;
  input?: Input;
  output?: Output;
  export?: Export;
  then?: FlowDirective;
  metadata?: TaskMetadata;
}

/** `call: activity` arguments. */
export interface CallActivityTask extends TaskBase {
  call: 'activity';
  with: {
    name: string;
    taskQueue: string;
    arguments?: unknown[];
  };
}

/** `call: grpc` arguments. */
export interface CallGrpcTask extends TaskBase {
  call: 'grpc';
  with: {
    proto: unknown;
    service: { name: string; host: string; port?: number };
    method: string;
    arguments?: Record<string, unknown>;
  };
}

/** `call: http` arguments. */
export interface CallHttpTask extends TaskBase {
  call: 'http';
  with: {
    method: string;
    endpoint: Endpoint;
    body?: unknown;
    headers?: Record<string, string> | RuntimeExpression;
    query?: Record<string, string> | RuntimeExpression;
    output?: 'raw' | 'content' | 'response';
    redirect?: boolean;
  };
}

/** An endpoint reference (schema: `endpoint`). */
export type Endpoint =
  RuntimeExpression | string | { uri: string | RuntimeExpression };

export type CallTask = CallActivityTask | CallGrpcTask | CallHttpTask;

/** `do`: run a list of tasks in sequence. */
export interface DoTask extends TaskBase {
  do: TaskList;
}

/** `for`: iterate over a collection, running `do` for each item. */
export interface ForTask extends TaskBase {
  for: {
    in: RuntimeExpression;
    each?: string;
    at?: string;
  };
  while?: RuntimeExpression;
  do: TaskList;
}

/** `fork`: run branches concurrently. */
export interface ForkTask extends TaskBase {
  fork: {
    branches: TaskList;
    compete?: boolean;
  };
}

/** `listen`: await external event(s). */
export interface ListenTask extends TaskBase {
  listen: {
    to: unknown;
    read?: 'data' | 'envelope' | 'raw';
  };
}

/** `raise`: intentionally raise an error. */
export interface RaiseTask extends TaskBase {
  raise: {
    error: unknown | string;
  };
}

/** `run`: execute a container, script, shell command, or sub-workflow. */
export interface RunTask extends TaskBase {
  run: Record<string, unknown>;
}

/** `set`: assign data into the workflow context. */
export interface SetTask extends TaskBase {
  set: Record<string, unknown> | RuntimeExpression;
}

/** A single case within a `switch` task. */
export interface SwitchCase {
  when?: RuntimeExpression;
  then: FlowDirective;
}

/** `switch`: conditional branching. Each item is a single-key `{ caseName: case }`. */
export interface SwitchTask extends TaskBase {
  switch: Array<Record<string, SwitchCase>>;
}

/** `try`/`catch`: run tasks, catching and handling errors. */
export interface TryTask extends TaskBase {
  try: TaskList;
  catch: {
    do: TaskList;
    as?: string;
  };
}

/** `wait`: pause for a duration or until an absolute time. */
export interface WaitTask extends TaskBase {
  wait: ExpressionDuration | { until: string | RuntimeExpression };
}

/** The union of all 11 Zigflow task kinds (schema: `task`). */
export type Task =
  | CallTask
  | DoTask
  | ForTask
  | ForkTask
  | ListenTask
  | RaiseTask
  | RunTask
  | SetTask
  | SwitchTask
  | TryTask
  | WaitTask;

/** A `{ [name]: Task }` map — exactly one entry, as enforced by the schema. */
export type NamedTask = Record<string, Task>;

/** An ordered list of named tasks. Array order is execution order (DESIGN.md §1.1). */
export type TaskList = NamedTask[];

/**
 * The Zigflow `document` block (schema: `document`).
 *
 * Diverges from OWS in two field names only (DESIGN.md §2.2): OWS's `namespace`
 * is Zigflow's `taskQueue`, and OWS's `name` is Zigflow's `workflowType`.
 */
export interface ZigflowDocumentMeta {
  dsl: string;
  taskQueue: string;
  workflowType: string;
  version: string;
  title?: string;
  summary?: string;
  tags?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/** A complete Zigflow workflow definition (schema root). */
export interface ZigflowWorkflow {
  document: ZigflowDocumentMeta;
  do: TaskList;
  input?: Input;
  output?: Output;
  schedule?: {
    cron?: string;
    every?: Duration;
  };
}
