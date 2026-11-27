# WarpEngine Toolbox

Make a game from nothing to a released, playable [WarpEngine](https://git.teletypegames.org/engines/warp_engine)
catalog entry without leaving VS Code.

WarpEngine is the engine behind a game catalog: a repository holds one line
(`platform: c64`), the host generates its pipeline, the build is published into the
catalog and goes out to the web, the desktop client and the store feeds. The toolbox is
the developer's side of it.

**It needs a WarpEngine host.** The toolbox works against a site that runs WarpEngine 3.9 or
later (for example [teletypegames.org](https://teletypegames.org)); it ships no host of its own,
so set `warpengine.url` first. Without one, there is nothing for it to do.

![The toolbox with the C64 demo open: the WarpEngine panel and the metadata form built from the host's schema](https://wiki.teletypegames.org/wiki-assets/development/warpengine-toolbox-metadata.png)

## What it does

| | |
|---|---|
| **New Game…** | Pick a platform, name the game, and get a project from the host's template (and demo): Makefile, tasks, pipeline marker (with `app:` for the variant you pick, such as Go's `cli` or `gui`), metadata, README, `LICENSE` (for MIT), a git repository. |
| **Add WarpEngine to This Project** | The marker, the metadata and the template's files for a project you already have; your own files are kept. |
| **Dev container** | A template with a dev container gives the project `.devcontainer/` on the platform's CI builder image: with Docker alone on the computer, the project builds with the same toolchain as the pipeline (see [Develop with only Docker](#develop-with-only-docker)). **Add Dev Container** adds it to a project you have. |
| **Connect** | One step on the host: repository on the host's git server, CI for it, a CI token in its secret and a draft catalog entry. The working copy gets the remote and is pushed: the first build starts. |
| **Metadata** | `metadata.json` is validated against the host's schema for the platform (or edited in a form), and on every save the host says what a publish would refuse. TIC-80 headers are read the same way. |
| **Pipeline marker** | Completion and hover in `.woodpecker.yaml`: the platforms, and the keys and values the platform takes (`release`, `app`, `build`…, as the host describes them); a lens that shows the full pipeline the host serves. |
| **Build** | The Makefile's targets as tasks with problem matchers (ACME, cc65, gcc-style, Lua), and **Build Like CI**: the same builder image the pipeline uses, in Docker. |
| **Play** | Builds and plays the game in a panel: in the runtime its release will play in on the web (EmulatorJS, TIC-80 …) with your local build, or its own web build. One click starts it: the browser lets the game's sound start only after a click. |
| **Platform docs** | A book button on the platform in the project panel opens the host's page about the platform (the `docs` link of its tooling), when the host gives one. |
| **Pipeline** | The status bar follows the run of your current commit, wherever it was pushed from; when it ends, a notification says so: a failure with its log, a published release with *Play*. |
| **Release…** | Asks for the version in one list (the stable bumps, the betas such as `1.3.0-beta.1`), connects the project first when it has no remote, bumps the version where the platform reads it, writes the changelog from the commits, tags and pushes; the CI publishes. |
| **This branch** | On a branch other than the default one: its development build (not listed in the catalog), with a play link to share with testers; a notification when a push has built it. |
| **Catalog** | Your own game first, then your host's softwares, releases with an asset checklist, images, links, CI repositories and download statistics; it redraws by itself when a build publishes; status, category and highlight can be changed in place; *Delete from Catalog…* removes a software once you type its slug (its catalog `name`), *Delete Release…* removes a release after a confirmation. A host that refuses the stored token shows *Not authorized*: one click signs in again. |
| **Images** | A software's gallery under *Images* in the catalog: **Add Image…** uploads PNG, JPEG, GIF or WebP files, a star makes one the default, the order changes with *Move Up* / *Move Down*. |
| **Admin page** | The project panel links the software's page in the host's admin web UI. |
| **Local CI** | When the local engine runs a git server and a CI, the toolbox offers to set the open project up on them (a `wplocal` remote); *Release…* asks which remote a tag goes to. |
| **Local Server** | The WarpEngine containers on this machine (the engine, the git server, the CI) with their state and ports, and the dev containers of the projects (a stopped one can be started there, a running one stopped); **Purge Local Engine…** removes all of the WarpEngine's: containers, data, volumes, network and images. |
| **Dashboard** | **WarpEngine: Open Dashboard** (the dashboard button of the project panel) opens a tab that sums up the sidebar in tables: health with its fixes, the latest pipeline runs, the releases with play links, the local containers, the sync partners and the catalog as a table — with *Open* on the entries whose project you opened in VS Code before; its buttons run the same commands. |
| **Health** | What is set up and what is not — the host, the sign-in, the local engine and its CI, the project's metadata, catalog entry, CI repository and last run — green, yellow or red; a click on a gap runs the step that fixes it. |
| **Sync** | A local engine's releases go on to another WarpEngine instance (e.g. `https://games.example.org`): **Sync to…** pairs them once, the *Sync* view shows each partner, its channels and what went over. |
| **Clone, Fork** | A software whose catalog entry gives a source: **Clone…** on its node clones it into a folder of yours and opens it; **Fork…** (when the author allows it) makes it your own version under a new name on a host you can connect to; *Forks* lists the versions others made (see [Clone and fork](#clone-and-fork)). |
| **AI** | The host's Admin API is registered as an MCP server, so Copilot or Claude in the editor see the catalog and the CI repositories. |

A template repository can say exactly what a new game gets in a `warp-template.json`:

```json
{
  "files": { "example-makefile.make": "Makefile", "hello/hello.inc": "{name}.inc", "hello/Cargo.toml": "Cargo.toml" },
  "fill": ["hello/Cargo.toml"]
}
```

`files` maps a template path to its place in the project; `{name}` in a target becomes the
game's name. The files under `fill` get the placeholders replaced in their content: `{name}`,
`{title}`, `{author}`, `{description}`, `{catalogUrl}` (the address of the host the toolbox is
connected to) and `{builderImage}` (the platform's CI builder image, from the host). `json` sets fields of a JSON file by dotted path, with the placeholders filled in
the values. `templateOnly` lists the template files a project gets only when it starts without
the demo (the Hello World the demo replaces). Without a manifest the template's top-level `example-*` files are taken
(`example-makefile.make` → `Makefile`).

`devcontainer` gives the project a dev container: its `files` are copied (and filled when listed
under its `fill`), and the tasks of its `tasks` file are merged into `.vscode/tasks.json` by
label, the project's own tasks and comments kept. A toolbox that does not know the key leaves it
out, so a template can carry it before every user has a toolbox that understands it:

```json
{
  "devcontainer": {
    "files": { "example-devcontainer.json": ".devcontainer/devcontainer.json", "example-devcontainer.Dockerfile": ".devcontainer/Dockerfile" },
    "fill": ["example-devcontainer.json", "example-devcontainer.Dockerfile"],
    "tasks": "example-devcontainer-tasks.json"
  }
}
```

A demo repository may carry a `warp-template.json` too, for the demo's own files: `fill`, `json`,
and `keep` for files a demo copy otherwise leaves out (its `LICENSE`, `README`, CI and
`metadata.json`). The demo keeps working values in its own repository; the new project gets them
rewritten. The WarpEngine Desktop is the `electron` platform's demo this way:

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

## Themes

Three color themes in the look of teletypegames.org come with the toolbox; pick one with
**Preferences: Color Theme** (the toolbox never switches the theme itself):

| Theme | |
|---|---|
| **WarpEngine - Dark** | zinc greys and the green accent of the site's dark mode |
| **WarpEngine - Light** | the same in the site's light mode |
| **WarpEngine - Retro** | the wiki's retro mode: black editor, CGA-blue panels, white lines, bright yellow, cyan and green code |

And one per platform, in its own colors:

| Theme | Its look |
|---|---|
| **WarpEngine - C64** | the BASIC boot screen: blue editor in a light blue frame |
| **WarpEngine - Plus/4** | the BASIC 3.5 boot screen: white editor in a light purple frame, black text |
| **WarpEngine - TIC-80** | Sweetie 16, the TIC-80 default palette |
| **WarpEngine - LÖVE** | LÖVE's pink and light blue on deep blue |
| **WarpEngine - Phaser** | neon arcade: deep violet, magenta and cyan |
| **WarpEngine - Ebitengine** | the Go look: white, Go blue, the gopher's yellow on the current line |
| **WarpEngine - Bevy** | graphite with Rust's orange |
| **WarpEngine - Godot** | the Godot editor's slate blue and script colors |
| **WarpEngine - DOS** | the blue editor of the classic DOS IDEs: yellow text, a grey menu and status bar |
| **WarpEngine - Electron** | charcoal with Electron's teal |

Keywords take the green accent, types its lighter shade, strings amber, numbers blue, comments
the muted grey (the platform themes take their palette's colors instead); every text color passes a contrast check (4.5:1, comments 3:1). The remote
indicator is green, so a window in a dev container shows at a glance. A font is not part of a
theme: for the retro look set `editor.fontFamily` to a monospace like Lucida Console yourself.

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

### When the host does not answer

Every "cannot be reached" — a view, a notification, the *Health* line — comes with **Fix…**
(**WarpEngine: Fix Host Connection…**). It looks at why and offers the step that puts it right:

| What it finds | The steps |
|---|---|
| a host on another machine does not answer | *Try Again*, *Open in Browser*, *Set Host…* |
| Docker is not installed | *Get Docker*, *Docker Command Setting* (`warpengine.docker`) |
| Docker does not run | *Start Docker*: opens OrbStack or Docker Desktop (macOS, Windows), runs `sudo systemctl start docker` in a terminal (Linux), and waits for it |
| the engine is not installed (its data may still be in `~/.warpengine`) | *Reinstall* (the installer with `--yes`: the saved answers and the data stay), *Remove Its Data…*, *Set Host…* |
| the engine or its CI is stopped | *Start*, *Reinstall*, *Remove…*, *Set Host…* |
| the engine answers at another port than the host set | *Use* that address |
| the engine runs but does not answer | *Restart*, *Show Log*, *Reinstall* |

When the host set is a local engine that does not answer, the toolbox offers **Fix…** by itself,
once per window, and again whenever the installer closes without the engine answering. A dev
container from a current template mounts the computer's Docker socket, so *Fix…* starts and
restarts the engine from there too; installing or removing it needs a window on the computer
(*Reopen Folder Locally*), since the installer writes its data folder there.

## Local CI

The local engine's installer asks whether you want a local CI: a git server (Gitea,
`127.0.0.1:7471`) and a CI (Woodpecker) beside the engine, started and wired by it — no sign-in,
no browser (`--ci on` later turns it on, `--ci off` stops it). With it running, the toolbox
offers to set up a project without a CI repository there (*Not for this project* stops asking);
**Set up local CI** in the project panel and in the command palette does it any time:

1. puts the project into the local catalog if it is not there, and gives it its repository, CI
   and CI token on the local git server;
2. adds the `wplocal` git remote (a push token in its URL) to the repository open in VS Code and
   pushes: the first build starts.

**Release…** asks which remote the tag goes to (*Release to*) when the repository has more than
one: `wplocal` builds it on the local Woodpecker with the pipeline the engine serves, publishes
it on the local engine, and Sync sends it on; `origin` builds it where it always did.

## Local Server

The *Local Server* view lists the containers the local engine's installer and the engine started
(label `org.teletypegames.warp-engine.local=1`): `warp-engine-local`, `warp-engine-local-gitea`,
`warp-engine-local-woodpecker` and its agent, with their state and ports; a click opens the
engine or the git server, a stopped one has a start button (**Start the Local Engine** starts
every stopped one). **Purge Local Engine…** (the trash button) asks once, then removes the
containers, the data folder (`~/.warpengine`: the catalog, the releases, the token — also when
the containers are gone already), the volumes, the network and the images — the same as the
installer's `--uninstall --purge`. When Docker does not answer, the view says so with *Start
Docker*. In a dev container the view lists the computer's containers through the mounted Docker
socket; a dev container built before the socket was part of the template says so, with *Reopen
Folder Locally*.

The *Catalog* and *Local Server* views start collapsed. While the WarpEngine sidebar is open, the
toolbox opens *Local Server* when no local engine is installed (its *Install Local Engine* line
shows), and *Catalog* once, the first time it has something to show. It never closes a view: one
you open or close yourself stays as you left it.

## Reset

**WarpEngine: Reset…** (also a button on the Dashboard) removes what WarpEngine left on this
computer. Pick any of the parts, or *Everything*:

| Part | What goes |
|---|---|
| **Local engine** | its containers (engine, git server, CI), volumes, network, images and its data folder (`~/.warpengine`) — also when the containers are gone already |
| **Dev containers** | every VS Code dev container on this computer with its image and named volumes (including the Dev Containers' shared `vscode` volume); windows open in them close |
| **WarpEngine Toolbox** | its settings (user, workspace and folder), the sign-ins of every host, its stored state, then the extension itself; a reload finishes it |

One confirmation lists what goes, with the counts; nothing is undone. In a window in a dev
container *Reset…* offers *Reopen Folder Locally* instead, as it would remove its own container.

## Health

The *Health* view checks everything the toolbox depends on, in three groups: the **host**
(set, answering, signed in, the token taken), the **local engine** (shown when it is installed
or it is the host: its container, its git server and CI) and the **project** (its platform, the
host's publish check of its metadata, its catalog entry, CI repository and last run). A click on a
yellow or red line runs the step that fixes it — *Fix…*, *Start Docker*, *Start the Local
Engine*, *Set Host…*, *Sign in*, *Sign In Again*, *Install Local Engine*, *Connect*, *Set up local
CI*, *Edit Metadata*, *Add WarpEngine to This Project* — or opens the page that tells more (a
run's log, the admin page). The same buttons come with the error messages.

When a host refuses the stored token, the status bar, the views and Health offer *Sign In
Again*. On the local engine the sign-in tries the token file and then the token the running
container gives, and keeps the one the engine takes, so a reinstalled engine does not leave the
toolbox stuck on an old token.

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

## Clone and fork

The Catalog view reads the host's public catalog (`/api/software`, no sign-in needed) beside the
admin one. A software node whose entry gives a **source** gets *Clone…* in its context menu, one
whose host allows forking it also *Fork…*, and on hosts that count forks (WECP `api: 3`) the node
has a *Forks* child: the versions made of it, with the engine they live on (*this engine* when
it is the same). An older host gives none of these, and the toolbox shows none.

**Clone…** asks for a parent folder and clones the source into `<folder>/<name>`: over SSH when
the source gives an SSH address that answers without asking, over HTTPS otherwise, without the
blobs of the old history (`--filter=blob:none`). Then it offers to open the folder, in its dev
container when it has one. A folder that exists, a repository that cannot be reached, is not
found or does not let git sign in each get *Try Again…*.

**Fork…** shows the original's owner and licence (and warns when it has none: ask the author
before you publish your version), then asks:

1. the host the fork goes to — only the configured hosts you are signed in to;
2. its name — `<name>-<you>` on that host, `-2`, `-3` while it is taken there, checked as you type;
3. its title and the parent folder.

It clones the whole history, renames `origin` to `upstream`, writes the new `name` and `title`
into the metadata, removes `repo` and records the parent in `fork_of_engine`, `fork_of_name`,
`fork_of_version` and `fork_of_repo`, and commits *Fork of <title> from <engine>*. When the
original has no licence it asks for one (MIT, GPL-3.0, CC-BY-4.0, CC0-1.0 or none). Then the
chosen host becomes the current one and **Connect** runs on the fork: a repository, the CI, a
catalog entry that already knows its parent, the first push. Last, it offers to open the fork.

**WarpEngine: Pull from Upstream** fetches a fork's `upstream` and merges its default branch into
yours. Conflicts stay in the working copy for the editor's merge view; commit when they are solved.

## Develop with only Docker

A project with `.devcontainer/devcontainer.json` builds in its dev container — the platform's CI
builder image with git and a `dev` user — so ACME, cc65, Go or Rust never have to be installed on
the computer:

- **In a window on this computer** the `warpengine` tasks (`build`, `clear`, `rebuild`, and the
  build Play runs) go into the container through the Dev Containers CLI that comes with the
  toolbox, on the editor's own Node: nothing to install but Docker. The first task starts the
  container; the ones this window started stop when it closes, and one left running (the editor
  crashed) shows in *Local Server* with a stop button.
- **Reopened in the container** (the Dev Containers extension; New Game offers *Open in
  Container*) the toolbox runs there and the tasks run as they are.
- **dev image** builds the container image ahead of time; **play** builds and plays the game in
  the host's web runtime — the way to try it, as the container has no emulator window. A task
  with `"host": true` (the template's *run (VICE)*) builds in the container, then runs its
  target on this computer, for a local emulator.
- Play needs the host: its runtime page and files come from there.

The Dev Containers extension connects to `/var/run/docker.sock`; with OrbStack or Colima turn on
their compatibility link (OrbStack: *Use admin privileges for enhanced compatibility*). The
toolbox's own route follows the Docker CLI's context and needs none. Inside the container the
toolbox reaches a local engine on this computer at `host.docker.internal` (its HTTP API and its
git server alike), and the computer's Docker through the socket the template mounts (the
container has the Docker CLI, and `dev` joins the socket's group when the container starts): one
local engine per computer, used from every window, contained or not. Mounting the socket gives
the container the computer's Docker; that socket must exist, so a Docker without
`/var/run/docker.sock` needs its compatibility link here too.

## Requirements

- VS Code 1.101 or later and git; for a project with a dev container, Docker is enough.
- Without a dev container: `make` and the platform's own tools for local builds (`make deps` in a
  new project installs them where the template knows how), and Docker (or OrbStack) for Build
  Like CI.

## Development

The code is a domain core with VS Code adapters around it; [STRUCTURE.md](https://git.teletypegames.org/tools/warp-engine-toolbox/src/branch/master/STRUCTURE.md) describes
the layers, the naming and the rules ESLint holds them to.

```sh
make check          # typecheck, lint, documentation gate, l10n check, unit tests
make docs           # the API reference (TypeDoc) in doc/
make package        # dist/warpengine-toolbox.vsix
make localinstall   # package and install it into your VS Code (code --install-extension --force)
make uninstall
```

The API reference is built from the TSDoc comments of the source and published on every release tag: [wiki.teletypegames.org/typedoc/warp-engine-toolbox](https://wiki.teletypegames.org/typedoc/warp-engine-toolbox/latest/), with a generated *Commands and Settings* page. `CLAUDE.md` has the rules; CI fails while anything is undocumented.

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
