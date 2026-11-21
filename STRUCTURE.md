# Structure

The toolbox is a domain core with adapters around it. Dependencies point one way only,
and ESLint (`no-restricted-imports` per folder) refuses an import that goes the wrong way.

```mermaid
flowchart LR
  subgraph extension["extension — VS Code adapters"]
    bootstrap --> command
    command --> controller
    controller --> ui
    view
    language
    workspace
    auth
  end
  subgraph domain["domain — no VS Code, no I/O"]
    service --> repository
    service --> model
    repository --> model
  end
  subgraph infrastructure["infrastructure — the ports implemented"]
    http
    git
    other["process · template · preview"]
    vscodeImpl["vscode"]
  end
  controller --> service
  view --> service
  language --> service
  workspace --> service
  bootstrap -. wires .-> infrastructure
  infrastructure -. implements .-> repository
```

## Layers

### `src/domain/` — what the toolbox knows and decides

Nothing in the domain imports `vscode`, `node:*`, `fetch`, `infrastructure/` or
`extension/`. It is unit tested with plain `node --test`.

| Sub-layer | Holds | May import |
|---|---|---|
| `model/` | Entities and value objects: classes with behaviour (`Version`, `Marker`, `LuaHeader`, `Metadata`, `Platform`, `Project`, `ProjectPlan`, `AssetChecklist`, `Changelog`, `Makefile`) and the plain data the host sends (`Software`, `Release`, `PipelineRun`, …). The rules on plain data live in a class of static methods named for it in the plural (`Releases`, `PipelineRuns`, `RemoteStates`, `PublishChecks`, `Servers`, `HealthChecks`), not in loose functions; `msg()`, the `Message` factory, is the one exception. | `model/` |
| `repository/` | Ports: interfaces only, for everything outside the process — the host API, git, the project's files, the template archives, the shell, the stored sessions, the settings, the preview server. | `model/` |
| `service/` | One class per business capability, on models and ports: `ReleaseService`, `ConnectService`, `ScaffoldService`, `RemoteStateService`, `PlayService`, `SyncService` (pairing two engines), `ImageService`, `ServerService` (the local containers and their purge), `HostInfoService`, `HealthService` (the facts of the Health checks), `DevContainerService` (where a project's commands run and running them in its dev container), `RepairService` (why the host does not answer: Docker, the local containers, the address), … Every decision lives here: what is missing for a release, which versions to offer, what the host would refuse. A service never asks the user anything. | `model/`, `repository/` |

A domain failure is a `DomainError` carrying a `Message` (an English text with `{0}`
placeholders and its arguments) and, when one step fixes it, a `Remedy` (`signIn`,
`selectHost`, `installLocalEngine`, `connect`, `setupLocalCi`, `repairHost`, `startDocker`, …); the extension translates
the message and turns the remedy into a button. The Health checks carry remedies the same way.

### `src/infrastructure/` — the ports implemented

| Folder | Implements |
|---|---|
| `http/` | `WarpEngineHttpClient` (fetch, errors, the admin envelope) and the HTTP repositories on it: build, catalog, pipeline, sign-in; `WarpEngineHttpGateway` hands them out for the current host and token; `Loopback` turns `127.0.0.1` into `host.docker.internal` inside a dev container, for every fetch. |
| `git/` | `SourceControl` with the `git` CLI. |
| `process/` | Running a command (`execFile`) and a shell line; `ContainerRuntime` with the `docker` CLI (the Servers view, the purge); `CliDevContainerRepository`: the dev containers through the bundled `@devcontainers/cli`, run on the editor's Electron as Node. |
| `template/` | `TemplateRepository`: a repository's archive downloaded and unpacked. |
| `preview/` | `PreviewServer`: the loopback HTTP server Play uses. |
| `vscode/` | The ports whose natural home is VS Code: the settings (hosts), the secret storage (sessions), the memento (platform cache), the workspace file system, the authentication session (token). The only infrastructure folder that may import `vscode`. |

Infrastructure imports `domain/model` and `domain/repository`, never `domain/service` or
`extension/`.

### `src/extension/` — VS Code adapters

| Folder | Holds |
|---|---|
| `bootstrap/` | `main.ts` (`activate`/`deactivate`, the registrations), `container.ts` (the composition root of the services: the only file that creates infrastructure objects), `workspace.factory.ts`, `views.factory.ts` and `controllers.factory.ts` (the extension objects, in that order), `events.wiring.ts` (which store event redraws which view or starts which controller flow), `disposer.ts` and `toolbox.api.ts` (what `activate` returns to the tests). |
| `command/` | `command.table.ts`: command id → controller method; `command.registry.ts` registers the rows with one error handler. |
| `controller/` | One class per user flow, thin: asks the user, calls services, reports. No decisions of its own — when a controller grows an `if` about the business, it moves into a service. |
| `ui/` | Small helpers the controllers share: quick picks with values, progress, notifications with actions (every error one also offers *Open Dashboard*), the translation of a `Message`, `remedy.dialog.ts` (a `Remedy` as a button and the command it runs); and the multi-step questions a flow asks (`game-answers.dialog.ts`: the New Game answers). |
| `auth/` | The VS Code authentication provider on `SignInService`. |
| `workspace/` | Living state of the window: `ProjectRegistry` (the projects of the workspace folders, the current one), `RemoteStateStore` (polling and events), `KnownProjectsStore` (the folders of the projects ever opened), `GitWatcher`. |
| `view/` | What is drawn: the tree views and their nodes (and `ViewOpener`, which expands the collapsed ones when due), the status bar, the Dashboard (`dashboard.collector.ts` gathers, `dashboard.renderer.ts` writes the HTML, `dashboard.panel.ts` holds the tab), the Play panel, the metadata form, the diagnostics, the report documents, the platform description. |
| `language/` | Editor features: marker completion, hover and lens, the metadata JSON schema, the Makefile task provider, the MCP server definition. |

The extension may import every domain sub-layer. It does not import `infrastructure/`,
except `bootstrap/container.ts`.

## Naming

- Files: `<subject>.<role>.ts`, kebab-case subject. The role is the layer or the kind:
  `version.model.ts`, `catalog.repository.ts` (port), `catalog.http-repository.ts`
  (an implementation: `<subject>.<technology>-repository.ts`), `release.service.ts`,
  `release.controller.ts`, `project.tree-view.ts`, `pipeline.status-bar.ts`,
  `marker.completion-provider.ts`.
- Classes carry their role as a suffix: `ReleaseService`, `ReleaseController`,
  `CatalogRepository` (interface), `HttpCatalogRepository`, `ProjectTreeView`. An
  implementation is named `<Technology><Port>`: `HttpDiscoveryRepository`,
  `VsCodeLocalEngineRepository`, `DockerContainerRuntime`.
- Tests mirror the source: `test/unit/domain/model/version.model.test.ts`.
- Webview assets are real files in `media/webview/` (`metadata-form.js`,
  `metadata-form.css`, `play-toolbar.js`, `play.css`), never strings in TypeScript.

## Size

ESLint keeps the code small: at most 25 lines per function, 200 lines per file,
complexity 8, 4 parameters (more travel as one input object).

## A request, end to end: Release…

1. `command/command.table.ts` maps `warpengine.release` to `ReleaseController.run()`.
2. `ReleaseController` takes the current project from `ProjectRegistry` and asks
   `ReleaseService.readiness()`: a repository with a remote, a clean working copy, a
   version the toolbox can write. It shows what is missing, or offers to commit first.
   A project without a remote gets the remedy `LocalEngineService.setupRemedy()` names
   (*Connect*, or *Set up local CI* on the local engine).
3. It offers the stable and the beta `ReleaseService.candidates()` (from the `Version`
   model) in one list; `ReleaseService.verify()` asks the host through `BuildRepository.check()`.
4. `ReleaseService.release()` writes the version with `Metadata` through `ProjectFiles`,
   builds the `Changelog` from the `SourceControl` commits, commits, tags and pushes.
5. The controller reports; `RemoteStateStore.watch()` starts polling the pipeline, and the
   tree views, the status bar and the Dashboard redraw from its events. When the run of
   `HEAD` ends, `RemoteStates.runOutcome()` decides what the notification says.

## Adding things

- **A command**: a controller method (or a new `<flow>.controller.ts`), a row in
  `command.table.ts`, the contribution in `package.json` with `%key%` titles, the texts
  in `package.nls*.json`.
- **A host endpoint**: the method on the port in `domain/repository/`, its HTTP
  implementation in `infrastructure/http/`, then use it from a service.
- **A tree node**: in the matching `view/tree/*.tree-view.ts`; it reads services or the
  stores, never the HTTP client.
- **A fix for a failure**: a `Remedy` value in `message.model.ts`, its command and label in
  `ui/remedy.dialog.ts`; then throw `new DomainError(msg(…), 'theRemedy')`, or set it on a
  Health check.
- **A Dashboard part**: the data in `DashboardCollector`, a card in `DashboardRenderer`
  (escape every text, buttons as `data-command`), its style in `media/webview/dashboard.css`.

## Themes

`themes/teletype-games-{dark,light,retro}.json` are generated, not edited: `npm run themes`
(`scripts/themes.mjs`) builds them from `themes/source/tokens.css` (a copy of the site's
`services/teletypegames/apps/frontend/src/styles/tokens.css`) and `themes/source/retro.css`
(the `--c-*` palette of the wiki's retro mode), and one theme per platform from
`themes/source/platforms.json` (the same roles, the five code colors and any VS Code color set
directly, each with the source of its palette). After a brand color changes, copy the source
over and run it. `npm run themes:check` runs with the unit tests and fails when a theme is out of
date, missing from `contributes.themes`, or a text color — of the roles or of the final colors of
the editor, title bar, status bar, activity bar, active tab and remote indicator — is below its
contrast minimum.

## i18n

- English is the base language, Hungarian the first translation.
- `package.json` texts are `%key%` references to `package.nls.json` and
  `package.nls.hu.json`.
- Runtime texts go through `vscode.l10n.t` with the bundles `l10n/bundle.l10n.json`
  (English) and `l10n/bundle.l10n.hu.json`; the key is the English text with `{0}`
  placeholders.
- The domain never translates: a `DomainError` carries a `Message`, and
  `extension/ui` turns it into text with the same bundles.
- Webviews get their texts from the extension when they are created.
- What the toolbox writes into a project (README, the marker comment, the changelog,
  commit messages) stays English: it belongs to the project, not to the editor.
- `npm run l10n:check` fails when a translated text has no Hungarian translation; it runs
  with the unit tests.
