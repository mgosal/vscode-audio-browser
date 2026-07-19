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
  // ── CustomReadonlyEditorProvider ─────────────────────────────────────────

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

    webviewPanel.webview.options = {
      enableScripts: false,
      localResourceRoots: [fileDir],
    };

    // Convert the on-disk path to a URI the webview sandbox can load
    const srcUri = webviewPanel.webview.asWebviewUri(document.uri);

    webviewPanel.webview.html = buildPlayerHtml(
      filename,
      srcUri,
      mimeType,
      webviewPanel.webview.cspSource
    );
    webviewPanel.title = filename;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function mimeFor(ext: string): string {
  const map: Record<string, string> = {
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    opus: 'audio/ogg',
    flac: 'audio/flac',
    aac: 'audio/aac',
  };
  return map[ext] ?? 'audio/mpeg';
}

function buildPlayerHtml(
  filename: string,
  srcUri: vscode.Uri,
  mimeType: string,
  cspSource: string
): string {
  const safeSrc = escapeHtml(srcUri.toString());
  const safeFilename = escapeHtml(filename);
  const safeMimeType = escapeHtml(mimeType);

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; media-src ${cspSource}; style-src 'unsafe-inline';"
  />
  <title>${safeFilename}</title>
  <style>
    *,
    *::before,
    *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

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

    .icon {
      font-size: 3rem;
      line-height: 1;
      user-select: none;
    }

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
    <div class="icon">🎵</div>
    <div class="filename">${safeFilename}</div>
    <audio
      id="player"
      controls
      autoplay
    >
      <source src="${safeSrc}" type="${safeMimeType}" />
      <p>Your browser does not support this audio format.</p>
    </audio>
    <p class="hint">Use the controls above to play, pause, and seek.</p>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
