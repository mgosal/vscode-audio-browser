# Improvements in this branch (v0.2.0)

Verified with `npm run typecheck` and `npm run compile`.

## 1. Type-checking is now actually enforced

**What:** Added a `typecheck` script (`tsc --noEmit`), ran it in CI between
the audit and compile steps, and made `vscode:prepublish` run it before the
minified bundle.

**Why it mattered:** esbuild transpiles without type-checking. The strict
`tsconfig.json` looked like a guarantee but was never executed by any script,
CI step, or publish flow — type errors would ship silently.

**How:** `package.json` scripts + a CI step in
`.github/workflows/ci.yml`. The publish path fails fast on a type error.

## 2. More audio formats: `.opus`, `.oga`, `.aac`

**What:** Registered three new file patterns in the custom-editor selector,
mapped their MIME types (`opus`/`oga` → `audio/ogg`, `aac` → `audio/aac`),
and updated README, CHANGELOG, and marketplace keywords.

**Why it mattered:** Opus is the default output of most modern recorders
(WhatsApp voice notes, OBS, Discord) and AAC is ubiquitous; both play fine in
the VS Code webview runtime but previously opened as binary garbage in the
text editor.

**How:** `package.json` `contributes.customEditors[0].selector` +
`mimeFor()` in `src/AudioPlayerEditorProvider.ts`. No player changes needed —
the existing `<audio>` element handles the codecs.

## Version

Minor bump 0.1.0 → 0.2.0 (new user-facing capability), CHANGELOG entry added.
