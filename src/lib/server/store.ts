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
import { FsWorkflowStore } from './workflowStore';
import type { WorkflowStore } from './workflowStore';

/**
 * The single process-wide workflow store used by the API routes. Reads
 * `ZIGFLOW_STORAGE_DIR` (default `./workflows`) at construction. Swap the
 * implementation here to change persistence without touching the routes.
 */
export const workflowStore: WorkflowStore = new FsWorkflowStore();
