import inquirer from 'inquirer';
import { UserManager } from '../core/user-manager';
import { LocationDetector, LocationInfo } from '../utils/location-detector';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

export interface SetupResult {
  nickname: string;
  room: string;
  location: LocationInfo;
}

export class SetupFlow {
  private userManager: UserManager;

  constructor() {
    this.userManager = new UserManager();
  }

  async start(): Promise<SetupResult> {
    this.showTitle();
    
    // Detect user location
    console.log(chalk.gray('📍 Detecting your location...'));
    const location = await LocationDetector.detectLocation();
    const locationDisplay = LocationDetector.formatLocation(location);
    
    this.showPrivacyNotice();
    
    // Check for existing user
    const existingUser = await this.userManager.getStoredUser();
    if (existingUser) {
      const { useExisting } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useExisting',
          message: `Continue as ${chalk.green(existingUser.nickname)}${chalk.gray('(' + locationDisplay + ')')}?`,
          default: true,
        },
      ]);

      if (useExisting) {
        const room = await this.selectRoom();
        return { nickname: existingUser.nickname, room, location };
      }
    }

    // Setup new user
    const nickname = await this.setupNickname();
    const room = await this.selectRoom();
    
    // Save user info
    await this.userManager.saveUser({ nickname });
    
    return { nickname, room, location };
  }

  private async setupNickname(): Promise<string> {
    console.log(chalk.gray('💡 Nickname Guidelines:'));
    console.log(chalk.gray('   • Maximum 12 characters'));
    console.log(chalk.gray('   • Letters, numbers, spaces, and basic symbols only'));
    console.log(chalk.gray('   • No backticks, backslashes, or special characters'));
    console.log();

    const { nickname } = await inquirer.prompt([
      {
        type: 'input',
        name: 'nickname',
        message: 'Enter your nickname:',
        validate: (input: string) => {
          const trimmed = input.trim();
          
          if (!trimmed) {
            return 'Nickname cannot be empty';
          }
          
          if (trimmed.length > 12) {
            return 'Nickname must be 12 characters or less';
          }
          
          // 금지된 특수문자 체크 (백틱, 역슬래시, 파이프, 세미콜론 등)
          const forbiddenChars = /[`\\|;{}[\]<>]/;
          if (forbiddenChars.test(trimmed)) {
            return 'Nickname cannot contain backticks (`), backslashes (\\), pipes (|), or other special characters';
          }
          
          // 기본적인 문자, 숫자, 공백, 일부 기호만 허용
          const allowedChars = /^[a-zA-Z0-9\s._-]+$/;
          if (!allowedChars.test(trimmed)) {
            return 'Nickname can only contain letters, numbers, spaces, dots, underscores, and hyphens';
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

  private showTitle(): void {
    try {
      // title.txt 파일을 프로젝트 루트에서 찾기
      const titlePath = path.join(__dirname, '../../../title.txt');
      let titleContent = '';
      
      if (fs.existsSync(titlePath)) {
        titleContent = fs.readFileSync(titlePath, 'utf8');
      } else {
        // 파일이 없으면 기본 제목 사용
        titleContent = `
 ____       __  __      ______      ______             ____       __         ______     
/\\  _\`\\    /\\ \\/\\ \\    /\\  _  \\    /\\__  _\\           /\\  _\`\\    /\\ \\       /\\__  _\\    
\\ \\ \\/\\_\\  \\ \\ \\_\\ \\   \\ \\ \\L\\ \\   \\/_/\\ \\/           \\ \\ \\/\\_\\  \\ \\ \\      \\/_/\\ \\/    
 \\ \\ \\/_/_  \\ \\  _  \\   \\ \\  __ \\     \\ \\ \\   _______  \\ \\ \\/_/_  \\ \\ \\  __    \\ \\ \\    
  \\ \\ \\L\\ \\  \\ \\ \\ \\ \\   \\ \\ \\/\\ \\     \\ \\ \\ /\\______\\  \\ \\ \\L\\ \\  \\ \\ \\L\\ \\    \\_\\ \\__ 
   \\ \\____/   \\ \\_\\ \\_\\   \\ \\_\\ \\_\\     \\ \\_\\\\/______/   \\ \\____/   \\ \\____/    /\\_____\\
    \\/___/     \\/_/\\/_/    \\/_/\\/_/      \\/_/             \\/___/     \\/___/     \\/_____/
`;
      }
      
      console.log(chalk.cyan(titleContent));
      console.log(chalk.gray('🌟 A terminal-based chat application for developers worldwide'));
      console.log(chalk.yellow('⚠️  Requires Node.js 22.14.0 or higher'));
      console.log();
    } catch (error) {
      // 오류 발생 시 간단한 제목으로 fallback
      console.log(chalk.cyan.bold('🚀 CHAT CLI'));
      console.log(chalk.gray('🌟 A terminal-based chat application for developers worldwide'));
      console.log(chalk.yellow('⚠️  Requires Node.js 22.14.0 or higher'));
      console.log();
    }
  }

  private showPrivacyNotice(): void {
    console.log(chalk.yellow('🔒 Privacy Notice'));
    console.log(chalk.gray('   • Location data is used only for display purposes during your session'));
    console.log(chalk.gray('   • Chat messages and personal information are not stored permanently'));
    console.log(chalk.gray('   • No data is shared with third parties or saved to our servers'));
    console.log(chalk.gray('   • Your privacy and security are our top priorities'));
    console.log();
  }
}