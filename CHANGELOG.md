# Changelog

## Unreleased

- **Clone…** and **Fork…** on a software of the Catalog view, and a *Forks* node under it, from the host's public
  catalog (WECP `api: 3`; an older host shows none of them). A fork gets a new name on a host you can connect to, an
  `upstream` remote, its parent in the metadata (`fork_of_*`), and Connect; **Pull from Upstream** merges the
  original's changes later.

## 1.16.0

- **Reset…** (command and Dashboard button): removes the local engine with every Docker part and `~/.warpengine`, the
  VS Code dev containers with their images and volumes, the toolbox with its settings, sign-ins and state — chosen
  parts or everything, after one confirmation.
- **A theme per platform**: *Teletype Games - C64, Plus/4, TIC-80, LÖVE, Phaser, Ebitengine, Bevy, Godot, DOS, Electron*,
  each in its platform's own colors (the C64 and Plus/4 boot screens, TIC-80's Sweetie 16, the Godot editor, a DOS IDE…),
  contrast-checked like the others.

## 1.15.3

- **Teletype Games - Dark / Light / Retro**: color themes in the look of teletypegames.org (Retro: the wiki's DOS
  palette), generated from the site's tokens and contrast-checked; pick one in *Preferences: Color Theme*.
- A dev container that reaches the computer's Docker (the templates now mount its socket and add the Docker CLI)
  gets the whole *Local Server* view and *Fix…* there: the containers, start, restart, the log. Installing and removing
  the local engine still need a window on the computer; an older dev container without the socket says so.

## 1.15.2

- *Connect* on the local engine (also from *New Game*) runs **Set up local CI**: the same catalog entry, repository and
  CI, pushed over the engine's token URL. Its git server has no SSH, so the SSH remote Connect used to set could not push.
- In a dev container git reaches a remote on the computer's loopback (the local engine's git server) at
  `host.docker.internal`: *Release…*, *Set up local CI* and the remote state push and fetch from the container too.

## 1.15.1

- In a window reopened in a dev container the steps on the computer's Docker — *Install Local Engine*, *Purge*,
  *Start Docker*, *Start the Local Engine* — no longer run in the container (the installer found no Docker there):
  they offer **Reopen Folder Locally**, and so do *Fix…* and the *Local Server* line; the toolbar buttons are hidden there.

## 1.15.0

- **Fix…** on every "cannot be reached" (views, notifications, *Health*), also as **WarpEngine: Fix Host
  Connection…**: it finds why the host does not answer and offers the step — *Start Docker*, *Start*, *Restart*,
  *Reinstall* (the installer with `--yes`, the data stays), *Remove…*, *Use* the address the engine answers at,
  *Show Log*, *Set Host…*. The toolbox offers it by itself once per window when the local engine set as the host
  does not answer, and after an installer that left it silent.
- *Local Server*: a stopped engine or CI container has a start button; a Docker error comes with *Start Docker*.
- *Purge Local Engine…* removes the data folder also when the containers are gone already.
- *Health*: every red or yellow line has a step (Docker, a stopped CI, an unknown platform, a missing metadata file).
- A sign-in that was denied or expired offers to sign in again; *Run Pipeline* without a pipeline offers *Connect*
  or *Set up local CI*.
- In a dev container the toolbox was installed into after the window opened, it offers *Reload Window* (until then
  VS Code does not know the `warpengine` task type).
- *Local Server* in a window reopened in a dev container says that the containers are listed in a
  window on the computer, instead of a `spawn docker ENOENT` error.

## 1.14.0

- **Start a stopped dev container** from *Local Server*: a stopped one has a start button
  (`docker start`, as it was created); it runs until it is stopped.

## 1.13.0

