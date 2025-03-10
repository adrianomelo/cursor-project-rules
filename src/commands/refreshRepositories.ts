import * as vscode from 'vscode';
import { RuleManager } from '../utils/ruleManager';

export async function refreshRepositoriesCommand(context: vscode.ExtensionContext) {
    try {
        const ruleManager = RuleManager.getInstance(context);
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Refreshing rule repositories',
            cancellable: false
        }, async () => {
            await ruleManager.refreshRules();
        });
        
        vscode.window.showInformationMessage('Repositories refreshed successfully');
    } catch (error) {
        vscode.window.showErrorMessage(`Error refreshing repositories: ${error}`);
    }
} 