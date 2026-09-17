# @browserbasehq/openclaw-browserbase

Browserbase plugin for OpenClaw (with legacy ClawdBot compatibility).

It provides:

- interactive Browserbase credential setup,
- config status/env helpers,
- dynamic skill sync from `github:browserbase/skills`.

## Install

```bash
openclaw plugins install @browserbasehq/openclaw-browserbase
```

For local development:

```bash
openclaw plugins install -l .
```

## Setup

```bash
openclaw browserbase setup
```

By default setup will also sync Browserbase skills from `browserbase/skills` into
`~/.openclaw/skills`.

You can manage skill sync directly:

```bash
openclaw browserbase skills status
openclaw browserbase skills sync
openclaw browserbase skills sync --ref main
openclaw browserbase skills sync --dir ~/.openclaw/skills
```

## Commands

```bash
openclaw browserbase setup                     # prompt for API key
openclaw browserbase status                    # show configuration status
openclaw browserbase status --json             # machine-readable status
openclaw browserbase env --format shell        # export commands
openclaw browserbase env --format dotenv       # dotenv output
openclaw browserbase env --format json         # JSON output
openclaw browserbase where                     # config file path used
openclaw browserbase skills status             # check dynamic skills sync status
openclaw browserbase skills sync               # download/update skills from browserbase/skills
```

Legacy CLI alias support remains:

```bash
clawdbot browserbase setup
```

## Dynamic skills behavior

OpenClaw installs plugins with lifecycle scripts disabled, so plugin install hooks are not a reliable place to fetch remote skill files.

The plugin syncs skills during setup and optionally on startup when no managed installation is present. The downloaded `skills/` subtree determines the skill set; each skill must have a nonempty `SKILL.md` entrypoint.

The shared skills directory remains in place. `.browserbase-skills.json` records the Browserbase-owned directories and each file's hash. Updates validate and stage the new files, preserve unrelated skills, and replace only unchanged managed content. A same-name directory without ownership metadata is a conflict, even if its name resembles an upstream skill. Local edits or additional files inside a managed directory stop an update so they can be preserved separately.

`skills status` reports `absent`, `incomplete`, or `installed`. Installed means the manifest and every recorded file match, not merely that some skill exists. An incomplete installation requires attention; startup does not overwrite it automatically. Existing installations from the older sync implementation lack ownership metadata. Back them up and resolve any conflicting directories before syncing into a clean target; names alone are not proof of ownership.

The target and its ancestors must be real directories, not symlinks; use a canonical path with `--dir`. A sync lock prevents concurrent plugin updates. The transaction journal and staged backups preserve recovery evidence if replacement or rollback is interrupted. Do not remove a lock or journal while a sync is running. After confirming the process has stopped, inspect the journal and recover its retained files before retrying. Recovery from a process crash is manual; the shared directory is not atomically swapped as a whole.

Source: [Browserbase skills](https://github.com/browserbase/skills).

## Development

```bash
pnpm install
pnpm run check-types
node --test tests/skills-sync.test.mjs
```

## References

- OpenClaw Skills: https://docs.openclaw.ai/tools/skills
- OpenClaw Skills Config: https://docs.openclaw.ai/tools/skills-config
- OpenClaw Plugin System: https://docs.openclaw.ai/tools/plugin
- OpenClaw Plugin Manifest: https://docs.openclaw.ai/plugins/manifest
- Browserbase skills reference: https://github.com/browserbase/skills
- Example plugin reference: https://github.com/pepicrft/clawd-plugin-ralph

The sync tests require Node 24 and `COOKBOOK_TAR_MODULE` set to an absolute path to the installed `tar` module entrypoint. They use synthetic archives and temporary directories. They do not download or install skills in the user's OpenClaw directory. Full OpenClaw startup and live upstream synchronization remain unverified.

### JSON5 configuration updates

Credential setup reads OpenClaw's JSON5 configuration, including comments, trailing commas, unquoted keys, and single-quoted strings. Saving preserves unrelated settings and existing plugin settings, including a disabled plugin. It rewrites formatting and removes comments. Environment references remain literal strings; this helper does not resolve includes or validate the complete OpenClaw host schema.

Updates use a same-directory temporary file with mode `0600`, flush it, and rename it over the original. Parse and pre-commit write failures leave the original intact. A plugin lock prevents overlapping setup writes, and a byte/stat check rejects an external edit observed before replacement. Other programs do not share that lock, so this is not a transaction across arbitrary external editors. Symlink config files and invalid plugin subtrees are rejected. After an interrupted process, inspect the config and ensure no setup process is running before removing a stale `<config-path>.browserbase.lock` and retrying.

Local verification uses synthetic JSON5 files and injected filesystem failures:

```sh
node --test tests/config-store.test.mjs
```

Run with Node 24 after installing this package's dependencies. These tests do not read your home configuration or verify a running OpenClaw host.
