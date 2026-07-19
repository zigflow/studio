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
import { UnsafeWorkflowNameError } from '$lib/server/workflowStore';
import type { ZigflowWorkflow } from '$lib/types/zigflow';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

/**
 * GET /api/workflows — list stored workflows for the project list (DESIGN.md §6).
 *
 * Each entry carries both the routing/directory `name` (still used to build
 * links and URLs — DESIGN.md §6) and the resolved `displayName`
 * (`document.title || document.workflowType`, never the directory name). The
 * document is loaded via the store (no YAML parsing duplicated here). A workflow
 * that fails to load falls back to its directory name so one broken project
 * doesn't break the whole list.
 */
export const GET: RequestHandler = async () => {
  const names = await workflowStore.list();
  const workflows = await Promise.all(
    names.map(async (name) => {
      try {
        const { document } = await workflowStore.load(name);
        return { name, displayName: document.title || document.workflowType };
      } catch {
        return { name, displayName: name };
      }
    }),
  );
  return json({ workflows });
};

interface CreateBody {
  name?: unknown;
  taskQueue?: unknown;
  version?: unknown;
  dsl?: unknown;
}

/**
 * POST /api/workflows — create a new workflow.
 *
 * New projects use the always-multi-workflow `do` shape (DESIGN.md §1.2):
 * `do: [{ <name>: { do: [] } }]`. `workflowType` is derived from the first `do`
 * entry via {@link syncWorkflowType}, so it always tracks the workflow name.
 */
export const POST: RequestHandler = async ({ request }) => {
  let body: CreateBody;
  try {
    body = await request.json();
  } catch {
    return json(
      { message: 'Request body must be valid JSON.' },
      { status: 400 },
    );
  }

  const { name } = body;
  if (typeof name !== 'string' || name === '') {
    return json({ message: 'A workflow "name" is required.' }, { status: 400 });
  }

  const taskQueue = typeof body.taskQueue === 'string' ? body.taskQueue : name;
  const version = typeof body.version === 'string' ? body.version : '0.0.1';
  const dsl = typeof body.dsl === 'string' ? body.dsl : '1.0.0';

  let exists: boolean;
  try {
    exists = await workflowStore.exists(name);
  } catch (err) {
    if (err instanceof UnsafeWorkflowNameError) {
      return json({ message: err.message }, { status: 400 });
    }
    throw err;
  }
  if (exists) {
    return json(
      { message: `A workflow named "${name}" already exists.` },
      { status: 409 },
    );
  }

  const workflow: ZigflowWorkflow = {
    document: { dsl, taskQueue, workflowType: name, version },
    do: [{ [name]: { do: [] } }],
  };
  ensureTaskIds(workflow);
  syncWorkflowType(workflow);

  const result = validateWorkflow(workflow);
  if (!result.valid) {
    return json(
      { message: 'Workflow failed schema validation.', errors: result.errors },
      { status: 422 },
    );
  }

  await workflowStore.save(name, workflow);
  return json(workflow, { status: 201 });
};
