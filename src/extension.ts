import * as vscode from 'vscode';
import { AudioPlayerEditorProvider } from './AudioPlayerEditorProvider';

export function activate(context: vscode.ExtensionContext): void {
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
}

export function deactivate(): void {}
