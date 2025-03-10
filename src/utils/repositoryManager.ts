import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import simpleGit, { SimpleGit } from 'simple-git';
import { Rule } from './ruleManager';

const mkdir = promisify(fs.mkdir);
const exists = promisify(fs.exists);

export interface Repository {
    url: string;
    enabled: boolean;
    branch: string;
    rulesDir: string;
    autoUpdate: boolean;
}

export class RepositoryManager {
    private static instance: RepositoryManager;
    private context: vscode.ExtensionContext;
    private repoStoragePath: string;
    
    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.repoStoragePath = path.join(context.globalStoragePath, 'repositories');
    }

    static getInstance(context: vscode.ExtensionContext): RepositoryManager {
        if (!RepositoryManager.instance) {
            RepositoryManager.instance = new RepositoryManager(context);
        }
        return RepositoryManager.instance;
    }

    async initialize(): Promise<void> {
        if (!await exists(this.repoStoragePath)) {
            await mkdir(this.repoStoragePath, { recursive: true });
        }
        
        // Initialize repositories based on configuration
        await this.refreshRepositories();
    }

    private getRepositories(): Repository[] {
        const config = vscode.workspace.getConfiguration('cursorProjectRules');
        return config.get<Repository[]>('repositories') || [];
    }
    
    private getEnabledRepositories(): Repository[] {
        return this.getRepositories().filter(repo => repo.enabled);
    }

    private getRepoPath(repoUrl: string): string {
        // Create a unique folder name based on the repository URL
        const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 
                        Buffer.from(repoUrl).toString('base64');
        return path.join(this.repoStoragePath, repoName);
    }

    async refreshRepositories(): Promise<void> {
        const repos = this.getRepositories();
        
        for (const repo of repos) {
            if (!repo.enabled) continue;
            
            const repoPath = this.getRepoPath(repo.url);
            const git: SimpleGit = simpleGit();
            
            try {
                if (!await exists(repoPath)) {
                    // Clone the repository if it doesn't exist
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: `Cloning repository: ${repo.url}`,
                        cancellable: false
                    }, async () => {
                        await git.clone(repo.url, repoPath, ['--branch', repo.branch]);
                    });
                } else if (repo.autoUpdate) {
                    // Pull latest changes if autoUpdate is enabled
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: `Updating repository: ${repo.url}`,
                        cancellable: false
                    }, async () => {
                        const localGit = simpleGit(repoPath);
                        await localGit.checkout(repo.branch);
                        await localGit.pull();
                    });
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Error with repository ${repo.url}: ${error}`);
            }
        }
    }

    async getAllRules(): Promise<Rule[]> {
        const enabledRepos = this.getEnabledRepositories();
        const allRules: Rule[] = [];
        
        for (const repo of enabledRepos) {
            const repoPath = this.getRepoPath(repo.url);
            const rulesPath = path.join(repoPath, repo.rulesDir);
            
            if (!await exists(rulesPath)) {
                continue;
            }
            
            try {
                const entries = await fs.promises.readdir(rulesPath, { withFileTypes: true });
                for (const entry of entries) {
                    // Look for .mdc files directly in the rules directory
                    if (entry.isFile() && entry.name.endsWith('.mdc')) {
                        // Extract name from the filename without the extension
                        const ruleName = path.basename(entry.name, '.mdc');
                        
                        allRules.push({
                            name: ruleName,
                            repoUrl: repo.url,
                            path: rulesPath,
                            enabled: true
                        });
                    }
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Error reading rules from ${repo.url}: ${error}`);
            }
        }
        
        return allRules;
    }

    async updateRepository(repoUrl: string): Promise<void> {
        const repos = this.getRepositories();
        const repo = repos.find(r => r.url === repoUrl);
        
        if (!repo) {
            throw new Error(`Repository ${repoUrl} not found in configuration`);
        }
        
        const repoPath = this.getRepoPath(repoUrl);
        
        if (!await exists(repoPath)) {
            throw new Error(`Repository directory not found: ${repoPath}`);
        }
        
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Updating repository: ${repoUrl}`,
                cancellable: false
            }, async () => {
                const git = simpleGit(repoPath);
                await git.checkout(repo.branch);
                await git.pull();
            });
            
            vscode.window.showInformationMessage(`Repository ${repoUrl} updated successfully`);
        } catch (error) {
            vscode.window.showErrorMessage(`Error updating repository: ${error}`);
            throw error;
        }
    }

    async addRepository(repo: Repository): Promise<void> {
        const repos = this.getRepositories();
        
        // Check if repository already exists
        const existingRepoIndex = repos.findIndex(r => r.url === repo.url);
        
        if (existingRepoIndex !== -1) {
            // Update existing repository
            repos[existingRepoIndex] = { ...repos[existingRepoIndex], ...repo };
        } else {
            // Add new repository
            repos.push(repo);
        }
        
        // Update configuration
        await vscode.workspace.getConfiguration('cursorProjectRules').update(
            'repositories', 
            repos, 
            vscode.ConfigurationTarget.Global
        );
        
        // Clone/update repository if enabled
        if (repo.enabled) {
            const repoPath = this.getRepoPath(repo.url);
            
            if (!await exists(repoPath)) {
                try {
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: `Cloning repository: ${repo.url}`,
                        cancellable: false
                    }, async () => {
                        const git = simpleGit();
                        await git.clone(repo.url, repoPath, ['--branch', repo.branch]);
                    });
                } catch (error) {
                    vscode.window.showErrorMessage(`Error cloning repository: ${error}`);
                    throw error;
                }
            }
        }
    }

    async removeRepository(repoUrl: string): Promise<void> {
        const repos = this.getRepositories().filter(r => r.url !== repoUrl);
        
        // Update configuration
        await vscode.workspace.getConfiguration('cursorProjectRules').update(
            'repositories', 
            repos, 
            vscode.ConfigurationTarget.Global
        );
        
        // Note: We don't delete the repository directory to avoid data loss
        // If needed, a cleanup function could be added here
    }
} 