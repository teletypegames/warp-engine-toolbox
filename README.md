# WarpEngine Toolbox

Make a game from nothing to a released, playable [WarpEngine](https://git.teletypegames.org/engines/warp_engine)
catalog entry without leaving VS Code.

WarpEngine is the engine behind a game catalog: a repository holds one line
(`platform: c64`), the host generates its pipeline, the build is published into the
catalog and goes out to the web, the desktop client and the store outlets. The toolbox is
the developer's side of it.

**It needs a WarpEngine host.** The toolbox works against a site that runs WarpEngine 3.9 or
later (for example [teletypegames.org](https://teletypegames.org)); it ships no host of its own,
so set `warpengine.url` first. Without one, there is nothing for it to do.

![The toolbox with the C64 demo open: the WarpEngine panel and the metadata form built from the host's schema](https://wiki.teletypegames.org/wiki-assets/development/warpengine-toolbox-metadata.png)

## What it does

| | |
|---|---|
| **New Game…** | Pick a platform, name the game, and get a project from the host's template (and demo): Makefile, tasks, pipeline marker, metadata, README, a git repository. |
| **Add WarpEngine to This Project** | The marker, the metadata and the template's files for a project you already have; your own files are kept. |
| **Connect** | One step on the host: repository on the forge, CI for it, a CI token in its secret and a draft catalog entry. The working copy gets the remote and is pushed: the first build starts. |
| **Metadata** | `metadata.json` is validated against the host's schema for the platform (or edited in a form), and on every save the host says what a publish would refuse. TIC-80 headers are read the same way. |
| **Pipeline marker** | Completion and hover for `platform:` in `.woodpecker.yaml`, and a lens that shows the full pipeline the host serves. |
| **Build** | The Makefile's targets as tasks with problem matchers (ACME, cc65, gcc-style, Lua), and **Build Like CI**: the same builder image the pipeline uses, in Docker. |
| **Play** | Builds and plays the game in a panel: in the runtime its release will play in on the web (EmulatorJS, TIC-80 …) with your local build, or its own web build. One click starts it: the browser lets the game's sound start only after a click. |
| **Platform docs** | A book button on the platform in the project panel opens the host's page about the platform (the `docs` link of its tooling), when the host gives one. |
| **Pipeline** | The status bar follows the run of your current commit after a push. |
| **Release…** | Asks for the channel (stable, or a beta: `1.3.0-beta.1`), bumps the version where the platform reads it, writes the changelog from the commits, tags and pushes; the CI publishes. |
| **This branch** | On a branch other than the default one: its development build (not listed in the catalog), with a play link to share with testers; a notification when a push has built it. |
| **Catalog** | Your host's softwares, releases with an asset checklist, images, links, pipelines and download statistics; status, category and highlight can be changed in place. |
| **Images** | A software's gallery under *Images* in the catalog: **Add Image…** uploads PNG, JPEG, GIF or WebP files, a star makes one the default, the order changes with *Move Up* / *Move Down*. |
| **Local CI** | **Set Up Local CI** points the project at the local engine's git server and CI (a `wplocal` remote); *Release…* asks which remote a tag goes to. |
| **Sync** | A local engine's releases go on to another WarpEngine instance (e.g. `https://games.example.org`): **Sync to…** pairs them once, the *Sync* view shows each partner, its channels and what went over. |
| **AI** | The host's Admin API is registered as an MCP server, so Copilot or Claude in the editor see the catalog and the pipelines. |

A template repository can say exactly what a new game gets in a `warp-template.json`:

```json
{
  "files": { "example-makefile.make": "Makefile", "hello/hello.inc": "{name}.inc", "hello/Cargo.toml": "Cargo.toml" },
  "fill": ["hello/Cargo.toml"]
}
```

`files` maps a template path to its place in the project; `{name}` in a target becomes the
game's name. The files under `fill` get the placeholders replaced in their content: `{name}`,
`{title}`, `{author}`, `{description}` and `{catalogUrl}` (the address of the host the toolbox is
connected to). `json` sets fields of a JSON file by dotted path, with the placeholders filled in
the values. `templateOnly` lists the template files a project gets only when it starts without
the demo (the Hello World the demo replaces). Without a manifest the template's top-level `example-*` files are taken
(`example-makefile.make` → `Makefile`).

A demo repository may carry a `warp-template.json` too, for the demo's own files: `fill`, `json`,
and `keep` for files a demo copy otherwise leaves out (its `LICENSE`, `README`, CI and
`metadata.json`). The demo keeps working values in its own repository; the new project gets them
rewritten. The WarpEngine Client is the `electron` platform's demo this way:

```json
{
  "keep": ["LICENSE"],
  "json": {
    "package.json": {
      "name": "{name}",
      "warpEngine.brand": { "name": "{title}", "catalogUrl": "{catalogUrl}" },
      "warpEngine.registryUrl": "{catalogUrl}/api/stores"
    }
  }
}
```

Everything a platform needs — what it publishes, where its metadata and version live, how it
plays on the web, its builder image, template and documentation — comes from the host
(`GET /build/platforms`). A platform the host adds works here without a new toolbox.

## In the editor

![Play: the locally built C64 demo running in the host's EmulatorJS runtime, inside VS Code](https://wiki.teletypegames.org/wiki-assets/development/warpengine-toolbox-play.png)

![New Game: the platform list comes from the host](https://wiki.teletypegames.org/wiki-assets/development/warpengine-toolbox-new-game.png)

More on the [wiki page](https://wiki.teletypegames.org/development/warpengine-toolbox).

## Signing in

**WarpEngine: Sign In** asks the host for an Admin API token through the device grant: a
browser opens the host's *Tool Sign In* page, an administrator approves the code, and the
token lands in VS Code's secret storage. Signing in is only needed for Connect, the catalog,
the pipeline status and releases; templates, metadata checks, builds and play work without it.

## Hosts

The toolbox knows no host of its own: set `warpengine.url` to the address of the site that runs
WarpEngine (or run **WarpEngine: Set Host…**, which asks for it). `warpengine.hosts` may list more
hosts for Set Host to switch between. A host needs WarpEngine 4.0 or later (3.9 works without the release channels).

## A local engine

[WarpEngine Local](https://git.teletypegames.org/engines/warp-engine-local) is a WarpEngine on
your own machine: one container, one port, installed by one command (**WarpEngine: Install
Local Engine** runs the installer in a terminal). The toolbox looks for it on every start and
refresh: it asks `http://127.0.0.1:<port>/.well-known/warp-engine` (the port from
`~/.warpengine/config.json`, or 7470; `warpengine.localPort` sets another), lists it as
**Local** among the hosts, makes it the host when none is set, and offers to connect.
Connecting signs in with the engine's token file (`~/.warpengine/local-token`;
`warpengine.localData` names another folder) — no device code, no approval. A local engine
needs WarpEngine 5.2 or later.

## Local CI

The local engine's installer asks whether you want a local CI: a git server (Gitea,
`127.0.0.1:7471`) and a CI (Woodpecker) beside the engine, started and wired by it — no sign-in,
no browser (`--ci on` later turns it on, `--ci off` stops it). With it running, **Set Up Local
CI** in the project panel (instead of *Connect* while the local engine is the host):

1. puts the project into the local catalog if it is not there, and gives it its repository, CI
   and CI token on the local git server;
2. adds the `wplocal` git remote (a push token in its URL) to the repository open in VS Code and
   pushes: the first build starts.

**Release…** asks which remote the tag goes to (*Release to*) when the repository has more than
one: `wplocal` builds it on the local Woodpecker with the pipeline the engine serves, publishes
it on the local engine, and Sync sends it on; `origin` builds it where it always did.

## Sync

**WarpEngine: Sync to…** (the *Sync* view's cloud button) pairs your local engine with another
WarpEngine, so its releases go on there by themselves:

1. pick the engine — the known hosts whose `/.well-known/warp-engine` says they take pairing
   (WarpEngine 5.3 with `sync { inbound { enabled true } }`), or another address;
2. sign in to it if you have not (the toolbox switches to it for the sign-in and back);
3. choose the channels that go (stable and beta by default) and the name it calls your engine.

The toolbox pairs on the other engine (`POST /sync_pairings`: an inbound peer of your own and
its token), adds the outbound peer on your local engine with that token, and checks that the
other side takes it. An engine on this machine (`localhost`) is reached from the container
through `host.docker.internal`. From then on every release published on the local engine — and
the software's images — goes over by itself; **Push Now** sends what is there already.

The *Sync* view lists the partners with their channels and the last pushes; per partner: *Push
Now*, *Edit Channels…*, *Check Connection*, *Disconnect* (removes the pairing on both sides when
you are signed in to the other engine). The other engine must allow pairing: an `admin:write`
sign-in always may, any signed-in tool where it says `pairing :anyone`.

## Requirements

- VS Code 1.101 or later, git, `make`, and the platform's own tools for local builds
  (`make deps` in a new project installs them where the template knows how).
- Docker (or OrbStack) for Build Like CI.

## Development

The code is a domain core with VS Code adapters around it; [STRUCTURE.md](https://git.teletypegames.org/tools/warp-engine-toolbox/src/branch/master/STRUCTURE.md) describes
the layers, the naming and the rules ESLint holds them to.

```sh
make check          # typecheck, lint, l10n check, unit tests
make package        # dist/warpengine-toolbox.vsix
make localinstall   # package and install it into your VS Code (code --install-extension --force)
make uninstall
```

`npm run test:integration` runs the extension in a downloaded VS Code against the default host.

`npm run test:walkthrough` plays a new studio's first hour against the WarpEngine example stack
(`bin/setup` in [warp-engine-example](https://git.teletypegames.org/engines/warp-engine-example), `COMPOSE_PROJECT_NAME=warpkittest`): New Game, Sign In, Connect, the
first published release, then Release and the second one. The dialogs get scripted answers, VS Code's own
access prompt is skipped, and the admin's approval is given with `docker exec` on the app container
(`WALK_APP_CONTAINER`, default `warpkittest-app-1`). `WARPENGINE_TEST_URL` points it at another host, `WALK_PLATFORM` (default `phaser`) picks the platform and
`WALK_START=template` starts from the template instead of the demo.

The interface speaks English and Hungarian (`l10n/`, `package.nls*.json`). `npm run l10n` rewrites the
English bundle from the code; `npm run l10n:check` fails while a text has no Hungarian translation.

Press F5 in this folder to run it in an Extension Development Host.
