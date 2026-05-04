# Audio Browser

Audio Browser is a VS Code extension that opens local audio files in an inline editor player.

Open a supported audio file from the VS Code Explorer and the extension renders a lightweight player in an editor tab. Playback uses the browser audio control inside a VS Code webview, so you can play, pause, and seek without switching to another app.

## Features

- Opens `.m4a`, `.mp3`, `.wav`, `.ogg`, and `.flac` files with a custom editor.
- Uses VS Code's webview sandbox and native HTML5 audio controls.
- Keeps audio playback in the editor area instead of launching an external media player.
- Supports multiple audio editor tabs.

## Usage

1. Install and enable the extension.
2. Open a supported audio file from the VS Code Explorer.
3. Use the inline player controls to play, pause, and seek.

## Current Scope

The current release is a focused custom editor for local audio playback. It does not add a separate side-panel file browser, waveform visualization, playlists, transcoding, or audio editing.

Playback support can vary by platform because it depends on the codecs available to the VS Code webview runtime.

## Development

Install dependencies:

```sh
npm install
```

Compile the extension:

```sh
npm run compile
```

Launch the Extension Development Host from VS Code:

1. Open this repository in VS Code.
2. Press `F5`.
3. In the new VS Code window, open a supported audio file.

## Packaging

Install the VS Code extension publishing tool:

```sh
npm install -g @vscode/vsce
```

Create a local VSIX package:

```sh
vsce package
```

Publish to the VS Code Extension Marketplace:

```sh
vsce publish
```

See the official VS Code publishing guide for publisher setup and Personal Access Token requirements:

https://code.visualstudio.com/api/working-with-extensions/publishing-extension

## Future Ideas

- Optional side-panel browser for audio folders.
- Waveform visualization.
- File metadata such as duration, size, and created date.
- Folder pinning for frequently used recording directories.

## License

MIT
