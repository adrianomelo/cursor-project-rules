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

        // Group rules by repository
        const rulesByRepo: Map<string, Rule[]> = new Map();
        rules.forEach(rule => {
            const repoRules = rulesByRepo.get(rule.repoUrl) || [];
            repoRules.push(rule);
            rulesByRepo.set(rule.repoUrl, repoRules);
        });

        // Create quick pick items with repository groups
        const items: RuleQuickPickItem[] = [];
        rulesByRepo.forEach((repoRules, repoUrl) => {
            // Add a separator item for the repository with a nicer display name
            const repoDisplayName = getRepoDisplayName(repoUrl);
            items.push({
                label: `$(repo) ${repoDisplayName}`,
                description: repoUrl,
                kind: vscode.QuickPickItemKind.Separator,
                rule: null
            });
            
            // Add rule items with checkbox indicators in the label
            repoRules.forEach(rule => {
                const isInstalled = installedRuleNames.includes(rule.name);
                items.push({
                    // Use Unicode checkbox symbols to emphasize selection state
                    label: `$(check-square) ${rule.name}`,
                    description: isInstalled ? '$(check) Already installed' : '',
                    detail: `From: ${repoDisplayName} (${repoUrl})`,
                    rule: rule,
                    alwaysShow: isInstalled // Always show installed rules
                });
            });
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

// Helper function to extract a shorter display name from the repository URL
function getRepoDisplayName(repoUrl: string): string {
    try {
        // Extract owner/repo from GitHub URL
        if (repoUrl.includes('github.com')) {
            const parts = repoUrl.split('/');
            // Look for the owner and repo parts
            const githubIndex = parts.findIndex(part => part.includes('github.com'));
            if (githubIndex >= 0 && parts.length > githubIndex + 2) {
                const owner = parts[githubIndex + 1];
                const repo = parts[githubIndex + 2].replace('.git', '');
                return `${owner}/${repo}`;
            }
        }
        
        // For non-GitHub URLs or if parsing fails, return a shortened form
        return new URL(repoUrl).hostname + '/' + repoUrl.split('/').pop()?.replace('.git', '');
    } catch (error) {
        // If parsing fails, just return the URL
        return repoUrl;
    }
} 