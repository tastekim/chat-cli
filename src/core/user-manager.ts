import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface UserInfo {
  nickname: string;
  createdAt?: Date;
  lastUsed?: Date;
}

export class UserManager {
  private configDir: string;
  private configFile: string;

  constructor() {
    this.configDir = path.join(os.homedir(), '.chat-cli');
    this.configFile = path.join(this.configDir, 'user.json');
  }

  async getStoredUser(): Promise<UserInfo | null> {
    try {
      const data = await fs.readFile(this.configFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      return null;
    }
  }

  async saveUser(userInfo: UserInfo): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
      
      const dataToSave = {
        ...userInfo,
        createdAt: new Date(),
        lastUsed: new Date(),
      };
      
      await fs.writeFile(this.configFile, JSON.stringify(dataToSave, null, 2));
    } catch (error) {
      console.error('Failed to save user info:', error);
    }
  }

  async updateLastUsed(): Promise<void> {
    const user = await this.getStoredUser();
    if (user) {
      user.lastUsed = new Date();
      await this.saveUser(user);
    }
  }
}