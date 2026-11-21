# WarpEngine Toolbox

`README.md` is the user guide, `STRUCTURE.md` the layers and the naming of this
repo (it is also a guide of the published reference, so it stays a file of its
own). The rules shared with the other WarpEngine TypeScript tools are the
`typescript/layered` styleguide of the ttg-styleguide plugin (tools/ttg-marketplace),
switched on in `.styleguide.json`. The API
reference is the TypeDoc published to the wiki at
https://wiki.teletypegames.org/typedoc/warp-engine-toolbox/latest/ on every
`vX.Y.Z` tag, with a *Commands & Settings* page generated from `package.json`.

## Documenting code: write for TypeDoc

The code keeps no explanatory comments inside function bodies. The exception is
the TSDoc comment: the reference is generated from `src/`, and CI fails below
100% coverage (`npm run docs:check`). Every change keeps the toolbox fully
documented:

- Every file opens with a module comment above its imports (`/** … @module */`):
  what the file holds, one or two sentences.
- Every exported class, interface, type alias, function and constant, and every
  public or protected member of them (constructor, method, property, accessor,
  interface member) gets a `/** … */` comment directly above it. Private members
  are not part of the reference and need none.
- Say what the thing is or does, its parameters, its return value, what it
  throws and its side effects (files written, git run, HTTP called, a dialog
  shown, a view refreshed). Not its history: the why of a change goes in the
  commit.
- English, plain sentences. The first sentence is the summary the index shows.
  Use TSDoc tags: `@param name - …`, `@returns …`, `@throws …`, `{@link Name}` /
  `{@link Name.member}` for cross-references, `@example` with a fenced block
  when an example helps. Do not repeat the TypeScript type in words.
- A link to a name declared in another module is qualified with the module:
  `{@link domain/model/message.model!DomainError}` (a bare `{@link DomainError}`
  does not resolve there, even when the file imports it).
- Members of an inline object type are documented too: write the type over
  several lines with a comment above each member.
- Constructor parameter properties (`private readonly deps: …`) are private; the
  constructor itself gets a comment, with `@param` for its parameters.
- An implementation of a VS Code interface method still gets its own comment:
  say what this implementation does.
- Do not hide things with `@internal`, `@hidden` or `@ignore` to reach the
  coverage; make a helper `private` or stop exporting it instead.
- Check before committing:

      npm run docs:check     # typedoc with warnings as errors: 0 warnings
      make check             # typecheck, lint, l10n, unit tests
