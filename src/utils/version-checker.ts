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

  static displayUpdateMessage(versionInfo: VersionInfo, packageName: string): void {
    if (!versionInfo.needsUpdate) return;

    console.log();
    console.log(chalk.yellow('┌─────────────────────────────────────────────────┐'));
    console.log(chalk.yellow('│') + chalk.bold.white('           Update Available!                     ') + chalk.yellow('│'));
    console.log(chalk.yellow('├─────────────────────────────────────────────────┤'));
    console.log(chalk.yellow('│') + ` Current version: ${chalk.red(versionInfo.current)}                        ` + chalk.yellow('│'));
    console.log(chalk.yellow('│') + ` Latest version:  ${chalk.green(versionInfo.latest)}                        ` + chalk.yellow('│'));
    console.log(chalk.yellow('├─────────────────────────────────────────────────┤'));
    console.log(chalk.yellow('│') + chalk.white(' Run the following command to update:            ') + chalk.yellow('│'));
    console.log(chalk.yellow('│') + chalk.cyan(` npm install -g ${packageName}@latest              `) + chalk.yellow('│'));
    console.log(chalk.yellow('└─────────────────────────────────────────────────┘'));
    console.log();
  }

  static async checkAndNotify(packageName: string, currentVersion: string): Promise<void> {
    try {
      const checker = new VersionChecker(packageName, currentVersion);
      const versionInfo = await checker.checkLatestVersion();
      
      if (versionInfo.needsUpdate) {
        VersionChecker.displayUpdateMessage(versionInfo, packageName);
      }
    } catch (error) {
      // 버전 체크 실패는 조용히 무시 (사용자 경험 방해하지 않음)
      if (process.env.DEBUG === 'true') {
        console.error('Version check failed:', error);
      }
    }
  }
}