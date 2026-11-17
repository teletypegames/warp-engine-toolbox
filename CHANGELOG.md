# Changelog

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
