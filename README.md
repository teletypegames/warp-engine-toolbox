# WarpEngine Toolbox

Make a game from nothing to a released, playable [WarpEngine](https://git.teletypegames.org/engines/warp_engine)
catalog entry without leaving VS Code.

WarpEngine is the engine behind a game catalog: a repository holds one line
(`platform: c64`), the host generates its pipeline, the build is published into the
catalog and goes out to the web, the desktop client and the store outlets. The toolbox is
the developer's side of it.

## What it does

| | |
|---|---|
| **New Game…** | Pick a platform, name the game, and get a project from the host's template (and demo): Makefile, tasks, pipeline marker, metadata, README, a git repository. |
| **Add WarpEngine to This Project** | The marker, the metadata and the template's files for a project you already have; your own files are kept. |
| **Connect** | One step on the host: repository on the forge, CI for it, a CI token in its secret and a draft catalog entry. The working copy gets the remote and is pushed: the first build starts. |
| **Metadata** | `metadata.json` is validated against the host's schema for the platform (or edited in a form), and on every save the host says what a publish would refuse. TIC-80 headers are read the same way. |
| **Pipeline marker** | Completion and hover for `platform:` in `.woodpecker.yaml`, and a lens that shows the full pipeline the host serves. |
| **Build** | The Makefile's targets as tasks with problem matchers (ACME, cc65, gcc-style, Lua), and **Build Like CI**: the same builder image the pipeline uses, in Docker. |
| **Play** | Builds and plays the game in a panel: in the runtime its release will play in on the web (EmulatorJS, TIC-80 …) with your local build, or its own web build. |
| **Pipeline** | The status bar follows the run of your current commit after a push. |
| **Release…** | Bumps the version where the platform reads it, writes the changelog from the commits, tags `vX.Y.Z` and pushes; the CI publishes. |
| **Catalog** | Your host's softwares, releases with an asset checklist, links, pipelines and download statistics; status, category and highlight can be changed in place. |
| **AI** | The host's Admin API is registered as an MCP server, so Copilot or Claude in the editor see the catalog and the pipelines. |

Everything a platform needs — what it publishes, where its metadata and version live, how it
plays on the web, its builder image and template — comes from the host
(`GET /build/platforms`). A platform the host adds works here without a new toolbox.

## Signing in

**WarpEngine: Sign In** asks the host for an Admin API token through the device grant: a
browser opens the host's *Tool Sign In* page, an administrator approves the code, and the
token lands in VS Code's secret storage. Signing in is only needed for Connect, the catalog,
the pipeline status and releases; templates, metadata checks, builds and play work without it.

## Hosts

`warpengine.hosts` lists the hosts you work with (Teletype Games by default); **Select Host**
switches between them or adds one. A host needs WarpEngine 3.7 or later.

## Requirements

- VS Code 1.101 or later, git, `make`, and the platform's own tools for local builds
  (`make deps` in a new project installs them where the template knows how).
- Docker (or OrbStack) for Build Like CI.

## Development

```sh
npm install
npm run lint && npm run typecheck && npm test
npm run package        # dist/warpengine-toolbox.vsix
```

Press F5 in this folder to run it in an Extension Development Host.
