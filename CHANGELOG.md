# Changelog

## 1.2.0

- **Platform Documentation**: a book button on the platform in the project panel (and a
  command) opens the host's page about the platform — the `docs` link of the platform's
  `tooling` in `GET /build/platforms`. Hosts without one show no button.

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
