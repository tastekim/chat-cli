import inquirer from 'inquirer';
import { UserManager } from '../core/user-manager';
import chalk from 'chalk';

export interface SetupResult {
  nickname: string;
  room: string;
}

export class SetupFlow {
  private userManager: UserManager;

  constructor() {
    this.userManager = new UserManager();
  }

  async start(): Promise<SetupResult> {
    console.log(chalk.cyan('🎯 Welcome to Chat CLI!'));
    
    // Check for existing user
    const existingUser = await this.userManager.getStoredUser();
    if (existingUser) {
      const { useExisting } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useExisting',
          message: `Continue as ${chalk.green(existingUser.nickname)}?`,
          default: true,
        },
      ]);

      if (useExisting) {
        const room = await this.selectRoom();
        return { nickname: existingUser.nickname, room };
      }
    }

    // Setup new user
    const nickname = await this.setupNickname();
    const room = await this.selectRoom();
    
    // Save user info
    await this.userManager.saveUser({ nickname });
    
    return { nickname, room };
  }

  private async setupNickname(): Promise<string> {
    const { nickname } = await inquirer.prompt([
      {
        type: 'input',
        name: 'nickname',
        message: 'Enter your nickname:',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'Nickname cannot be empty';
          }
          if (input.length > 20) {
            return 'Nickname must be 20 characters or less';
          }
          return true;
        },
      },
    ]);

    return nickname.trim();
  }

  private async selectRoom(): Promise<string> {
    const { room } = await inquirer.prompt([
      {
        type: 'list',
        name: 'room',
        message: 'Select a chat room:',
        choices: [
          { name: '🇰🇷 Korean Room', value: 'korean' },
          { name: '🇺🇸 English Room', value: 'english' },
          { name: '🇪🇸 Spanish Room', value: 'spanish' },
          { name: '🚀 Create Custom Room (Share to your friends!)', value: 'custom' },
        ],
      },
    ]);

    if (room === 'custom') {
      return await this.createCustomRoom();
    }

    return room;
  }

  private async createCustomRoom(): Promise<string> {
    const { customRoomName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'customRoomName',
        message: 'Enter custom room name:',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'Room name cannot be empty';
          }
          if (input.length > 30) {
            return 'Room name must be 30 characters or less';
          }
          if (!/^[a-zA-Z0-9_-]+$/.test(input.trim())) {
            return 'Room name can only contain letters, numbers, hyphens, and underscores';
          }
          return true;
        },
      },
    ]);

    const roomName = customRoomName.trim();
    console.log(chalk.green(`✨ Custom room "${roomName}" created! Share this name with your friends to join.`));
    
    return roomName;
  }
}