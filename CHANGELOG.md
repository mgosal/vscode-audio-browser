# Changelog

All notable changes to this project will be documented in this file.

## 0.2.0 - 2026-07-19

- Added support for `.opus`, `.oga`, and `.aac` files.
- Type-checking (`tsc --noEmit`) now runs in CI and before publishing; the
  esbuild bundle alone never enforced the strict compiler options.

## 0.1.0 - 2026-05-04

- Initial release.
- Added a custom read-only editor for `.m4a`, `.mp3`, `.wav`, `.ogg`, and `.flac` files.
- Added inline playback with native HTML5 audio controls in a VS Code webview.
