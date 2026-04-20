import * as vscode from 'vscode';
import { AudioPlayerEditorProvider } from './AudioPlayerEditorProvider';
import { FolderBrowserProvider } from './FolderBrowserProvider';

export function activate(context: vscode.ExtensionContext): void {
  // ── Audio custom editor ─────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'audioBrowser.player',
      new AudioPlayerEditorProvider(),
      {
        supportsMultipleEditorsPerDocument: true,
        webviewOptions: { retainContextWhenHidden: true },
      }
    )
  );

  // ── Folder browser ──────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'audioBrowser.openExplorer',
      (uri?: vscode.Uri) => {
        FolderBrowserProvider.open(context, uri);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'audioBrowser.browseFolder',
      (uri?: vscode.Uri) => {
        const target = uri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
        if (target) { FolderBrowserProvider.open(context, target); }
      }
    )
  );
}

export function deactivate(): void {}
