# Changelog

## Unreleased

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
