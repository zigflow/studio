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
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import type { ZigflowWorkflow } from '../types/zigflow';
import { parseWorkflowYaml, stringifyWorkflowYaml } from '../yaml/serialize';

/**
 * Workflow persistence (DESIGN.md §5.1).
 *
 * `FsWorkflowStore` reads/writes `<ZIGFLOW_STORAGE_DIR>/<project>/workflow.yaml`.
 * Persistence beyond this interface is the operator's concern (e.g. a Kubernetes
 * PVC behind the env var). The interface is the seam a future S3-backed store, or
 * a store that also triggers a Git push on publish, plugs into without touching
 * the API routes.
 */
export interface WorkflowStore {
  /** List the names of all stored workflows. */
  list(): Promise<string[]>;
  /** Load a workflow by name. Throws {@link WorkflowNotFoundError} if absent. */
  load(name: string): Promise<ZigflowWorkflow>;
  /** Write a workflow, creating its project directory if needed. */
  save(name: string, workflow: ZigflowWorkflow): Promise<void>;
  /** Delete a workflow. Throws {@link WorkflowNotFoundError} if absent. */
  remove(name: string): Promise<void>;
  /** Report whether a workflow with this name exists. */
  exists(name: string): Promise<boolean>;
}

/** Thrown when a workflow name could be used for path traversal or is malformed. */
export class UnsafeWorkflowNameError extends Error {
  constructor(name: string) {
    super(`Unsafe workflow name: ${JSON.stringify(name)}`);
    this.name = 'UnsafeWorkflowNameError';
  }
}

/** Thrown when a workflow does not exist. */
export class WorkflowNotFoundError extends Error {
  constructor(name: string) {
    super(`Workflow not found: ${name}`);
    this.name = 'WorkflowNotFoundError';
  }
}

const DEFAULT_STORAGE_DIR = './workflows';
const WORKFLOW_FILE = 'workflow.yaml';

// A safe project/workflow name: starts alphanumeric, then alphanumerics, dashes,
// or underscores. This forbids `/`, `.`, `..`, and empty names by construction,
// so no name can escape the storage directory.
const SAFE_NAME = /^[a-zA-Z0-9](?:[a-zA-Z0-9_-]{0,61}[a-zA-Z0-9])?$/;

function assertSafeName(name: string): void {
  if (!SAFE_NAME.test(name)) {
    throw new UnsafeWorkflowNameError(name);
  }
}

function isEnoent(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

export class FsWorkflowStore implements WorkflowStore {
  readonly #root: string;

  /**
   * @param storageDir Base directory. Defaults to `ZIGFLOW_STORAGE_DIR`, then
   *   `./workflows`.
   */
  constructor(
    storageDir = process.env.ZIGFLOW_STORAGE_DIR ?? DEFAULT_STORAGE_DIR,
  ) {
    this.#root = path.resolve(storageDir);
  }

  #fileFor(name: string): string {
    assertSafeName(name);
    return path.join(this.#root, name, WORKFLOW_FILE);
  }

  async list(): Promise<string[]> {
    let entries;
    try {
      entries = await readdir(this.#root, { withFileTypes: true });
    } catch (err) {
      if (isEnoent(err)) {
        return [];
      }
      throw err;
    }

    const names: string[] = [];
    for (const entry of entries) {
      if (entry.isDirectory() && SAFE_NAME.test(entry.name)) {
        names.push(entry.name);
      }
    }
    names.sort();
    return names;
  }

  async load(name: string): Promise<ZigflowWorkflow> {
    const file = this.#fileFor(name);
    let text;
    try {
      text = await readFile(file, 'utf8');
    } catch (err) {
      if (isEnoent(err)) {
        throw new WorkflowNotFoundError(name);
      }
      throw err;
    }
    return parseWorkflowYaml(text) as ZigflowWorkflow;
  }

  async save(name: string, workflow: ZigflowWorkflow): Promise<void> {
    const file = this.#fileFor(name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, stringifyWorkflowYaml(workflow), 'utf8');
  }

  async remove(name: string): Promise<void> {
    assertSafeName(name);
    const dir = path.join(this.#root, name);
    try {
      await rm(dir, { recursive: true });
    } catch (err) {
      if (isEnoent(err)) {
        throw new WorkflowNotFoundError(name);
      }
      throw err;
    }
  }

  async exists(name: string): Promise<boolean> {
    try {
      await readFile(this.#fileFor(name), 'utf8');
      return true;
    } catch (err) {
      if (isEnoent(err)) {
        return false;
      }
      throw err;
    }
  }
}
