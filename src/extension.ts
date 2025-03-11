import * as vscode from 'vscode';
import { addCursorRuleCommand } from './commands/addCursorRule';
import { addAllRulesCommand } from './commands/addAllRules';
import { refreshRepositoriesCommand } from './commands/refreshRepositories';
import { manageRepositoriesCommand } from './commands/manageRepositories';
import { addMultipleRulesCommand } from './commands/addMultipleRules';
import { RuleManager } from './utils/ruleManager';

// Default repositories from the marketplace version
const DEFAULT_REPOSITORIES = [
    {
        "url": "https://github.com/adrianomelo/cursor-rules.git",
        "enabled": true,
        "branch": "main",
        "rulesDir": "rules",
        "autoUpdate": true
    },
    {
        "url": "https://github.com/sanjeed5/awesome-cursor-rules-mdc.git",
        "enabled": true,
        "branch": "main",
        "rulesDir": "rules-mdc",
        "autoUpdate": true
    }
];

export async function activate(context: vscode.ExtensionContext) {
    // Initialize rule manager
    const ruleManager = RuleManager.getInstance(context);
    await ruleManager.initialize();
    
    // Register commands
    let disposable = vscode.commands.registerCommand('cursorProjectRules.addRule', () => {
        return addCursorRuleCommand(context);
    });
    context.subscriptions.push(disposable);
    
    disposable = vscode.commands.registerCommand('cursorProjectRules.addAllRules', () => {
        return addAllRulesCommand(context);
    });
    context.subscriptions.push(disposable);
    
    disposable = vscode.commands.registerCommand('cursorProjectRules.refreshRepositories', () => {
        return refreshRepositoriesCommand(context);
    });
    context.subscriptions.push(disposable);
    
    disposable = vscode.commands.registerCommand('cursorProjectRules.manageRepositories', () => {
        return manageRepositoriesCommand(context);
    });
    context.subscriptions.push(disposable);
    
    disposable = vscode.commands.registerCommand('cursorProjectRules.addMultipleRules', () => {
        return addMultipleRulesCommand(context);
    });
    context.subscriptions.push(disposable);
    
    // Auto-update repositories if configured
    const config = vscode.workspace.getConfiguration('cursorProjectRules');
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

export function deactivate(): Thenable<void> {
    // Clean up repositories when extension is uninstalled
    return new Promise<void>((resolve) => {
        try {
            // Restore default repositories from the marketplace version
            vscode.workspace.getConfiguration('cursorProjectRules').update(
                'repositories',
                DEFAULT_REPOSITORIES,
                vscode.ConfigurationTarget.Global
            ).then(() => {
                console.log('Restored default repositories during extension deactivation');
                resolve();
            });
        } catch (error) {
            console.error('Error during extension deactivation:', error);
            resolve(); // Resolve even on error to allow clean shutdown
        }
    });
} 