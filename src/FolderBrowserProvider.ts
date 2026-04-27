import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const AUDIO_EXTS = new Set(['.m4a', '.mp3', '.wav', '.ogg', '.flac']);

interface Entry {
  name: string;
  type: 'folder' | 'audio' | 'file';
  fsPath: string;
  size?: string;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) { return `${bytes} B`; }
  if (bytes < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)} KB`; }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readDir(dirPath: string): Entry[] {
  let items: fs.Dirent[];
  try {
    items = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const entries: Entry[] = [];
  for (const item of items) {
    if (item.name.startsWith('.')) { continue; }
    const fsPath = path.join(dirPath, item.name);
    try {
      if (item.isDirectory()) {
        entries.push({ name: item.name, type: 'folder', fsPath });
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        const stat = fs.statSync(fsPath);
        entries.push({
          name: item.name,
          type: AUDIO_EXTS.has(ext) ? 'audio' : 'file',
          fsPath,
          size: humanSize(stat.size),
        });
      }
    } catch { /* skip unreadable */ }
  }

  entries.sort((a, b) => {
    const order = { folder: 0, audio: 1, file: 2 };
    if (order[a.type] !== order[b.type]) { return order[a.type] - order[b.type]; }
    return a.name.localeCompare(b.name);
  });

  return entries;
}

export class FolderBrowserProvider {
  // ── Singleton ─────────────────────────────────────────────────────────────
  private static _instance: FolderBrowserProvider | undefined;

  static getInstance(context: vscode.ExtensionContext): FolderBrowserProvider {
    if (!FolderBrowserProvider._instance) {
      FolderBrowserProvider._instance = new FolderBrowserProvider(context);
    }
    return FolderBrowserProvider._instance;
  }

  static open(context: vscode.ExtensionContext, folderUri?: vscode.Uri): void {
    const instance = FolderBrowserProvider.getInstance(context);
    if (folderUri) {
      instance._currentPath = folderUri.fsPath;
    }
    instance._show();
  }

  // ── Instance ──────────────────────────────────────────────────────────────
  private _panel: vscode.WebviewPanel | undefined;
  private _currentPath: string;
  private _pollTimer: ReturnType<typeof setInterval> | undefined;
  private _lastPolledPath = '';
  private _syncEnabled = true;

  private constructor(private readonly _context: vscode.ExtensionContext) {
    this._currentPath =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ??
      require('os').homedir();
  }

  // ── Explorer sync polling ─────────────────────────────────────────────────
  // VS Code doesn't expose Explorer selection state to extensions.
  // Workaround: programmatically execute copyFilePath (writes selected item
  // to clipboard), read the result, then restore the original clipboard.
  private _startPolling(): void {
    if (this._pollTimer) { return; }
    this._pollTimer = setInterval(() => this._poll(), 900);
  }

  private _stopPolling(): void {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = undefined;
    }
  }

  private async _poll(): Promise<void> {
    if (!this._syncEnabled || !this._panel) { return; }

    try {
      const saved = await vscode.env.clipboard.readText();
      await vscode.commands.executeCommand('copyFilePath');
      const current = await vscode.env.clipboard.readText();
      await vscode.env.clipboard.writeText(saved);

      // Skip if clipboard didn't change (Explorer didn't have focus)
      // or if we already navigated to this path
      if (!current || current === this._lastPolledPath) { return; }
      if (!path.isAbsolute(current)) { return; }

      let stat: fs.Stats;
      try { stat = fs.statSync(current); } catch { return; }

      this._lastPolledPath = current;
      const dir = stat.isDirectory() ? current : path.dirname(current);

      if (dir !== this._currentPath) {
        this._navigate(dir);
      }
    } catch { /* transient failures are harmless in a poll loop */ }
  }

  /** Called by extension.ts when the active editor changes */
  onActiveEditorChanged(editor: vscode.TextEditor | undefined): void {
    if (!this._syncEnabled || !this._panel || !editor) { return; }
    if (editor.document.uri.scheme !== 'file') { return; }
    const parentDir = path.dirname(editor.document.uri.fsPath);
    if (parentDir !== this._currentPath) {
      this._lastPolledPath = parentDir;
      this._navigate(parentDir);
    }
  }

  // ── Panel lifecycle ───────────────────────────────────────────────────────
  private _show(): void {
    if (this._panel) {
      this._panel.reveal(undefined, true);
      this._navigate(this._currentPath);
      return;
    }

    this._panel = vscode.window.createWebviewPanel(
      'audioBrowser.explorer',
      'Folder Browser',
      { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
      { enableScripts: true, retainContextWhenHidden: true }
    );

    this._panel.webview.html = this._buildHtml();

    this._panel.webview.onDidReceiveMessage(
      (msg: { type: string; path?: string }) => {
        switch (msg.type) {
          case 'ready':
            this._navigate(this._currentPath);
            break;
          case 'openFolder':
            if (msg.path) {
              this._navigate(msg.path);
            }
            break;
          case 'goUp': {
            const parent = path.dirname(this._currentPath);
            if (parent !== this._currentPath) {
              this._navigate(parent);
            }
            break;
          }
          case 'toggleSync':
            this._syncEnabled = !this._syncEnabled;
            this._sendSyncState();
            break;
          case 'openAudio':
            if (msg.path) {
              vscode.commands.executeCommand(
                'vscode.openWith',
                vscode.Uri.file(msg.path),
                'audioBrowser.player'
              );
            }
            break;
        }
      },
      undefined,
      this._context.subscriptions
    );

    this._panel.onDidDispose(() => {
      this._stopPolling();
      this._panel = undefined;
      FolderBrowserProvider._instance = undefined;
    }, undefined, this._context.subscriptions);

    this._startPolling();
  }

  private _navigate(dirPath: string): void {
    this._currentPath = dirPath;
    this._lastPolledPath = dirPath;
    if (!this._panel) { return; }
    this._panel.title = `📁 ${path.basename(dirPath) || dirPath}`;
    this._panel.webview.postMessage({
      type: 'load',
      cwd: dirPath,
      entries: readDir(dirPath),
      syncEnabled: this._syncEnabled,
    });
  }

  private _sendSyncState(): void {
    if (!this._panel) { return; }
    this._panel.webview.postMessage({
      type: 'syncState',
      syncEnabled: this._syncEnabled,
    });
  }

  // ── HTML ──────────────────────────────────────────────────────────────────
  private _buildHtml(): string {
    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
  <title>Folder Browser</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family, -apple-system, system-ui, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
    }

    #toolbar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.2));
      flex-shrink: 0;
    }

    .tb-btn {
      background: none;
      border: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.3));
      border-radius: 4px;
      color: var(--vscode-editor-foreground);
      cursor: pointer;
      padding: 3px 8px;
      font-size: 11px;
      line-height: 1.6;
      white-space: nowrap;
      flex-shrink: 0;
      opacity: 0.7;
      transition: opacity 0.12s, background 0.12s;
    }
    .tb-btn:hover { opacity: 1; background: var(--vscode-list-hoverBackground); }
    .tb-btn.active {
      opacity: 1;
      background: var(--vscode-button-background, #0078d4);
      color: var(--vscode-button-foreground, #fff);
      border-color: transparent;
    }

    #cwd {
      flex: 1;
      font-size: 11px;
      opacity: 0.5;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      direction: rtl;
      text-align: left;
      min-width: 0;
    }

    #list {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0 16px;
    }
    #list::-webkit-scrollbar { width: 6px; }
    #list::-webkit-scrollbar-track { background: transparent; }
    #list::-webkit-scrollbar-thumb {
      background: var(--vscode-scrollbarSlider-background, rgba(128,128,128,0.3));
      border-radius: 3px;
    }

    .section-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      opacity: 0.35;
      padding: 12px 14px 4px;
      user-select: none;
    }

    .entry {
      display: grid;
      grid-template-columns: 20px 1fr auto;
      align-items: center;
      gap: 6px;
      padding: 5px 14px;
      user-select: none;
      border-left: 2px solid transparent;
    }
    .entry.folder, .entry.audio {
      cursor: pointer;
      transition: background 0.08s;
    }
    .entry.folder:hover, .entry.audio:hover { background: var(--vscode-list-hoverBackground); }
    .entry.folder:active, .entry.audio:active { background: var(--vscode-list-activeSelectionBackground); }
    .entry.file { cursor: default; opacity: 0.45; }
    .entry.audio .name { color: var(--vscode-textLink-foreground, #4ec9b0); }

    .icon { font-size: 13px; text-align: center; line-height: 1; }
    .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
    .size {
      font-size: 10px; opacity: 0.45; text-align: right;
      flex-shrink: 0; font-variant-numeric: tabular-nums;
    }
    .entry.folder .size { display: none; }

    #empty {
      display: none; padding: 48px 14px;
      text-align: center; opacity: 0.3; font-size: 12px;
    }
  </style>
</head>
<body>
  <div id="toolbar">
    <button id="up-btn"   class="tb-btn" title="Go up one level">↑ Up</button>
    <button id="sync-btn" class="tb-btn active" title="Sync with Explorer selection">⟳ Sync</button>
    <div id="cwd"></div>
  </div>
  <div id="list"></div>
  <div id="empty">This folder is empty</div>

  <script>
    const vscode  = acquireVsCodeApi();
    const listEl  = document.getElementById('list');
    const cwdEl   = document.getElementById('cwd');
    const emptyEl = document.getElementById('empty');
    const syncBtn = document.getElementById('sync-btn');

    document.getElementById('up-btn').addEventListener('click', () => {
      vscode.postMessage({ type: 'goUp' });
    });
    syncBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'toggleSync' });
    });

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.type === 'syncState' || msg.type === 'load') {
        syncBtn.classList.toggle('active', msg.syncEnabled);
        syncBtn.title = msg.syncEnabled
          ? 'Syncing with Explorer (click to stop)'
          : 'Not syncing (click to sync)';
      }
      if (msg.type !== 'load') { return; }

      cwdEl.textContent = msg.cwd;
      listEl.innerHTML  = '';

      const folders = msg.entries.filter(e => e.type === 'folder');
      const audio   = msg.entries.filter(e => e.type === 'audio');
      const files   = msg.entries.filter(e => e.type === 'file');

      emptyEl.style.display = msg.entries.length === 0 ? 'block' : 'none';

      const appendSection = (label, items) => {
        if (!items.length) { return; }
        const lbl = document.createElement('div');
        lbl.className = 'section-label';
        lbl.textContent = label;
        listEl.appendChild(lbl);
        for (const entry of items) { listEl.appendChild(makeRow(entry)); }
      };

      appendSection('Folders', folders);
      appendSection('Audio Files', audio);
      appendSection('Files', files);
    });

    function makeRow(entry) {
      const row = document.createElement('div');
      row.className = 'entry ' + entry.type;

      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.textContent =
        entry.type === 'folder' ? '📁' :
        entry.type === 'audio'  ? '🎵' : '📄';

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = entry.name;
      name.title = entry.fsPath;

      const size = document.createElement('span');
      size.className = 'size';
      size.textContent = entry.size ?? '';

      row.appendChild(icon);
      row.appendChild(name);
      row.appendChild(size);

      if (entry.type === 'folder') {
        row.addEventListener('click', () => {
          vscode.postMessage({ type: 'openFolder', path: entry.fsPath });
        });
      } else if (entry.type === 'audio') {
        row.addEventListener('click', () => {
          vscode.postMessage({ type: 'openAudio', path: entry.fsPath });
        });
      }

      return row;
    }

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}
