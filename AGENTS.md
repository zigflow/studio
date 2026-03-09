# AGENTS.md

This document is the canonical engineering guide for **Zigflow Studio**. It is
written for AI coding assistants such as Claude Code, Codex, Cursor, and Gemini
CLI, but it applies equally to human contributors.

Read it before making changes. If a request conflicts with the guidance here,
raise the conflict rather than silently choosing one over the other.

## Table of contents

<!-- toc -->

* [About the project](#about-the-project)
* [Project goals](#project-goals)
* [Coding philosophy](#coding-philosophy)
* [Architecture](#architecture)
* [Workflow modelling](#workflow-modelling)
* [Validation](#validation)
* [Editor architecture](#editor-architecture)
* [Serialisation](#serialisation)
* [Svelte](#svelte)
  * [Svelte MCP server](#svelte-mcp-server)
  * [Svelte MCP instructions](#svelte-mcp-instructions)
* [Testing](#testing)
* [Dependencies](#dependencies)
* [Security](#security)
* [Documentation](#documentation)
* [Code quality](#code-quality)
  * [TypeScript](#typescript)
  * [Formatting and linting](#formatting-and-linting)
  * [Pre-commit hooks](#pre-commit-hooks)
* [Git workflow](#git-workflow)
* [When in doubt](#when-in-doubt)

<!-- Regenerate with "pre-commit run -a markdown-toc" -->

<!-- tocstop -->

## About the project

Zigflow Studio is a visual editor for Zigflow workflows. It is a SvelteKit
application written in TypeScript.

Zigflow is an open source workflow DSL built on top of Temporal. It lets people
build durable, long-running business workflows declaratively rather than writing
workflow code by hand. Temporal is the runtime. Zigflow is the product, and the
Studio is the tool people use to author Zigflow.

Keep this distinction in mind throughout the codebase. We model Zigflow
concepts, and Temporal is an implementation detail of how those workflows
eventually run. Studio code should almost never reference Temporal APIs
directly.

## Project goals

Zigflow Studio helps people:

* create workflows visually, without writing DSL by hand
* understand how a workflow behaves, including its branches and failure paths
* validate workflows and surface problems early
* import and export workflows in the canonical Zigflow format
* evolve workflows over time, including safe changes to existing definitions
* understand errors before deployment rather than after a failed run

The Studio is more than a node editor or a diagramming tool. A diagram is one
view of the underlying workflow model. The value is in the model, the
validation, and the guidance we give users, not in the pixels on the canvas.

Design decisions should serve these goals. When a change makes the canvas
prettier but the model weaker, prefer the model.

## Coding philosophy

We favour code that the next person can read and change with confidence. The
guidance below is opinionated but not dogmatic. Where a rule does not fit, say
so and explain why.

* **Readability over cleverness.** Optimise for the reader, not the author. A
  longer, obvious solution beats a terse, surprising one.
* **Explicitness over magic.** Avoid hidden control flow, implicit globals, and
  behaviour that depends on load order. Make dependencies visible.
* **Composition over inheritance.** Build behaviour from small, combinable
  functions and components rather than deep class hierarchies.
* **Avoid premature optimisation.** Write clear code first. Optimise only when a
  measurement shows a real problem, and record the measurement.
* **Make invalid states hard to represent.** Use the type system so that
  impossible combinations do not compile. This is the single highest-leverage
  habit in this codebase.
* **Fail fast with useful errors.** Detect problems at the earliest point and
  report them with enough context to act on. A good error names what was
  expected, what was found, and where.
* **Small focused functions.** A function should do one thing. If you struggle
  to name it, it probably does too much.
* **Avoid unrelated refactoring.** Keep each change focused on its stated
  purpose. Note opportunistic cleanups separately rather than bundling them in.
* **Challenge assumptions.** Do not agree by default. If a request looks wrong,
  risky, or underspecified, push back and explain your reasoning.
* **Explain trade-offs.** When more than one reasonable approach exists, state
  the options and why you chose one.
* **Ask rather than invent.** If a requirement is missing, ask a question. Do
  not guess at product behaviour and build on the guess.

## Architecture

The guiding rule is a hard separation between the workflow model and everything
that renders or edits it.

```text
+---------------------------------------------------------------+
|                          UI layer                             |
|   SvelteKit routes, Svelte 5 components, canvas rendering      |
+---------------------------------------------------------------+
|                       Application layer                       |
|   editor state, commands, undo/redo, selection, view models   |
+---------------------------------------------------------------+
|                         Domain layer                          |
|   workflow model, validation, serialisation, pure functions   |
+---------------------------------------------------------------+
```

Suggested layout:

* `src/lib/domain/` holds the workflow model, validation, and serialisation.
  This code is pure TypeScript with no Svelte, no DOM, and no canvas imports.
* `src/lib/editor/` holds application state and the commands that mutate it. It
  depends on the domain layer but not on any specific rendering library.
* `src/lib/components/` holds Svelte components and the canvas implementation.
* `src/routes/` holds SvelteKit routes and page composition.

Rules that keep the architecture honest:

* The domain layer must not import from the editor or UI layers. Dependencies
  point downward only.
* Business logic lives in the domain or application layers, never inside Svelte
  components. Components render state and dispatch intent.
* The canvas library is replaceable. Treat it as a rendering detail behind a
  small interface, so that swapping it does not touch the domain layer.
* Keep abstraction minimal. Introduce an interface or a layer when a second
  concrete case exists, not in anticipation of one.

## Workflow modelling

The workflow model is the heart of the product. Model it explicitly and let the
type system do the work.

* Model the domain in TypeScript first. The types are the specification. Get the
  shape of a workflow right before building UI on top of it.
* Use discriminated unions for anything with variants. Every workflow step,
  every validation result, and every editor command should carry a literal
  `kind` or `type` discriminant.
* Prefer readonly data and immutable updates in the domain layer. Mutation
  belongs in the application layer, applied through explicit commands.
* Make invalid states unrepresentable. If a step type cannot have children,
  its type should not carry a `children` field at all.
* Keep the model independent of Temporal and independent of the canvas. The
  model describes what a Zigflow workflow is, not how it renders or runs.

A discriminated union for steps might look like this.

```ts
export type StepId = string & { readonly __brand: 'StepId' };

export type Step =
  | { kind: 'activity'; id: StepId; name: string; timeoutSeconds: number }
  | { kind: 'condition'; id: StepId; expression: string; branches: Branch[] }
  | { kind: 'parallel'; id: StepId; children: StepId[] }
  | { kind: 'wait'; id: StepId; durationSeconds: number };
```

Branding identifiers, as with `StepId` above, prevents mixing an identifier for
one entity with another. It costs little and catches real mistakes.

When you add a new step type, add its variant to the union first. The compiler
will then point you at every place that needs to handle it, including
validation, serialisation, and rendering. Rely on exhaustive `switch` statements
with a `never` fallback so that a missing case fails to compile.

## Validation

Validation is a core feature, not an afterthought. The Studio exists partly to
help users understand errors before deployment.

* Validation lives in the domain layer as pure functions. Given a workflow, it
  returns a list of results. It does not touch the DOM, throw for expected
  problems, or depend on editor state.
* Model results as discriminated unions with a severity, for example `error`,
  `warning`, and `info`. Each result should carry a machine-readable code, a
  human-readable message, and a reference to the affected part of the workflow.
* Validate structure, references, and semantics. Check that referenced steps
  exist, that there are no unreachable steps, that branches are exhaustive where
  required, and that cycles are intentional.
* Distinguish errors that block export from warnings that suggest improvement.
  Users should be able to keep working while warnings are present.
* Prefer many small validators composed into one pass over a single large
  function. Each validator should be independently testable.

Every validation result must be actionable. If we cannot tell the user what to
do about a problem, the validator needs more thought.

## Editor architecture

The editor is the application layer that sits between the pure domain model and
the Svelte UI.

* Hold editor state with Svelte 5 runes. Use `$state` for mutable state and
  `$derived` for computed values. Keep derivations pure.
* Model user actions as explicit commands. A command takes the current state and
  produces the next state. This makes undo and redo tractable and keeps mutation
  in one place.
* Keep view models separate from the domain model. The canvas may need layout
  coordinates, selection state, and collapsed or expanded flags that do not
  belong in the workflow definition. Derive these from the domain model rather
  than polluting it.
* Selection, hover, drag state, and viewport are UI concerns. They must not leak
  into serialised workflows.
* Undo and redo should operate on domain-level commands, not on raw canvas
  events, so that history is meaningful to the user.

The canvas renders view models and emits intent. It should not know how to
mutate the workflow. When the user drags a node, the canvas reports the intent,
and a command applies the change to the model.

## Serialisation

Import and export are how workflows leave and enter the Studio. Treat the
serialised format as a contract.

* The canonical serialised form is the Zigflow workflow format. The Studio reads
  and writes that format. It does not invent a private format for storage.
* Never trust imported data. Parse and validate it at the boundary before it
  enters the domain model. Reject malformed input with clear, specific errors.
* Separate parsing from validation from domain construction. Parse untrusted
  input into a typed shape, validate that shape, then build the domain model.
* Keep view-only state, such as node positions, out of the workflow definition
  unless the Zigflow format defines a place for it. If layout must be persisted,
  store it in a clearly separate section or file.
* Version the format handling. When the format changes, provide a migration path
  and keep old imports working where practical. Round-tripping a workflow
  through export and import must not lose or corrupt data.

Round-trip tests are the most valuable tests for serialisation. Import a
workflow, export it, and assert that the result is equivalent.

## Svelte

Zigflow Studio uses Svelte 5 and SvelteKit. Follow these rules for all Svelte
code.

* Use Svelte 5.
* Use runes (`$state`, `$derived`, `$effect`, `$props`, and friends).
* Avoid legacy Svelte syntax. Do not use `export let` for props, the reactive
  `$:` label, `on:` event directives where the modern equivalent exists, or
  stores where a rune is a better fit.
* Use the Svelte MCP documentation tools before implementing Svelte-specific
  functionality. Check the current documentation rather than relying on memory,
  because Svelte 5 changed a great deal.
* Run the Svelte autofixer after modifying any Svelte code, and keep calling it
  until it reports no issues.

### Svelte MCP server

The official Svelte MCP server provides live Svelte 5 and SvelteKit
documentation and an autofixer. Its endpoint is:

```text
https://mcp.svelte.dev/mcp
```

You can configure it automatically with:

```sh
npx sv add mcp
```

An MCP client configuration looks like this. Adjust the surrounding structure to
match your specific tool.

```json
{
  "mcpServers": {
    "svelte": {
      "type": "http",
      "url": "https://mcp.svelte.dev/mcp"
    }
  }
}
```

### Svelte MCP instructions

The following block is the official guidance for using the Svelte MCP server.
Treat it as part of this document.

```text
You are able to use the Svelte MCP server, where you have access to
comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the
available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections
Use this FIRST to discover all available documentation sections. Returns a
structured list with titles, use_cases, and paths. Only after calling this
tool you will be able to make an educated decision about which documentation
sections are relevant to the user's task.

### 2. get-documentation
Retrieves full documentation content for specific sections. Accepts single or
multiple sections. After calling the list-sections tool, you MUST analyze the
returned documentation sections (especially the use_cases field) and then use
the get-documentation tool to fetch ALL documentation sections that are
relevant for the users task.

### 3. svelte-autofixer
Analyzes Svelte code and returns issues and suggestions. You MUST use this tool
whenever writing Svelte code before sending it to the user. Keep calling it
until no issues or suggestions are returned.

### 4. playground-link
Generates a Svelte Playground link with the provided code. After completing the
code, ask the user if they want a playground link. Only call this tool after
user confirmation and NEVER if the code was written to files in their project.
```

## Testing

Tests should give confidence that the model and its transformations are correct.

* Test the domain layer hardest. Pure functions for validation and
  serialisation are cheap to test and catch the most damaging bugs.
* Prefer unit tests for pure logic and component tests for UI behaviour. Reserve
  end-to-end tests for the flows that matter most, such as import, edit, and
  export.
* Write round-trip tests for serialisation, as described above.
* Test behaviour, not implementation detail. A test that breaks on every
  refactor is a liability.
* When you fix a bug, add a test that fails before the fix and passes after it.
* Keep tests deterministic. Avoid real timers, real network calls, and reliance
  on wall-clock time.

New domain logic should arrive with tests. UI-only changes may lean on component
tests and manual verification, but shared logic must be covered.

## Dependencies

Every dependency is a long-term commitment and a security surface. Add them
sparingly.

* Prefer the standard library and small, well-understood utilities over large
  frameworks that pull in a wide tree.
* Before adding a dependency, ask whether a short, clear piece of code would do
  instead. Often it will.
* Judge a candidate on its maintenance status, size, licence, transitive
  dependencies, and fit. Note the reasoning in the pull request.
* Keep the domain layer dependency-free where practical. It should be plain
  TypeScript so that it stays portable and easy to test.
* Do not add a dependency to save a few lines in one place. The cost is the
  whole tree, forever.

`engine-strict` is enabled through `.npmrc`, so respect the declared engine
range and do not widen it casually.

## Security

The Studio handles workflow definitions that may come from untrusted sources.
Treat all external input as hostile until validated.

* Validate and sanitise every import at the boundary. Never feed unvalidated
  input into the domain model.
* Never evaluate user-supplied expressions with `eval`, `new Function`, or
  similar. If Zigflow expressions need evaluation, use a safe, sandboxed
  evaluator, and keep it well away from the DOM.
* Avoid `{@html}` in Svelte unless the content is trusted and sanitised. Prefer
  text bindings that escape automatically.
* Keep secrets out of the repository and out of client-side code. The Studio is
  a client application, so anything shipped to the browser is public.
* Report vulnerabilities through the process in `SECURITY.md`. Do not disclose
  them in public issues.

The `scan` task in `Taskfile.yml` runs Trivy against the container image and
Helm chart. Do not introduce high or critical findings.

## Documentation

Documentation is part of the change, not a follow-up.

* Update this file when engineering practices change.
* Document the workflow model and the serialisation format where they live, so
  the docs sit next to the code they describe.
* Write doc comments for non-obvious domain logic. Explain why, not what. The
  code already says what it does.
* Keep the `README.md` accurate about the current state of the project.
* Prefer runnable examples over prose where an example is clearer.

## Code quality

The repository enforces a consistent style through tooling. Match it rather than
fighting it.

### TypeScript

* Use strict TypeScript. Do not disable strictness to make an error go away.
* Avoid `any`. Reach for `unknown` at boundaries and narrow it explicitly. If
  you genuinely need an escape hatch, isolate it and comment why.
* Do not use non-null assertions (`!`) to silence the compiler. Handle the
  nullable case.
* Prefer `type` aliases and discriminated unions for domain shapes. Use
  exhaustive `switch` statements with a `never` default to catch missing cases
  at compile time.
* Keep functions pure where practical. Push side effects to the edges.

### Formatting and linting

* Prettier formats the code. The configuration uses single quotes, trailing
  commas, and an 80-column print width, with import sorting through the Trivago
  plugin. Run `npm run format` rather than formatting by hand.
* ESLint runs over `*.js`, `*.jsx`, `*.ts`, `*.tsx`, and `*.svelte`. Fix
  warnings rather than suppressing them. If a rule is genuinely wrong for a
  case, disable it inline with a comment explaining why.
* Markdown is linted with markdownlint, and tables of contents are generated
  automatically. Do not edit generated sections by hand.
* Indentation is two spaces, files use LF endings and end with a newline, per
  `.editorconfig`.

### Pre-commit hooks

The repository uses `pre-commit` with hooks for licence headers, JSON and YAML
checks, trailing whitespace, conventional commits, markdown linting, ESLint,
formatting, and a secret scan. Install the hooks and let them run. Do not bypass
them with `--no-verify`.

New source files need the licence header that `license-eye` expects. Copy the
header from an existing file of the same type.

## Git workflow

These Git rules are strict. Follow them exactly.

* **Never run `git add`.**
* **Never stage changes automatically.**
* **Never commit unless the user explicitly instructs you to.**
* **Never push unless the user explicitly instructs you to.**

Leave the working tree with unstaged changes so the user can review them. When
your work is done, summarise what changed and let the user decide what to stage
and commit.

When the user does ask for a commit:

* Follow Conventional Commits. The repository enforces this through commitlint
  and a commit-message hook, so a malformed message will be rejected.
* Use a type such as `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, or
  `build`, followed by an optional scope and a short, imperative summary.
* Keep the subject concise and put detail in the body. Explain why the change
  was made, not only what changed.

Work in small, incremental steps. Prefer a series of focused changes over one
large change, and keep each diff as small as the task allows.

## When in doubt

* Prefer the smallest change that solves the problem.
* Keep the workflow model clean and let the UI adapt to it.
* Make invalid states impossible before writing code that guards against them.
* Ask a question rather than inventing a requirement.
* If something here is wrong or out of date, say so and propose a fix.
