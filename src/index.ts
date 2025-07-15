#!/usr/bin/env node

import { Command } from 'commander';
import { SetupFlow } from './ui/setup-flow';
import { ChatInterface } from './ui/chat-interface';
import { VersionChecker } from './utils/version-checker';
import chalk from 'chalk';

const program = new Command();
const packageJson = require('../package.json');

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
      
      // 백그라운드에서 버전 체크 (비동기, 논블로킹)
      VersionChecker.checkAndNotify(packageJson.name, packageJson.version).catch(() => {
        // 버전 체크 실패는 조용히 무시
      });
      
      const setupFlow = new SetupFlow();
      const { nickname, room, location } = await setupFlow.start();
      
      const chatInterface = new ChatInterface(nickname, room, location);
      await chatInterface.start();
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
        VersionChecker.displayUpdateMessage(versionInfo, packageJson.name);
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