- **Develop with only Docker**: a template's `devcontainer` gives a new project `.devcontainer/` on
  the platform's CI builder image (`{builderImage}`), and its tasks are merged into
  `.vscode/tasks.json`. The `warpengine` tasks of such a project run in the container — through
  the bundled Dev Containers CLI from a window on this computer (on the editor's own Node), as
  they are in a window reopened in the container; the containers a window started stop when it
  closes. New Game offers *Open in Container*.
- **Local Server lists the dev containers** of the projects; a running one has a stop button
  (for one left running when the editor crashed).
- **Add Dev Container** adds the template's dev container to a project you have, keeping its
  files, its metadata and its version.
- New task kinds: `"action": "play"` and `"action": "devImage"`, and `"host": true` (build in the
  container, run the target on this computer). *Build Like CI* builds in the dev container when
  the project has one.
- Play reaches its preview server from a remote window (`asExternalUri`), and inside a dev
  container `127.0.0.1` addresses (a local engine) go to `host.docker.internal`.

## 1.12.0

- **A clearer Dashboard**: Pipeline and Releases show their five newest rows with a count, and
  *More* opens all of them in a dialog. Local Server and Sync share a row half and half.
- Statuses are coloured pills, times read as *3 hours ago* (the exact time on hover), the
  newest release is marked *latest*, and the header shows platform, version, branch and host
  as chips. Signed out, the Catalog shrinks to a one-line strip.
- **Health names the project**: the group is titled *Project* and starts with *Name*, so the
  three groups are Host, Local engine and Project.

## 1.11.1

- **The Dashboard and Health show the host's part from the start**: opened before the project's
  state had loaded, they kept showing no runs and no releases until something changed.

## 1.11.0

- **The Dashboard opens by itself** at the first start after the install.
- **Every error message offers *Open Dashboard***, next to the button that fixes it.

## 1.10.0

- **Catalog keeps up by itself**: after Connect, Set up local CI or a release, the Catalog
  view redraws as soon as the project's software, pipeline or releases change on the host
  (the draft entry appears, a finished build's release shows) — no manual refresh.
- **A running build is followed wherever it was started**: when the toolbox sees the run of
  `HEAD` running (a push from a terminal, a run started on the host), it polls until it ends,
  not only after its own push.
- **The end of a build is announced**: when the run of the current commit ends, a notification
  says so — a failure with *Open the log*, a published release (`Rabbit 1.2.0 is published.`)
  with *Play* and *Copy link*. Watching the status bar is no longer needed after a release.
- **Release… asks one question less**: the stable bumps and the beta pre-releases are in one
  list, under a *Stable* and a *Beta* heading; the separate channel question is gone.
- **The status bar leads to what is missing**: on the local engine a project without a
  pipeline opens *Set up local CI*; on another host a software without a linked pipeline opens
  its admin page.
- **Release… on a project without a remote** offers the fix in place: *Connect*, or *Set up
  local CI* on the local engine, and goes on with the release once it is done.
- **Set Host… signs in** to the chosen host when there is no session for it yet.
- **Your own game first in the Catalog**: the current project's software stands right under the
  host, expanded and starred (*this project*), above the platform groups.
- **The Sync view is the last one** in the WarpEngine sidebar and starts collapsed.
- **Servers is called Local Server**: the view shows the containers of the local engine only.
- **Dashboard**: *Open Dashboard* (a button on the project panel, or the Command Palette) opens
  a tab with the sidebar in tables — health with its fixes, the latest runs (the one of `HEAD`
  marked), the releases with *Play*, the local containers, the sync partners and, last, the catalog
  as a table (title, name, platform, status, category) with *Open* on the entries whose project
  was opened in VS Code before — and the project's actions; it redraws when shown and when the state changes.
- **Catalog and Local Server start collapsed**: Local Server opens by itself while no local
  engine is installed (an *Install Local Engine* line in place of the welcome text), Catalog once,
  at its first load with content. A view you open or close stays as you left it.
- **Health view** (above Sync, collapsed at first, its groups too, each showing how many gaps it has): the host, the sign-in, the local engine and its CI, and the
  project's platform, metadata, catalog entry, pipeline and last run, each green, blue, yellow or
  red; a click on a gap runs the step that fixes it or opens its page.
- **Errors come with their fix**: *Sign in first*, *No host is set*, *No local engine*, *not a
  WarpEngine project* and a refused token show a button (*Sign in*, *Set Host…*, *Install Local
  Engine*, *Add WarpEngine to This Project*, *Sign In Again*) in the message and in the views.
- **No more stuck *Not authorized***: a sign-in no longer stores a token the host refuses; on the
  local engine it tries the token file, then the running container's token, and keeps the one
  the engine takes (a reinstalled engine left an old token file behind). The status bar shows
  the refused token and signs in again on a click.
- **Release…, when the host would refuse the metadata**, lists the problems in the Problems view
  and offers *Edit Metadata*.
- **A new game offers Connect** once its folder is open (on the local engine, the local CI offer).
- **Refresh** and **Run Pipeline** are in the Command Palette.

## 1.9.0

- **API reference**: every module, class, interface and public member of the source carries a
  TSDoc comment, and every release publishes the TypeDoc built from them on the wiki at
  https://wiki.teletypegames.org/typedoc/warp-engine-toolbox/latest/ — with a generated
  *Commands and Settings* page (every command, setting, view, task type and problem matcher
  from `package.json`) and the STRUCTURE guide. `npm run docs:check` keeps it at 100% in CI.

## 1.8.1

- **Set up local CI** is back in the project panel while the project has no pipeline on the
  local engine: the notification alone was easy to miss, and once it was gone nothing led there.

## 1.8.0

- **Servers**: a view of the WarpEngine containers on this machine (the engine, the git server,
  the CI and its agent) with their state and ports, a click opens the engine or the git server.
  **Purge Local Engine…** removes all of it: containers, the data folder, volumes, network and
  images.
- **The local CI offers itself**: when the local engine runs a git server and a CI and the open
  project has no pipeline there, a notification offers to set it up; the project panel has no
  *Set Up Local CI* row any more, the command is **Set up local CI** in the palette.
- **Delete from the catalog**: *Delete from Catalog…* on a software and *Delete Release…* on a
  release (soft delete on the host, with a confirmation).
- **Not authorized**: when the host refuses the stored token (e.g. the local engine was
  reinstalled with a new one), the panels show *Not authorized on this host* and one click signs
  in again (**Sign In Again**).
- **Admin page**: the project panel links the software's page in the host's admin web UI (when
  the host's `.well-known` does not say its admin is off).
- The local CI's containers are `warp-engine-local-gitea` and `warp-engine-local-woodpecker*`
  (warp-engine-local 1.4, WarpEngine 5.5.3).

## 1.7.0

- **The local CI is the installer's business**: the *Local CI* view and its Start / Stop /
  Remove are gone. The local engine's installer asks whether the git server and the CI run
  (`--ci on|off`); **Set Up Local CI** uses them and says so when they are off.
- **`wplocal`**: Set Up Local CI adds the `wplocal` remote to the repository open in VS Code
  (WarpEngine 5.5.1).
- **Release to**: *Release…* asks which git remote the tag goes to when there are several, the
  push token hidden in the list.
- The Sync texts name no catalog: another WarpEngine instance, e.g. `https://games.example.org`.

## 1.6.0

- **Set Up Local CI**: on a local engine (WarpEngine 5.4, warp-engine-local 1.2) one button gives
  the project a git server and a CI on this machine: the engine starts Gitea and Woodpecker and
  wires them (the steps show in the notification), puts the project in the local catalog when it
  is not there, connects it, and the toolbox adds the `warp` remote and pushes — the first build
  starts. In the project panel instead of *Connect* while the local engine is the host.
- **Release… on the local CI**: with the local engine as the host and a `warp` remote, the tag
  goes there, so the local Woodpecker builds and publishes it (and Sync sends it on).
- **The Local CI view**: the components of the local engine (git server, CI) with their state;
  *Start*, *Stop*, *Remove…* (with or without the data), *Open in Browser* for the git server
  (its generated password on the clipboard).

## 1.5.0

- **Sync to…**: pairs the local engine with another WarpEngine (5.3, `sync_pairings`) in one
  flow — pick the engine, sign in if needed, choose the channels (stable + beta by default) —
  and checks the connection; an engine on this machine is reached through
  `host.docker.internal`. Rolled back on the other side when the local engine refuses.
- **The Sync view**: the partners of the local engine with their channels, last sync and the
  newest pushes; *Push Now*, *Edit Channels…*, *Check Connection*, *Disconnect* (both sides).
- **Images**: a software's gallery in the catalog — *Add Image…* (PNG, JPEG, GIF, WebP), make one
  the default, move up and down, remove. Works on every host.

## 1.4.0

- **A local engine, found by itself**: on start and refresh the toolbox probes
  `/.well-known/warp-engine` on `127.0.0.1` (WarpEngine 5.2): a
  [WarpEngine Local](https://git.teletypegames.org/engines/warp-engine-local) there shows up as
  **Local** among the hosts, becomes the host when none is set, and the toolbox offers to connect.
- **Signing in with a token file**: a local engine signs in with its `local-token`, without a
  device code; the token is read from the container when the file is not there.
- **Install Local Engine**: runs the BBS-style installer in a terminal (Docker needed) and looks
  for the engine again when the terminal closes; with no host at all the toolbox offers it once.
- Settings: `warpengine.localPort`, `warpengine.localData`.

## 1.3.0

- **More placeholders**: `{title}`, `{author}`, `{description}` and `{catalogUrl}` (the connected
  host's address) beside `{name}`, in the files a `warp-template.json` lists under `fill`.
- **JSON fields set by path**: `json` in a `warp-template.json` sets fields of a JSON file
  (`"warpEngine.brand.name": "{title}"`), so a project keeps working values in its own repository
  and a new one gets them rewritten.
- **Demos can have a manifest too**: a demo repository's own `warp-template.json` takes `fill`,
  `json` and `keep` (files a demo copy otherwise leaves out, such as its `LICENSE`). This is how
  *New Game* on the `electron` platform (WarpEngine 4.3) starts a studio's own store client from
  the WarpEngine Client, pointing at the connected catalog.
- **Template-only files**: `templateOnly` in a template's `warp-template.json` lists the files a
  new project gets only without the demo, so a demo with a different layout is not mixed with
  the template's Hello World.
- **Release… writes the version where the platform keeps it**: a platform whose description names
  a version file (`version.file`, WarpEngine 4.3.1; `package.json` for `electron`) gets the new
  version there, so the tag matches what the CI reads.

## 1.2.0

- **Platform Documentation**: a book button on the platform in the project panel (and a
  command) opens the host's page about the platform — the `docs` link of the platform's
  `tooling` in `GET /build/platforms`. Hosts without one show no button.
- **Templates can name files after the game**: in a template's `warp-template.json`, `{name}` in a
  target path becomes the game's name (`"hello/hello.inc": "{name}.inc"`), and the files listed
  under `fill` get `{name}` replaced in their content too (`name = "{name}"` in a `Cargo.toml`).
- The interface in Hungarian too: VS Code's display language picks it.
- The code is rebuilt in layers (domain model, ports, services; infrastructure; VS Code
  adapters), described in STRUCTURE.md. Nothing changes in how the toolbox works.

## 1.1.0

Release channels (needs WarpEngine 4.0 on the host).

- **Release…** asks for the channel first: **stable** (finishing a running beta, or the next
  patch, minor, major) or **beta** (`1.3.0-beta.1`, then the next beta number).
- **This branch** in the project panel: the development build of the branch you are on, with
  its play link; a notification when a push has built it; **Copy Link** on every link.
- Releases show their channel; development builds stay out of the release list.

## 1.0.1

- **Release…** fetches the tags from the remote before writing the changelog: a tag the
  pipeline set on the forge (the first release after Connect) no longer goes unseen, so the
  changelog lists only the commits since the last release.

## 1.0.0

The first release. Needs a WarpEngine 3.9 or later host (`warpengine.url`).

- **New Game…** from the host's template and demo; **Add WarpEngine to This Project**.
- **Connect**: forge repository, CI, CI token and a draft catalog entry in one step, then push.
- **Metadata** checked against the host's schema for the platform, a form editor, and the
  host's publish check on save (TIC-80 Lua headers too).
- **Pipeline marker** completion and hover, and the full pipeline the host serves.
- **Tasks** from the Makefile with problem matchers, and **Build Like CI** in the builder image.
- **Play**: the local build in the host's web runtime, in a panel or a browser tab.
- **Pipeline status** of the current commit, **Release…** (version, changelog, tag, push).
- **Catalog** view: softwares, releases with an asset checklist, links, pipelines, downloads.
- **Sign In** through the host's tool sign-in; the Admin API registered as an MCP server.
