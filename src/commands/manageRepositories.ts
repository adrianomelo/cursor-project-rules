import * as vscode from 'vscode';
import { Repository, RepositoryManager } from '../utils/repositoryManager';

export async function manageRepositoriesCommand(context: vscode.ExtensionContext) {
    try {
        const repositoryManager = RepositoryManager.getInstance(context);
        
        const config = vscode.workspace.getConfiguration('cursorRules');
        const repositories = config.get<Repository[]>('repositories') || [];
        
        const quickPick = vscode.window.createQuickPick();
        quickPick.placeholder = 'Manage repositories';
        
        const refreshItems = () => {
            const items: vscode.QuickPickItem[] = [
                { label: '$(add) Add new repository', description: 'Add a new rule repository' },
                { label: '$(repo-sync) Refresh all repositories', description: 'Pull latest changes from all repositories' }
            ];
            
            if (repositories.length > 0) {
                items.push({ label: 'Repository List', kind: vscode.QuickPickItemKind.Separator });
                
                repositories.forEach(repo => {
                    items.push({
                        label: `$(repo) ${repo.url}`,
                        description: `Branch: ${repo.branch} | ${repo.enabled ? '$(check) Enabled' : '$(x) Disabled'} | ${repo.autoUpdate ? 'Auto-update' : 'Manual update'}`
                    });
                });
            }
            
            quickPick.items = items;
        };
        
        refreshItems();
        quickPick.show();
        
        quickPick.onDidAccept(async () => {
            const selected = quickPick.selectedItems[0];
            
            if (selected.label === '$(add) Add new repository') {
                quickPick.hide();
                await addNewRepository(repositoryManager);
            } else if (selected.label === '$(repo-sync) Refresh all repositories') {
                quickPick.hide();
                await refreshAllRepositories(repositoryManager);
            } else if (selected.label.startsWith('$(repo)')) {
                // Repository selected
                const repoUrl = selected.label.substring('$(repo) '.length);
                quickPick.hide();
                await manageRepository(repositoryManager, repoUrl);
            }
        });
        
    } catch (error) {
        vscode.window.showErrorMessage(`Error managing repositories: ${error}`);
    }
}

async function addNewRepository(repositoryManager: RepositoryManager): Promise<void> {
    const urlInput = await vscode.window.showInputBox({
        prompt: 'Enter the URL of the Git repository',
        placeHolder: 'https://github.com/username/repo.git',
        validateInput: value => {
            if (!value || !value.trim()) {
                return 'Repository URL is required';
            }
            if (!value.endsWith('.git') && !value.includes('github.com') && !value.includes('gitlab.com')) {
                return 'URL should be a Git repository (e.g., https://github.com/username/repo.git)';
            }
            return null;
        }
    });
    
    if (!urlInput) return;
    
    const branchInput = await vscode.window.showInputBox({
        prompt: 'Enter the branch to use (default: main)',
        placeHolder: 'main',
        value: 'main'
    });
    
    const branch = branchInput || 'main';
    
    const rulesDirInput = await vscode.window.showInputBox({
        prompt: 'Enter the directory containing rules (default: rules)',
        placeHolder: 'rules',
        value: 'rules'
    });
    
    const rulesDir = rulesDirInput || 'rules';
    
    const autoUpdateOptions = ['Yes', 'No'];
    const autoUpdateResult = await vscode.window.showQuickPick(autoUpdateOptions, {
        placeHolder: 'Automatically update this repository?'
    });
    
    const autoUpdate = autoUpdateResult === 'Yes';
    
    try {
        await repositoryManager.addRepository({
            url: urlInput,
            enabled: true,
            branch,
            rulesDir,
            autoUpdate
        });
        
        vscode.window.showInformationMessage(`Repository ${urlInput} added successfully`);
    } catch (error) {
        vscode.window.showErrorMessage(`Error adding repository: ${error}`);
    }
}

async function refreshAllRepositories(repositoryManager: RepositoryManager): Promise<void> {
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Refreshing all repositories',
            cancellable: false
        }, async () => {
            await repositoryManager.refreshRepositories();
        });
        
        vscode.window.showInformationMessage('All repositories refreshed successfully');
    } catch (error) {
        vscode.window.showErrorMessage(`Error refreshing repositories: ${error}`);
    }
}

async function manageRepository(repositoryManager: RepositoryManager, repoUrl: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('cursorRules');
    const repositories = config.get<Repository[]>('repositories') || [];
    const repo = repositories.find(r => r.url === repoUrl);
    
    if (!repo) {
        vscode.window.showErrorMessage(`Repository ${repoUrl} not found`);
        return;
    }
    
    const quickPick = vscode.window.createQuickPick();
    quickPick.placeholder = `Manage repository: ${repoUrl}`;
    
    const items: vscode.QuickPickItem[] = [
        { 
            label: repo.enabled ? '$(x) Disable repository' : '$(check) Enable repository',
            description: 'Toggle enabled status'
        },
        {
            label: '$(repo-sync) Update repository',
            description: 'Pull latest changes from the repository'
        },
        {
            label: repo.autoUpdate ? '$(circle-slash) Disable auto-update' : '$(sync) Enable auto-update',
            description: 'Toggle automatic updates'
        },
        {
            label: '$(edit) Change branch',
            description: `Current: ${repo.branch}`
        },
        {
            label: '$(edit) Change rules directory',
            description: `Current: ${repo.rulesDir}`
        },
        {
            label: '$(trash) Remove repository',
            description: 'Delete this repository from the list'
        }
    ];
    
    quickPick.items = items;
    quickPick.show();
    
    quickPick.onDidAccept(async () => {
        const selected = quickPick.selectedItems[0];
        quickPick.hide();
        
        if (selected.label.includes('Enable repository') || selected.label.includes('Disable repository')) {
            await toggleRepositoryEnabled(repositoryManager, repoUrl);
        } else if (selected.label === '$(repo-sync) Update repository') {
            await updateRepository(repositoryManager, repoUrl);
        } else if (selected.label.includes('auto-update')) {
            await toggleAutoUpdate(repositoryManager, repoUrl);
        } else if (selected.label === '$(edit) Change branch') {
            await changeBranch(repositoryManager, repoUrl, repo.branch);
        } else if (selected.label === '$(edit) Change rules directory') {
            await changeRulesDir(repositoryManager, repoUrl, repo.rulesDir);
        } else if (selected.label === '$(trash) Remove repository') {
            await removeRepository(repositoryManager, repoUrl);
        }
    });
}

