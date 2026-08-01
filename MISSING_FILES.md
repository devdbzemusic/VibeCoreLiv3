# VibeCoreLiv3 — Missing Files

Generated: 2026-08-01T01:12:05.122Z

Files/paths referenced or expected but not present in the export.

## Inherently unreachable from the browser

- `.git/` — version-control object data cannot be read client-side. Re-export from a local clone with `git archive` if full history is required.
- `node_modules/`, `dist/`, `build/`, `coverage/`, `.cache/`, `.gradle/`, `.idea/`, `.vscode/`, `tmp/`, `temp/` — explicitly excluded per spec.
- Dotfiles at project root (e.g. `.gitignore`) may be skipped by the globber if the platform's `dot` matching is off; verify presence after restore.

## Referenced-but-missing source imports

| Source file | Specifier | Likely cause | Recommendation |
| --- | --- | --- | --- |
| src/components/groovebox/GithubSyncDialog.tsx | `@/lib/downloadSource` | not found in captured file set | verify path/alias or add the file |
