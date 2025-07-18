import inquirer from 'inquirer';
import { UserManager } from '../core/user-manager.js';
import { LocationDetector, LocationInfo } from '../utils/location-detector.js';
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
    await this.showTitle();
    
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
        const room = 'Lobby';
        return { nickname: existingUser.nickname, room, location };
      }
    }

    // Setup new user
    const nickname = await this.setupNickname();
    const room = 'Lobby';
    
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


  private async showTitle(): Promise<void> {
    // Use dynamic import to render the title component
    const { render } = await import('ink');
    const React = await import('react');
    const { TitleComponent } = await import('./title-component.js');
    
    return new Promise((resolve) => {
      const { unmount } = render(React.createElement(TitleComponent));
      
      // Show for 2 seconds then unmount
      setTimeout(() => {
        unmount();
        console.log(); // Add spacing
        resolve();
      }, 2000);
    });
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