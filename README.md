# vscode-audio-browser

A VS Code extension that adds a lightweight file browser panel with built-in audio playback. Click a folder to navigate into it. Click an audio file to open a player view with waveform and transport controls — inline, no external app.

## Why

VS Code has no native audio playback for `.m4a`. The existing `audio-preview` extension works but requires files to be open in an editor tab. This extension adds a dedicated side panel browser so you can navigate to a folder, see its contents, and play audio files without cluttering the editor.

## Planned Features

- **Side panel file browser** — navigate any directory, not just the workspace
- **Audio player view** — opens when you click a supported audio file: play, pause, seek, volume
- **Supported formats** — `.m4a`, `.mp3`, `.wav`, `.ogg`, `.flac`
- **Folder pinning** — pin frequently accessed directories (e.g. `integrations/voice-note/recordings/`)
- **File metadata** — duration, size, creation date shown in the browser list

## Out of Scope (v1)

- Editing or transcoding audio
- Playlist / queue management
- Integration with external music libraries

## Tech

VS Code extension (TypeScript) using the `TreeView` API for the file browser panel and a `WebviewPanel` for the audio player (HTML5 `<audio>` element + Web Audio API for waveform).

## Status

🚧 In development
