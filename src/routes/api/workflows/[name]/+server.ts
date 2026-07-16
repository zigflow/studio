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
import { ensureTaskIds, syncWorkflowType } from '$lib/graph/mutations';
import { validateWorkflow } from '$lib/schema/validate';
import { workflowStore } from '$lib/server/store';
import {
  UnsafeWorkflowNameError,
  WorkflowNotFoundError,
} from '$lib/server/workflowStore';
import type { ZigflowWorkflow } from '$lib/types/zigflow';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

function badName(err: unknown): Response | null {
  if (err instanceof UnsafeWorkflowNameError) {
    return json({ message: err.message }, { status: 400 });
  }
  return null;
}

/**
 * GET /api/workflows/[name] — load a workflow.
 *
 * Runs {@link ensureTaskIds} once after loading (DESIGN.md §2.3) so hand-authored
 * or third-party YAML with no ids gets identity assigned before it reaches the
 * client. Ids are persisted on the next save, not here — GET stays side-effect
 * free on disk.
 */
export const GET: RequestHandler = async ({ params }) => {
  const { name } = params;
  try {
    const workflow = await workflowStore.load(name);
    ensureTaskIds(workflow);
    return json(workflow);
  } catch (err) {
    if (err instanceof WorkflowNotFoundError) {
      return json({ message: err.message }, { status: 404 });
    }
    const named = badName(err);
    if (named) {
      return named;
    }
    throw err;
  }
};

/**
 * PUT /api/workflows/[name] — save (create or replace) a workflow.
 *
 * Derives `workflowType` ({@link syncWorkflowType}), assigns ids to any new tasks
 * ({@link ensureTaskIds}), then validates before writing (DESIGN.md §4). Invalid
 * documents are rejected with structured 422 errors and never written to disk.
 */
export const PUT: RequestHandler = async ({ params, request }) => {
  const { name } = params;

  let workflow: ZigflowWorkflow;
  try {
    workflow = await request.json();
  } catch {
    return json(
      { message: 'Request body must be valid JSON.' },
      { status: 400 },
    );
  }

  if (workflow === null || typeof workflow !== 'object') {
    return json(
      { message: 'Request body must be a workflow object.' },
      { status: 400 },
    );
  }

  ensureTaskIds(workflow);
  syncWorkflowType(workflow);

  const result = validateWorkflow(workflow);
  if (!result.valid) {
    return json(
      { message: 'Workflow failed schema validation.', errors: result.errors },
      { status: 422 },
    );
  }

  try {
    await workflowStore.save(name, workflow);
  } catch (err) {
    const named = badName(err);
    if (named) {
      return named;
    }
    throw err;
  }
  return json(workflow);
};

/** DELETE /api/workflows/[name] — delete a workflow. */
export const DELETE: RequestHandler = async ({ params }) => {
  const { name } = params;
  try {
    await workflowStore.remove(name);
  } catch (err) {
    if (err instanceof WorkflowNotFoundError) {
      return json({ message: err.message }, { status: 404 });
    }
    const named = badName(err);
    if (named) {
      return named;
    }
    throw err;
  }
  return new Response(null, { status: 204 });
};
