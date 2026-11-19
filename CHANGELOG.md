# Changelog

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
