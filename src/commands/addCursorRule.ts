import * as vscode from 'vscode';
import { RuleManager, Rule } from '../utils/ruleManager';

export async function addCursorRuleCommand(context: vscode.ExtensionContext) {
    try {
        const ruleManager = RuleManager.getInstance(context);
        
        const quickPick = vscode.window.createQuickPick<RuleQuickPickItem>();
        quickPick.placeholder = 'Loading...';
        quickPick.busy = true;
        quickPick.show();

        let rules: Rule[] = [];
        try {
            rules = await ruleManager.getAllRules();
            
            if (rules.length === 0) {
                vscode.window.showInformationMessage('No rules found. Try refreshing repositories or adding new ones.');
                quickPick.hide();
                return;
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error loading rules list: ${error}`);
            quickPick.hide();
            return;
        }

        // Group rules by repository
        const rulesByRepo: Map<string, Rule[]> = new Map();
        rules.forEach(rule => {
            const repoRules = rulesByRepo.get(rule.repoUrl) || [];
            repoRules.push(rule);
            rulesByRepo.set(rule.repoUrl, repoRules);
        });

        const items: RuleQuickPickItem[] = [];
        rulesByRepo.forEach((repoRules, repoUrl) => {
            // Skip repository separator headers - they will no longer be displayed
            
            // Add rule items with repository information
            repoRules.forEach(rule => {

                items.push({
                    label: `$(file) ${rule.name}`,
                    description: '', // Show friendly repo name
                    detail: rule.repoUrl, // Show full repo URL in detail
                    rule
                });
            });
        });

        quickPick.items = items;
        quickPick.placeholder = 'Select a rule to install';
        quickPick.busy = false;

        const selected = await new Promise<Rule | undefined>(resolve => {
            quickPick.onDidAccept(() => {
                const selection = quickPick.selectedItems[0];
                if (selection && selection.rule) {
                    resolve(selection.rule);
                } else {
                    resolve(undefined);
                }
                quickPick.hide();
            });
            quickPick.onDidHide(() => {
                resolve(undefined);
            });
        });

        if (!selected) {
            vscode.window.showInformationMessage('No rule selected.');
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('Please open a workspace first.');
            return;
        }

        await ruleManager.installRule(selected);
    } catch (error) {
        vscode.window.showErrorMessage(`Error adding rule: ${error}`);
    }
}

interface RuleQuickPickItem extends vscode.QuickPickItem {
    rule: Rule | null;
}
