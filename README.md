# Cursor Project Rules

A Visual Studio Code extension for managing AI coding assistant rules from multiple Git repositories.

## Features

- **Multiple Repository Support**: Add any number of Git repositories containing cursor rules
- **Repository Management**: Enable/disable repositories, change branches, and customize rules directories
- **Automatic Updates**: Configure repositories to automatically update on extension activation
- **Rule Installation**: Install individual rules or all available rules at once
- **Easy Configuration**: Simple interface for managing repositories and rules

## How It Works

This extension allows you to manage cursor rules (`.mdc` files) from Git repositories. These rules are installed into the `.cursor/rules` directory in your workspace.

### Repository Structure

Repositories should have a structure like this:

```
repository/
├── rules/
│   ├── rule-name-1.mdc
│   ├── rule-name-2.mdc
│   └── ...
```

The default rules directory is `rules`, but this can be customized in the extension settings.

## Commands

- **Cursor Rules: Add Specific Rules**: Select and install specific rules from enabled repositories
- **Cursor Rules: Add All Available Rules**: Install all rules from enabled repositories
- **Cursor Rules: Refresh Rule Repositories**: Pull the latest changes from all enabled repositories
- **Cursor Rules: Manage Rule Repositories**: Add, remove, or configure rule repositories

## Settings

The extension can be configured through VS Code settings:

- **cursorRules.repositories**: List of Git repositories containing cursor rules
  - **url**: Git repository URL
  - **enabled**: Whether this repository is enabled (default: true)
  - **branch**: Branch to checkout (default: main)
  - **rulesDir**: Directory containing the rules (default: rules)
  - **autoUpdate**: Automatically update repository on extension activation (default: true)
- **cursorRules.localRulesDir**: Local directory where rules will be installed (default: .cursor/rules)

## Getting Started

1. Install the extension from the VS Code Marketplace
2. Use the "Cursor Rules: Manage Rule Repositories" command to add rule repositories
3. Use the "Cursor Rules: Add Specific Rules" command to install rules
4. The rules will be added to the `.cursor/rules` directory in your workspace

## Examples

### Adding a Repository

1. Open the command palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Run "Cursor Rules: Manage Rule Repositories"
3. Select "Add new repository"
4. Enter the Git repository URL (e.g., https://github.com/username/repo.git)
5. Enter the branch to use (default: main)
6. Enter the directory containing rules (default: rules)
7. Select whether to automatically update the repository

### Installing Rules

1. Open the command palette
2. Run "Cursor Rules: Add Specific Rules"
3. Select the rule(s) you want to install
4. The rules will be installed to the `.cursor/rules` directory

## License

MIT

