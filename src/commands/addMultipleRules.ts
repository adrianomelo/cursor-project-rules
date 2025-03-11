import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { RuleManager, Rule } from '../utils/ruleManager';

const exists = promisify(fs.exists);
const readdir = promisify(fs.readdir);

export async function addMultipleRulesCommand(context: vscode.ExtensionContext) {
    try {
        const ruleManager = RuleManager.getInstance(context);
        
        const quickPick = vscode.window.createQuickPick<RuleQuickPickItem>();
        quickPick.placeholder = 'Loading...';
        quickPick.canSelectMany = true; // Enable multi-select
        quickPick.busy = true;
        quickPick.show();

        // Get all rules from repositories
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

        // Get the local rules directory path
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('Please open a workspace first.');
            quickPick.hide();
            return;
        }
        
        const config = vscode.workspace.getConfiguration('cursorProjectRules');
        const localRulesDir = path.join(
            workspaceFolders[0].uri.fsPath, 
            config.get<string>('localRulesDir') || '.cursor/rules'
        );
        
        // Check which rules are already installed
        let installedRuleNames: string[] = [];
        if (await exists(localRulesDir)) {
            try {
                const files = await readdir(localRulesDir);
                installedRuleNames = files
                    .filter(file => file.endsWith('.mdc'))
                    .map(file => path.basename(file, '.mdc'));
            } catch (error) {
                console.error(`Error reading local rules directory: ${error}`);
                // Continue with empty list if directory can't be read
            }
        }

        // Create quick pick items directly from the flat list of rules
        const items: RuleQuickPickItem[] = rules.map(rule => {
            const isInstalled = installedRuleNames.includes(rule.name);
            
            return {
                // Use Unicode checkbox symbols to emphasize selection state
                label: `$(check-square) ${rule.name}`,
                description: '',
                detail: rule.repoUrl,
                rule: rule,
                alwaysShow: isInstalled // Always show installed rules
            };
        });

        quickPick.items = items;
        quickPick.title = 'Cursor Project Rules: Add Multiple Rules';
        quickPick.placeholder = 'Use checkboxes to select/deselect rules, then press Enter';
        quickPick.busy = false;
        
        // Pre-select already installed rules
        quickPick.selectedItems = items.filter(item => 
            item.rule && installedRuleNames.includes(item.rule.name)
        );

        // Add helpful button to select/deselect all
        quickPick.buttons = [
            {
                iconPath: new vscode.ThemeIcon('check-all'),
                tooltip: 'Select All'
            },
            {
                iconPath: new vscode.ThemeIcon('clear-all'),
                tooltip: 'Deselect All'
            }
        ];

        const selectedRules = await new Promise<Rule[]>(resolve => {
            quickPick.onDidTriggerButton(button => {
                // Handle Select All / Deselect All buttons
                if (button.tooltip === 'Select All') {
                    const allRuleItems = items.filter(item => item.rule !== null);
                    quickPick.selectedItems = allRuleItems;
                } else if (button.tooltip === 'Deselect All') {
                    quickPick.selectedItems = [];
                }
            });

            quickPick.onDidAccept(() => {
                const selections = quickPick.selectedItems
                    .filter(item => item.rule !== null)
                    .map(item => item.rule as Rule);
                    
                resolve(selections);
                quickPick.hide();
            });

            quickPick.onDidHide(() => {
                resolve([]);
            });
        });

        if (selectedRules.length === 0) {
            vscode.window.showInformationMessage('No rules selected.');
            return;
        }

        // Install or update all selected rules with progress indicator
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Installing/updating ${selectedRules.length} rules`,
            cancellable: false
        }, async (progress) => {
            const increment = 100 / selectedRules.length;
            let installed = 0;
            let errors = 0;
            
            for (const rule of selectedRules) {
                try {
                    await ruleManager.installRule(rule);
                    installed++;
                } catch (error) {
                    errors++;
                    vscode.window.showErrorMessage(`Failed to install ${rule.name}: ${error}`);
                }
                progress.report({ 
                    increment, 
                    message: `${installed} of ${selectedRules.length} processed`
                });
            }
            
            if (errors === 0) {
                vscode.window.showInformationMessage(
                    `Successfully added ${installed} rules.`
                );
            } else {
                vscode.window.showWarningMessage(
                    `Added ${installed} rules with ${errors} errors.`
                );
            }
        });
        
    } catch (error) {
        vscode.window.showErrorMessage(`Error adding rules: ${error}`);
    }
}

interface RuleQuickPickItem extends vscode.QuickPickItem {
    rule: Rule | null;
}
