#!/usr/bin/env node

import { Command } from 'commander';
import { SetupFlow } from './ui/setup-flow.js';
import { startInkChatInterface } from './ui/ink-chat-interface.js';
import { VersionChecker } from './utils/version-checker.js';
import chalk from 'chalk';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');
const program = new Command();

program
  .name('chat-cli')
  .description('CLI tool for real-time multi-language chat')
  .version(packageJson.version);

program
  .command('chat')
  .description('Start chat session')
  .action(async () => {
    try {
      console.log(chalk.green('🚀 Starting Chat CLI...'));
      
      // 버전 체크 및 강제 업데이트 (동기적으로 처리)
      await VersionChecker.checkAndForceUpdate(packageJson.name, packageJson.version);
      
      const setupFlow = new SetupFlow();
      const { nickname, room, location } = await setupFlow.start();
      
      // Clear screen and prepare for ink interface
      console.clear();
      
      // Small delay to ensure terminal state is clean
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Use ink interface
      startInkChatInterface(nickname, room, location);
    } catch (error) {
      if (error instanceof Error && error.message.includes('User force closed')) {
        console.log(chalk.yellow('👋 Exiting chat. See you next time!'));
        process.exit(0);
      }
      console.error(chalk.red('❌ Error:', error));
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Configure settings')
  .action(() => {
    console.log(chalk.yellow('⚙️  Configuration options will be available soon!'));
  });

program
  .command('update-check')
  .description('Check for available updates')
  .action(async () => {
    try {
      console.log(chalk.blue('🔍 Checking for updates...'));
      
      const checker = new VersionChecker(packageJson.name, packageJson.version);
      const versionInfo = await checker.checkLatestVersion();
      
      if (versionInfo.needsUpdate) {
        VersionChecker.displayForceUpdateMessage(versionInfo, packageJson.name);
        console.log(chalk.red('🚨 Please update to the latest version to continue using Chat CLI.'));
      } else {
        console.log(chalk.green('✅ You are using the latest version!'));
        console.log(chalk.gray(`   Current version: ${versionInfo.current}`));
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to check for updates:', error instanceof Error ? error.message : error));
    }
  });

// Default command
if (process.argv.length === 2) {
  program.parseAsync(['', '', 'chat']);
} else {
  program.parse();
}