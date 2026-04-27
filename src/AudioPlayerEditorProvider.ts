import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Minimal document wrapper — we only need the URI.
 * VS Code requires a CustomDocument implementation even for read-only editors.
 */
class AudioDocument implements vscode.CustomDocument {
  constructor(public readonly uri: vscode.Uri) {}
  dispose(): void {}
}

export class AudioPlayerEditorProvider
  implements vscode.CustomReadonlyEditorProvider<AudioDocument>
{
  private static readonly SEEK_KEY = 'audioBrowser.seekPositions';

  constructor(private readonly _context: vscode.ExtensionContext) {}

  private _getSeek(filePath: string): number {
    const all = this._context.workspaceState.get<Record<string, number>>(
      AudioPlayerEditorProvider.SEEK_KEY, {}
    );
    return all[filePath] ?? 0;
  }

  private _setSeek(filePath: string, time: number): void {
    const all = this._context.workspaceState.get<Record<string, number>>(
      AudioPlayerEditorProvider.SEEK_KEY, {}
    );
    all[filePath] = time;
    this._context.workspaceState.update(AudioPlayerEditorProvider.SEEK_KEY, all);
  }

  openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): AudioDocument {
    return new AudioDocument(uri);
  }

  resolveCustomEditor(
    document: AudioDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): void {
    const fileDir = vscode.Uri.file(path.dirname(document.uri.fsPath));
    const filename = path.basename(document.uri.fsPath);
    const ext = path.extname(filename).toLowerCase().slice(1);
    const mimeType = mimeFor(ext);
    const filePath = document.uri.fsPath;

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [fileDir],
    };

    const srcUri = webviewPanel.webview.asWebviewUri(document.uri);
    const savedTime = this._getSeek(filePath);

    webviewPanel.webview.html = buildPlayerHtml(filename, srcUri, mimeType, savedTime);
    webviewPanel.title = filename;

    // Listen for seek position updates from the webview
    webviewPanel.webview.onDidReceiveMessage((msg: { type: string; time?: number }) => {
      if (msg.type === 'seek' && typeof msg.time === 'number') {
        this._setSeek(filePath, msg.time);
      }
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function mimeFor(ext: string): string {
  const map: Record<string, string> = {
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
  };
  return map[ext] ?? 'audio/mpeg';
}

function buildPlayerHtml(
  filename: string,
  srcUri: vscode.Uri,
  mimeType: string,
  startTime: number
): string {
  const safeSrc = srcUri.toString();
  const safeFilename = filename
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const mediaOrigin = srcUri.toString().split('/').slice(0, 3).join('/');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; media-src ${mediaOrigin} vscode-resource:; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
  <title>${safeFilename}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family, system-ui, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      padding: 2rem;
    }

    .card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
      width: 100%;
      max-width: 560px;
      padding: 2rem 2.5rem;
      border-radius: 8px;
      background-color: var(--vscode-editor-inactiveSelectionBackground, rgba(255,255,255,0.04));
      border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.1));
    }

    .icon { font-size: 3rem; line-height: 1; user-select: none; }

    .filename {
      font-size: 1rem;
      font-weight: 600;
      color: var(--vscode-editor-foreground);
      text-align: center;
      word-break: break-all;
      opacity: 0.9;
    }

    audio {
      width: 100%;
      accent-color: var(--vscode-focusBorder, #0078d4);
      border-radius: 4px;
      outline: none;
    }

    .hint {
      font-size: 0.75rem;
      color: var(--vscode-descriptionForeground, #888);
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">\u{1F3B5}</div>
    <div class="filename">${safeFilename}</div>
    <audio id="player" controls autoplay>
      <source src="${safeSrc}" type="${mimeType}" />
      <p>Your browser does not support this audio format.</p>
    </audio>
    <p class="hint">Use the controls above to play, pause, and seek.</p>
  </div>

  <script>
    (function () {
      var vsc   = acquireVsCodeApi();
      var audio = document.getElementById('player');
      var startTime = ${startTime};

      // Restore saved seek position once audio metadata is loaded
      if (startTime > 0) {
        audio.addEventListener('loadedmetadata', function () {
          audio.currentTime = startTime;
        }, { once: true });
      }

      // Report position back to extension host for persistence
      function report() {
        vsc.postMessage({ type: 'seek', time: audio.currentTime });
      }

      audio.addEventListener('pause', report);
      audio.addEventListener('seeked', report);
      // Throttled timeupdate — save every ~2 seconds during playback
      var last = 0;
      audio.addEventListener('timeupdate', function () {
        var now = Date.now();
        if (now - last > 2000) {
          last = now;
          report();
        }
      });
    })();
  </script>
</body>
</html>`;
}