async function toggleRepositoryEnabled(repositoryManager: RepositoryManager, repoUrl: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('cursorRules');
    const repositories = config.get<Repository[]>('repositories') || [];
    const repoIndex = repositories.findIndex(r => r.url === repoUrl);
    
    if (repoIndex === -1) {
        vscode.window.showErrorMessage(`Repository ${repoUrl} not found`);
        return;
    }
    
    const updatedRepo = { ...repositories[repoIndex], enabled: !repositories[repoIndex].enabled };
    
    try {
        await repositoryManager.addRepository(updatedRepo);
        vscode.window.showInformationMessage(`Repository ${repoUrl} ${updatedRepo.enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Error updating repository: ${error}`);
    }
}

async function updateRepository(repositoryManager: RepositoryManager, repoUrl: string): Promise<void> {
    try {
        await repositoryManager.updateRepository(repoUrl);
    } catch (error) {
        vscode.window.showErrorMessage(`Error updating repository: ${error}`);
    }
}

async function toggleAutoUpdate(repositoryManager: RepositoryManager, repoUrl: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('cursorRules');
    const repositories = config.get<Repository[]>('repositories') || [];
    const repoIndex = repositories.findIndex(r => r.url === repoUrl);
    
    if (repoIndex === -1) {
        vscode.window.showErrorMessage(`Repository ${repoUrl} not found`);
        return;
    }
    
    const updatedRepo = { ...repositories[repoIndex], autoUpdate: !repositories[repoIndex].autoUpdate };
    
    try {
        await repositoryManager.addRepository(updatedRepo);
        vscode.window.showInformationMessage(`Auto-update ${updatedRepo.autoUpdate ? 'enabled' : 'disabled'} for ${repoUrl}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Error updating repository: ${error}`);
    }
}

async function changeBranch(repositoryManager: RepositoryManager, repoUrl: string, currentBranch: string): Promise<void> {
    const branchInput = await vscode.window.showInputBox({
        prompt: 'Enter the branch to use',
        placeHolder: 'main',
        value: currentBranch
    });
    
    if (!branchInput) return;
    
    const config = vscode.workspace.getConfiguration('cursorRules');
    const repositories = config.get<Repository[]>('repositories') || [];
    const repoIndex = repositories.findIndex(r => r.url === repoUrl);
    
    if (repoIndex === -1) {
        vscode.window.showErrorMessage(`Repository ${repoUrl} not found`);
        return;
    }
    
    const updatedRepo = { ...repositories[repoIndex], branch: branchInput };
    
    try {
        await repositoryManager.addRepository(updatedRepo);
        await repositoryManager.updateRepository(repoUrl);
        vscode.window.showInformationMessage(`Branch for ${repoUrl} changed to ${branchInput}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Error updating repository: ${error}`);
    }
}

async function changeRulesDir(repositoryManager: RepositoryManager, repoUrl: string, currentRulesDir: string): Promise<void> {
    const rulesDirInput = await vscode.window.showInputBox({
        prompt: 'Enter the directory containing rules',
        placeHolder: 'rules',
        value: currentRulesDir
    });
    
    if (!rulesDirInput) return;
    
    const config = vscode.workspace.getConfiguration('cursorRules');
    const repositories = config.get<Repository[]>('repositories') || [];
    const repoIndex = repositories.findIndex(r => r.url === repoUrl);
    
    if (repoIndex === -1) {
        vscode.window.showErrorMessage(`Repository ${repoUrl} not found`);
        return;
    }
    
    const updatedRepo = { ...repositories[repoIndex], rulesDir: rulesDirInput };
    
    try {
        await repositoryManager.addRepository(updatedRepo);
        vscode.window.showInformationMessage(`Rules directory for ${repoUrl} changed to ${rulesDirInput}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Error updating repository: ${error}`);
    }
}

async function removeRepository(repositoryManager: RepositoryManager, repoUrl: string): Promise<void> {
    const confirmed = await vscode.window.showWarningMessage(
        `Are you sure you want to remove the repository ${repoUrl}?`,
        { modal: true },
        'Yes',
        'No'
    );
    
    if (confirmed !== 'Yes') return;
    
    try {
        await repositoryManager.removeRepository(repoUrl);
        vscode.window.showInformationMessage(`Repository ${repoUrl} removed successfully`);
    } catch (error) {
        vscode.window.showErrorMessage(`Error removing repository: ${error}`);
    }
} 