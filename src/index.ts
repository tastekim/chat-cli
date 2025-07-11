#!/usr/bin/env node

import { Command } from 'commander';
import { SetupFlow } from './ui/setup-flow';
import { ChatInterface } from './ui/chat-interface';
import chalk from 'chalk';

const program = new Command();

program
  .name('chat-cli')
  .description('CLI tool for real-time multi-language chat')
  .version('1.0.0');

program
  .command('chat')
  .description('Start chat session')
  .action(async () => {
    try {
      console.log(chalk.green('🚀 Starting Chat CLI...'));
      
      const setupFlow = new SetupFlow();
      const { nickname, room } = await setupFlow.start();
      
      const chatInterface = new ChatInterface(nickname, room);
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

// Default command
if (process.argv.length === 2) {
  program.parseAsync(['', '', 'chat']);
} else {
  program.parse();
}