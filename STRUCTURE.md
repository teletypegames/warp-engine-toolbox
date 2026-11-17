# Structure

The toolbox is split into three layers. Dependencies point one way only, and ESLint
(`no-restricted-imports` per folder) refuses an import that goes the wrong way.

```mermaid
flowchart LR
  subgraph extension["extension — VS Code adapters"]
    bootstrap --> command
    command --> ui
    view
    language
    workspace
    auth
    i18n
  end
  subgraph domain["domain — no VS Code, no I/O"]
    controller --> service
    service --> repository
    service --> model
    repository --> model
    controller --> model
  end
  subgraph infrastructure["infrastructure — ports implemented"]
    http
    git
    fs["process / preview / template"]
    vscodeImpl["vscode"]
  end
  command --> controller
  view --> service
  language --> service
  workspace --> service
  bootstrap -. wires .-> infrastructure
  infrastructure -. implements .-> repository
```

## Layers

### `src/domain/` — what the toolbox does

Nothing in the domain imports `vscode`, `node:*`, `fetch`, `infrastructure/` or
`extension/`. It can be unit tested with plain `node --test`.

| Sub-layer | Holds | May import |
|---|---|---|
| `model/` | Entities and value objects: classes with behaviour (`Version`, `Marker`, `LuaHeader`, `Metadata`, `Platform`, `Project`, `ProjectPlan`, `AssetChecklist`, `Changelog`, `Makefile`) and the plain data the host sends (`Software`, `Release`, `PipelineRun`, …). | `model/` |
| `repository/` | Ports: interfaces only, for everything outside the process — the host API, git, the project's files, the template archives, the shell, the stored sessions, the settings, the preview server. | `model/` |
| `service/` | One class per business capability, built on models and ports: `ReleaseService`, `ConnectService`, `ScaffoldService`, `RemoteStateService`, `PlayService`, … No questions to the user. | `model/`, `repository/` |
| `controller/` | One class per user flow (a command): asks, decides, calls services, reports. Talks to the user only through the `Ui` port (`ui.port.ts`), so a flow runs in a unit test with a scripted `Ui`. | `model/`, `repository/` (types), `service/` |

### `src/infrastructure/` — the ports implemented

| Folder | Implements |
|---|---|
| `http/` | `WarpEngineHttpClient` (fetch, errors, admin envelope) and the HTTP repositories on it: build, catalog, pipeline, sign-in; `WarpEngineHttpGateway` hands them out for the current host and token. |
| `git/` | `SourceControl` with the `git` CLI. |
| `process/` | Running a command (`execFile`) and a shell line. |
| `template/` | `TemplateRepository`: a repository's archive downloaded and unpacked. |
| `preview/` | `PreviewServer`: the loopback HTTP server Play uses. |
| `vscode/` | The ports whose natural home is VS Code: settings (hosts), secret storage (sessions), memento (platform cache), the workspace file system, the authentication session (token). The only infrastructure folder that may import `vscode`. |

Infrastructure imports `domain/model` and `domain/repository`, never `domain/service`,
`domain/controller` or `extension/`.

### `src/extension/` — VS Code adapters

| Folder | Holds |
|---|---|
| `bootstrap/` | `main.ts` (`activate`/`deactivate`), `container.ts` (the composition root: the only file that creates infrastructure objects) and `toolbox.api.ts` (what `activate` returns to the tests). |
| `command/` | The command table: command id → controller method, with one error handler. |
| `ui/` | `VsCodeUi implements Ui`: quick picks, input boxes, progress, notifications, opening links. |
| `i18n/` | `Translator`: a domain `Message` to text with `vscode.l10n`. |
| `auth/` | The VS Code authentication provider on `SignInService`. |
| `workspace/` | Living state of the window: `ProjectRegistry` (projects of the workspace folders, the current one), `RemoteStateStore` (polling and events), `GitWatcher`. |
| `view/` | What is drawn: tree views and their nodes, the status bar, the Play panel, the metadata form, the diagnostics, the report documents, the platform description. |
| `language/` | Editor features: marker completion, hover and lens, the metadata JSON schema, the Makefile task provider, the MCP server definition. |

The extension may import every domain sub-layer. It does not import `infrastructure/`,
except `bootstrap/container.ts`.

## Naming

- Files: `<subject>.<role>.ts`, kebab-case subject. The role is the layer or the kind:
  `version.model.ts`, `catalog.repository.ts` (port), `catalog.http-repository.ts`
  (implementation: `<subject>.<technology>-repository.ts`), `release.service.ts`,
  `release.controller.ts`, `ui.port.ts`, `project.tree-view.ts`, `pipeline.status-bar.ts`,
  `marker.completion-provider.ts`.
- Classes carry their role as a suffix: `ReleaseService`, `ReleaseController`,
  `CatalogRepository` (interface), `HttpCatalogRepository`, `ProjectTreeView`.
- Tests mirror the source: `test/unit/domain/model/version.model.test.ts`.
- Webview assets live as real files in `media/webview/` (`metadata-form.js`,
  `metadata-form.css`, `play-toolbar.js`, `play.css`), never as strings in TypeScript.

## Size

ESLint keeps the code small: at most 25 lines per function, 200 lines per file,
complexity 8, 4 parameters (more travel as one input object).

## A request, end to end: Release…

1. `command/command.registry.ts` maps `warpengine.release` to `ReleaseController.run()`.
2. `ReleaseController` takes the current project from `ProjectRegistry`, asks
   `ReleaseService.readiness()` (repository? remote? clean? writable version?), and asks
   the user through `Ui`: commit first, the channel, the version.
3. `ReleaseService.candidates()` gets the versions from the `Version` model;
   `ReleaseService.verify()` asks the host through `BuildRepository.check()`.
4. `ReleaseService.release()` writes the version with `Metadata` into `ProjectFiles`,
   builds the `Changelog` from `SourceControl` commits, commits, tags and pushes.
5. The controller reports through `Ui`; `RemoteStateStore.watch()` starts polling the
   pipeline, and the tree view and the status bar redraw from its event.

## Adding things

- **A command**: a controller method (or a new `<flow>.controller.ts`), a row in
  `command.registry.ts`, the contribution in `package.json` with `%key%` titles, the
  texts in `package.nls*.json`.
- **A host endpoint**: the method on the port in `domain/repository/`, its HTTP
  implementation in `infrastructure/http/`, then use it from a service.
- **A tree node**: in the matching `view/tree/*.tree-view.ts`; it reads services or the
  stores, never the HTTP client.

## i18n

- English is the base language, Hungarian the first translation.
- `package.json` texts are `%key%` references to `package.nls.json` and
  `package.nls.hu.json`.
- Runtime texts are `vscode.l10n` bundles: `l10n/bundle.l10n.json` (English) and
  `l10n/bundle.l10n.hu.json`. The key is the English text with `{0}` placeholders.
- The domain never translates: controllers and services hand the `Ui` a `Message`
  (`msg('Release {0}: channel', name)`), and `DomainError` carries one. The
  `Translator` in `extension/i18n/` turns it into text.
- Webviews get their texts from the extension when they are created.
- What the toolbox writes into a project (README, the marker comment, the changelog, commit
  messages) stays English: it belongs to the project, not to the editor.
- `npm run l10n:check` fails when a `msg(…)`/`l10n.t(…)` text has no Hungarian
  translation; it runs with the unit tests.
