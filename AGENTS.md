# Zigflow Studio

This repository contains **Zigflow Studio**, the visual workflow editor for Zigflow.

The editor is built using:

* NextJS
* TypeScript
* React
* Workflow Builder
* Zigflow JSON Schema
* Zigflow YAML

The purpose of the application is:

> Provide a visual-first authoring experience for Zigflow workflows while
> maintaining full compatibility with the Zigflow DSL.

The visual editor is an implementation detail.

The authoritative output is always valid Zigflow workflow YAML.

---

## Core principles

* Zigflow workflows are the source of truth
* Visual editing must map cleanly to Zigflow concepts
* Prefer explicit and understandable implementations
* Optimise for correctness over cleverness
* Optimise for maintainability over abstraction
* Developer experience matters
* Avoid unnecessary complexity

---

## Architecture principles

Workflow Builder provides:

* Canvas rendering
* Node rendering
* Inspector rendering
* Editor interactions

Zigflow Studio provides:

* Zigflow node definitions
* Zigflow validation
* Zigflow schema integration
* Zigflow YAML generation
* Zigflow-specific editor behaviour

Do not:

* Re-model Zigflow around Workflow Builder internals
* Introduce graph semantics that do not exist in Zigflow
* Treat Workflow Builder's internal model as the source of truth

The desired direction is:

```text
Zigflow concepts
        ↓
Studio model
        ↓
Workflow Builder
        ↓
Visual editor
```

not:

```text
Workflow Builder
        ↓
Generic graph
        ↓
Attempt to convert into Zigflow
```

---

## Current product scope

The initial focus is workflow authoring.

Expected capabilities include:

* Create workflows visually
* Edit workflow configuration
* Import Zigflow workflows
* Export Zigflow YAML
* Validate workflows
* Preview generated YAML

Capabilities should be implemented only when required.

Do not add speculative features.

Examples of speculative features:

* Real-time collaboration
* Multi-user editing
* Workflow execution
* Workflow deployment
* Workflow monitoring
* AI-assisted authoring

These may be added later but should not influence current architecture.

---

## TypeScript

* TypeScript is required
* Prefer explicit types at module boundaries
* Avoid `any`
* If `any` is unavoidable, document why

---

## React and NextJS

* Prefer React function components
* Prefer composition over inheritance
* Avoid unnecessary abstraction
* Keep components focused and understandable

When creating React components:

* Keep rendering concerns separate from Zigflow logic
* Keep business logic outside UI components where practical
* Avoid large monolithic components

---

## Workflow Builder

Workflow Builder is the canonical editor framework.

Use Workflow Builder primitives wherever practical.

Do not:

* Reimplement Workflow Builder functionality
* Fork Workflow Builder patterns without justification
* Build replacement canvas functionality

Customisation should be achieved through Workflow Builder extension points whenever
possible.

---

## Zigflow integration

Zigflow Studio must remain aligned with:

* Zigflow schema
* Zigflow YAML structure
* Zigflow execution semantics

If a visual behaviour conflicts with Zigflow semantics:

* Zigflow semantics win

The editor should adapt to Zigflow, not the other way around.

---

## Validation

Validation must be:

* Deterministic
* Understandable
* User-friendly

Validation errors should:

* Explain the problem clearly
* Identify the relevant workflow element
* Be suitable for display in the editor UI

---

## Performance

Performance matters.

Avoid:

* Unnecessary re-renders
* Rebuilding large objects during render
* Excessive state duplication
* Expensive operations on every interaction

Prefer:

* Memoisation when appropriate
* Stable object references
* Incremental updates

---

## Dependencies

Before adding a dependency:

* Confirm the functionality is genuinely required
* Prefer existing project dependencies
* Prefer maintained and widely-used libraries

Avoid dependency sprawl.

---

## Testing

Where practical:

* Add tests for Zigflow-specific logic
* Add tests for YAML generation
* Add tests for validation behaviour

Focus testing effort on correctness of workflow behaviour rather than visual appearance.

---

## Formatting and linting

Do not fight project tooling.

Before completing work:

```bash
npm run format
npm run lint
npm test
npm run build
```

Fix code rather than disabling rules.

---

## When unsure

If requirements are ambiguous:

* Ask
* Prefer explicit implementations
* Prefer smaller changes
* Leave clear TODOs rather than guessing

Clarity beats cleverness.

Correctness beats speed.
