import https from 'https';
import { promisify } from 'util';
import chalk from 'chalk';

export interface VersionInfo {
  current: string;
  latest: string;
  needsUpdate: boolean;
}

export class VersionChecker {
  private packageName: string;
  private currentVersion: string;

  constructor(packageName: string, currentVersion: string) {
    this.packageName = packageName;
    this.currentVersion = currentVersion;
  }

  async checkLatestVersion(): Promise<VersionInfo> {
    try {
      const latest = await this.fetchLatestVersion();
      const needsUpdate = this.compareVersions(this.currentVersion, latest) < 0;
      
      return {
        current: this.currentVersion,
        latest,
        needsUpdate
      };
    } catch (error) {
      // 네트워크 오류 등으로 체크 실패 시 업데이트가 필요하지 않다고 가정
      return {
        current: this.currentVersion,
        latest: this.currentVersion,
        needsUpdate: false
      };
    }
  }

  private async fetchLatestVersion(): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = `https://registry.npmjs.org/${this.packageName}/latest`;
      
      const request = https.get(url, {
        timeout: 5000, // 5초 타임아웃
        headers: {
          'User-Agent': 'chat-cli-version-checker'
        }
      }, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          try {
            const packageInfo = JSON.parse(data);
            resolve(packageInfo.version);
          } catch (error) {
            reject(new Error('Failed to parse npm registry response'));
          }
        });
      });
      
      request.on('error', (error) => {
        reject(error);
      });
      
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  private compareVersions(current: string, latest: string): number {
    const currentParts = current.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);
    
    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
      const currentPart = currentParts[i] || 0;
      const latestPart = latestParts[i] || 0;
      
      if (currentPart < latestPart) return -1;
      if (currentPart > latestPart) return 1;
    }
    
    return 0;
  }

  static displayForceUpdateMessage(versionInfo: VersionInfo, packageName: string): void {
    if (!versionInfo.needsUpdate) return;

    const boxWidth = 55;
    const currentVersionText = ` Current version: ${versionInfo.current}`;
    const latestVersionText = ` Latest version:  ${versionInfo.latest}`;
    const updateCommandText = ` npm install -g ${packageName}@latest`;

    // 각 줄의 길이를 계산해서 패딩 추가
    const currentPadding = ' '.repeat(boxWidth - currentVersionText.length);
    const latestPadding = ' '.repeat(boxWidth - latestVersionText.length);
    const commandPadding = ' '.repeat(boxWidth - updateCommandText.length);

    console.log();
    console.log(chalk.red('┌───────────────────────────────────────────────────────┐'));
    console.log(chalk.red('│') + chalk.bold.white('              UPDATE REQUIRED!                         ') + chalk.red('│'));
    console.log(chalk.red('├───────────────────────────────────────────────────────┤'));
    console.log(chalk.red('│') + chalk.white(' Your version is outdated and incompatible.           ') + chalk.red('│'));
    console.log(chalk.red('│') + chalk.white(' Please update to the latest version to continue.     ') + chalk.red('│'));
    console.log(chalk.red('├───────────────────────────────────────────────────────┤'));
    console.log(chalk.red('│') + ` Current version: ${chalk.red.bold(versionInfo.current)}${currentPadding}` + chalk.red('│'));
    console.log(chalk.red('│') + ` Latest version:  ${chalk.green.bold(versionInfo.latest)}${latestPadding}` + chalk.red('│'));
    console.log(chalk.red('├───────────────────────────────────────────────────────┤'));
    console.log(chalk.red('│') + chalk.white(' Run this command to update:                          ') + chalk.red('│'));
    console.log(chalk.red('│') + chalk.cyan.bold(updateCommandText) + commandPadding + chalk.red('│'));
    console.log(chalk.red('├───────────────────────────────────────────────────────┤'));
    console.log(chalk.red('│') + chalk.yellow.bold(' Application will exit in 5 seconds...                ') + chalk.red('│'));
    console.log(chalk.red('└───────────────────────────────────────────────────────┘'));
    console.log();
  }

  static async checkAndForceUpdate(packageName: string, currentVersion: string): Promise<void> {
    try {
      const checker = new VersionChecker(packageName, currentVersion);
      const versionInfo = await checker.checkLatestVersion();
      
      if (versionInfo.needsUpdate) {
        VersionChecker.displayForceUpdateMessage(versionInfo, packageName);
        
        // 5초 카운트다운
        for (let i = 5; i > 0; i--) {
          process.stdout.write(`\r${chalk.red('⚠️  Exiting in')} ${chalk.bold.yellow(i)} ${chalk.red('seconds...')}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log(`\r${chalk.red('❌ Application terminated. Please update and try again.')}`);
        process.exit(1);
      }
    } catch (error) {
      // 네트워크 오류 등으로 버전 체크 실패 시 경고만 표시하고 계속 진행
      if (process.env.DEBUG === 'true') {
        console.warn(chalk.yellow('⚠️  Could not check for updates. Continuing...'));
        console.error('Version check failed:', error);
      }
    }
  }

  // 기존 함수는 호환성을 위해 유지 (옵션 명령어에서 사용)
  static async checkAndNotify(packageName: string, currentVersion: string): Promise<void> {
    try {
      const checker = new VersionChecker(packageName, currentVersion);
      const versionInfo = await checker.checkLatestVersion();
      
      if (versionInfo.needsUpdate) {
        VersionChecker.displayForceUpdateMessage(versionInfo, packageName);
      }
    } catch (error) {
      // 버전 체크 실패는 조용히 무시 (사용자 경험 방해하지 않음)
      if (process.env.DEBUG === 'true') {
        console.error('Version check failed:', error);
      }
    }
  }
}