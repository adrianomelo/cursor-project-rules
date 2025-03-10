import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { RepositoryManager } from './repositoryManager';

const mkdir = promisify(fs.mkdir);
const copyFile = promisify(fs.copyFile);
const exists = promisify(fs.exists);

export interface Rule {
    name: string;
    repoUrl: string;
    path: string;
    enabled: boolean;
}

export class RuleManager {
    private static instance: RuleManager;
    private context: vscode.ExtensionContext;
    private repositoryManager: RepositoryManager;
    
    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.repositoryManager = RepositoryManager.getInstance(context);
    }
    
    static getInstance(context: vscode.ExtensionContext): RuleManager {
        if (!RuleManager.instance) {
            RuleManager.instance = new RuleManager(context);
        }
        return RuleManager.instance;
    }
    
    async initialize(): Promise<void> {
        await this.repositoryManager.initialize();
    }
    
    async getAllRules(): Promise<Rule[]> {
        return this.repositoryManager.getAllRules();
    }
    
    async refreshRules(): Promise<void> {
        await this.repositoryManager.refreshRepositories();
    }
    
    private getLocalRulesDir(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('No workspace folder open');
        }
        
        const config = vscode.workspace.getConfiguration('cursorRules');
        const localRulesDir = config.get<string>('localRulesDir') || '.cursor/rules';
        
        return path.join(workspaceFolders[0].uri.fsPath, localRulesDir);
    }
    
    async installRule(rule: Rule): Promise<void> {
        const localRulesDir = this.getLocalRulesDir();
        
        // Create the rules directory if it doesn't exist
        if (!await exists(localRulesDir)) {
            await mkdir(localRulesDir, { recursive: true });
        }
        
        // Copy the .mdc file to the local rules directory
        const ruleFilePath = path.join(rule.path, `${rule.name}.mdc`);
        
        // For .mdc files, we copy directly to the rules directory
        const targetFilePath = path.join(localRulesDir, `${rule.name}.mdc`);
        
        try {
            await copyFile(ruleFilePath, targetFilePath);
            vscode.window.showInformationMessage(`Rule "${rule.name}" installed successfully`);
        } catch (error) {
            vscode.window.showErrorMessage(`Error installing rule "${rule.name}": ${error}`);
            throw error;
        }
    }
    
    async installAllRules(): Promise<void> {
        const rules = await this.getAllRules();
        
        if (rules.length === 0) {
            vscode.window.showInformationMessage('No rules found to install');
            return;
        }
        
        let succeeded = 0;
        let failed = 0;
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Installing all rules',
            cancellable: false
        }, async (progress) => {
            const increment = 100 / rules.length;
            
            for (const rule of rules) {
                try {
                    await this.installRule(rule);
                    succeeded++;
                } catch (error) {
                    failed++;
                }
                
                progress.report({ increment, message: `${succeeded} of ${rules.length} installed` });
            }
        });
        
        if (failed === 0) {
            vscode.window.showInformationMessage(`All ${succeeded} rules installed successfully`);
        } else {
            vscode.window.showWarningMessage(`${succeeded} rules installed, ${failed} failed`);
        }
    }
} 