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

        // Create items directly from the flat list of rules
        const items: RuleQuickPickItem[] = rules.map(rule => ({           
            label: `$(file) ${rule.name}`,
            description: '',
            detail: rule.repoUrl,
            rule
        }));

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
