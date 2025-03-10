import * as vscode from 'vscode';
import { RuleManager } from '../utils/ruleManager';

export async function addAllRulesCommand(context: vscode.ExtensionContext) {
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('Please open a workspace first.');
            return;
        }

        const ruleManager = RuleManager.getInstance(context);
        await ruleManager.installAllRules();
    } catch (error) {
        vscode.window.showErrorMessage(`Error adding all rules: ${error}`);
    }
} 