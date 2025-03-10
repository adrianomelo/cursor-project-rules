import * as vscode from 'vscode';
import { addCursorRuleCommand } from './commands/addCursorRule';
import { addAllRulesCommand } from './commands/addAllRules';
import { refreshRepositoriesCommand } from './commands/refreshRepositories';
import { manageRepositoriesCommand } from './commands/manageRepositories';
import { addMultipleRulesCommand } from './commands/addMultipleRules';
import { RuleManager } from './utils/ruleManager';

export async function activate(context: vscode.ExtensionContext) {
    // Initialize rule manager
    const ruleManager = RuleManager.getInstance(context);
    await ruleManager.initialize();
    
    // Register commands
    let disposable = vscode.commands.registerCommand('cursorRules.addRule', () => {
        return addCursorRuleCommand(context);
    });
    context.subscriptions.push(disposable);
    
    disposable = vscode.commands.registerCommand('cursorRules.addAllRules', () => {
        return addAllRulesCommand(context);
    });
    context.subscriptions.push(disposable);
    
    disposable = vscode.commands.registerCommand('cursorRules.refreshRepositories', () => {
        return refreshRepositoriesCommand(context);
    });
    context.subscriptions.push(disposable);
    
    disposable = vscode.commands.registerCommand('cursorRules.manageRepositories', () => {
        return manageRepositoriesCommand(context);
    });
    context.subscriptions.push(disposable);
    
    disposable = vscode.commands.registerCommand('cursorRules.addMultipleRules', () => {
        return addMultipleRulesCommand(context);
    });
    context.subscriptions.push(disposable);
    
    // Auto-update repositories if configured
    const config = vscode.workspace.getConfiguration('cursorRules');
    const repositories = config.get<any[]>('repositories') || [];
    const hasAutoUpdateEnabled = repositories.some(repo => repo.enabled && repo.autoUpdate);
    
    if (hasAutoUpdateEnabled) {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: 'Updating cursor rule repositories'
        }, async () => {
            await ruleManager.refreshRules();
        });
    }
}

export function deactivate() {} 