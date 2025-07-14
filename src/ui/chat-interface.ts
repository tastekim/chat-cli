import { terminal, Terminal } from 'terminal-kit';
import { WebSocketClient } from '../core/client';
import { MessageFormatter } from './message-formatter';
import terminalImage from 'terminal-image';
import * as fs from 'fs';
import * as path from 'path';

export class ChatInterface {
  private nickname: string;
  private room: string;
  private term: Terminal;
  private client: WebSocketClient;
  private messageFormatter: MessageFormatter;
  private history: (string | Buffer)[] = [];
  private currentInput: string = '';
  private isExiting = false;
  private isProcessingEnter = false;
  private width: number = 0;
  private height: number = 0;
  private fileSelectionMode: boolean = false;
  private availableFiles: string[] = [];
  private selectedFileIndex: number = -1;
  private imeComposing: string = ''; // IME 입력 중인 문자열
  private scrollOffset: number = 0; // 스크롤 오프셋
  private lastInputContent: string = ''; // 이전 입력 내용
  private needsFullRedraw: boolean = true; // 전체 재렌더링 필요 여부
  private drawTimeout: NodeJS.Timeout | null = null; // 디바운싱용 타이머
  private userCount: number = 0; // 현재 방 접속 인원 수
  private hasShownImageFailureMessage: boolean = false; // 이미지 실패 메시지 표시 여부
  private hasShownInitialJoinMessage: boolean = false; // 초기 접속 메시지 표시 여부
  private connectedUsers: Set<string> = new Set(); // 연결된 사용자 목록

  constructor(nickname: string, room: string) {
    this.nickname = nickname;
    this.room = room;
    this.term = terminal;
    this.messageFormatter = new MessageFormatter(this.term);
    this.client = new WebSocketClient();
  }

  private createUI(): void {
    this.term.clear();
    this.term.fullscreen(true);
    this.updateWindowTitle();
    this.term.grabInput(true);

    this.term.on('key', (name: string, matches: string[], data: { isCharacter: boolean }) => {
      if (this.isExiting) return;

      // Shift + Enter 처리 (terminal-kit에서는 다양한 방식으로 감지됨)
      if (name === 'ENTER' || name === 'KP_ENTER') {
        if (matches && matches.includes('SHIFT')) {
          // Shift + Enter: 줄바꿈 추가
          this.currentInput += '\n';
          this.draw();
          return;
        }
        
        if (this.isProcessingEnter) return;
        this.isProcessingEnter = true;
        this.sendMessage(this.currentInput);
        setTimeout(() => { this.isProcessingEnter = false; }, 50);
      } else if (name === 'SHIFT_ENTER') {
        this.currentInput += '\n';
        this.draw();
        return; // 여기서 종료하여 아래 draw()를 중복 호출하지 않음
      } else if (name === 'BACKSPACE') {
        this.currentInput = this.currentInput.slice(0, -1);
      } else if (name === 'CTRL_C') {
        this.exit();
      } else if (name === 'CTRL_F') {
        this.handleFileSelection();
      } else if (name === 'CTRL_H') {
        this.showHelp();
      } else if (name === 'CTRL_L') {
        this.clearHistory();
      } else if (name === 'TAB') {
        this.handleTabCompletion();
      } else if (name === 'F1') {
        this.showHelp();
      } else if (name === 'UP') {
        if (this.fileSelectionMode) {
          this.navigateFileSelection(-1);
        } else {
          // 채팅방 메시지 스크롤 위로
          this.scrollUp();
        }
      } else if (name === 'DOWN') {
        if (this.fileSelectionMode) {
          this.navigateFileSelection(1);
        } else {
          // 채팅방 메시지 스크롤 아래로
          this.scrollDown();
        }
      } else if (name === 'ESCAPE') {
        this.exitFileSelectionMode();
      } else if (data.isCharacter) {
        // Shift+Enter로 인한 이스케이프 시퀀스 처리
        if (name === '\\') {
          // Shift+Enter에서 '\'가 입력되는 경우 무시
          return;
        }
        
        this.currentInput += name;
        // @ 입력 시 파일 선택 모드 활성화
        if (this.currentInput === '@') {
          this.enterFileSelectionMode();
          // @ 입력 시 바로 홈 디렉토리 파일 표시
          this.loadAvailableFilesForHint();
        } else if (this.currentInput.startsWith('@')) {
          // @ 입력 후 실시간 파일 매칭
          this.updateFileHints();
        } else if (!this.currentInput.startsWith('@')) {
          this.exitFileSelectionMode();
        }
      }
      
      // 입력 변경 시에는 입력 영역만 업데이트, 그 외에는 전체 업데이트
      if (name === 'UP' || name === 'DOWN' || name === 'CTRL_L') {
        this.needsFullRedraw = true;
        this.debouncedDraw();
      } else {
        this.needsFullRedraw = false;
        this.debouncedDraw();
      }
    });

    this.term.on('resize', (width: number, height: number) => {
      this.width = width;
      this.height = height;
      this.needsFullRedraw = true;
      this.draw();
    });
  }

  async start(): Promise<void> {
    this.createUI();
    setTimeout(async () => {
      this.width = this.term.width;
      this.height = this.term.height;
      this.showWelcomeMessage();
      try {
        await this.client.connectWithParams(this.nickname, this.room);
        this.setupClientEventHandlers();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.displayMessage('error', `Failed to connect: ${errorMessage}`);
        this.displayMessage('system', 'Press Ctrl+C to exit or wait for automatic reconnection');
      }
    }, 50);
  }

  private setupClientEventHandlers(): void {
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      console.log('🔗 Setting up client event handlers');
    }
    
    this.client.on('message', (data) => {
      if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
        console.log('📨 Message event received:', data);
      }
      
      if (Buffer.isBuffer(data.message)) {
        this.displayMessage('image', data.message, data.nickname);
      } else {
        const messageType = data.nickname === this.nickname ? 'own' : 'user';
        this.displayMessage(messageType, data.message, data.nickname);
      }
    });

    this.client.on('system', (data) => {
      // Join 메시지 처리
      if (data.isJoinMessage) {
        const userName = data.nickname || '';
        
        if (userName === this.nickname) {
          // 자신의 join 메시지는 초기 접속 시에만 표시
          if (!this.hasShownInitialJoinMessage) {
            this.hasShownInitialJoinMessage = true;
            this.connectedUsers.add(userName);
            this.displayMessage('system', data.message);
          }
          return;
        } else {
          // 다른 사용자의 join 메시지는 새로운 연결일 때만 표시
          if (!this.connectedUsers.has(userName)) {
            this.connectedUsers.add(userName);
            this.displayMessage('system', data.message);
          }
          // 이미 연결된 사용자의 재연결은 표시하지 않음
          return;
        }
      }
      
      // Leave 메시지 처리
      if (data.isLeaveMessage) {
        const userName = data.nickname || '';
        if (this.connectedUsers.has(userName)) {
          this.connectedUsers.delete(userName);
          this.displayMessage('system', data.message);
        }
        return;
      }
      
      // 일반 시스템 메시지는 그대로 표시
      this.displayMessage('system', data.message);
    });

    this.client.on('user_count', (data) => {
      if (data.data && typeof data.data.count === 'number') {
        this.userCount = data.data.count;
        this.updateWindowTitle();
        this.needsFullRedraw = true;
        this.draw();
      }
    });

    this.client.on('error', (error) => {
      this.displayMessage('error', `Connection error: ${error.message || error}`);
    });

    this.client.on('disconnected', (data) => {
      // 연결 끊김은 내부적으로 처리하고 재연결 메시지만 표시
      // this.displayMessage('system', `Disconnected: ${data.reason || 'Connection lost'}`);
    });

    this.client.on('connected', () => {
      // 서버에서 join 메시지를 보내므로 클라이언트에서는 별도 메시지 표시하지 않음
      // 초기 연결임을 표시만 함
      this.hasShownInitialJoinMessage = false; // 서버 메시지를 기다림
    });

    this.client.on('reconnected', () => {
      // 재연결 시에는 조용히 처리 (메시지 표시하지 않음)
      // 서버에서 자동으로 재연결 처리하므로 추가 액션 불필요
    });

    this.client.on('maxReconnectAttemptsReached', () => {
      this.displayMessage('error', 'Maximum reconnection attempts reached. Please restart the application.');
    });
  }

  private sendMessage(message: string): void {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      console.log('💭 Attempting to send message:', `"${trimmedMessage}"`);
      console.log('🔌 Connection status:', this.client.isConnectionOpen());
    }

    if (!this.client.isConnectionOpen()) {
      this.displayMessage('error', 'Connection not available. Please wait for reconnection.');
      return;
    }

    if (trimmedMessage.startsWith('/')) {
      if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
        console.log('⚡ Processing command:', trimmedMessage);
      }
      this.handleCommand(trimmedMessage);
    } else if (trimmedMessage.startsWith('@')) {
      if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
        console.log('📎 Processing file:', trimmedMessage.substring(1));
      }
      this.sendFile(trimmedMessage.substring(1));
    } else {
      if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
        console.log('💬 Sending regular message via client.sendMessage()');
      }
      
      const success = this.client.sendMessage(trimmedMessage);
      
      if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
        console.log('📤 sendMessage result:', success);
      }
      
      if (!success) {
        this.displayMessage('error', 'Failed to send message');
      }
    }
    this.currentInput = '';
  }

  private handleCommand(command: string): void {
    const cmd = command.toLowerCase().trim();
    
    switch (cmd) {
      case '/help':
      case '/h':
        this.showHelp();
        break;
      case '/commands':
        this.showCommands();
        break;
      case '/file':
      case '/attach':
        this.showFileHelp();
        break;
      case '/clear':
        this.clearHistory();
        break;
      default:
        this.displayMessage('error', `Unknown command: ${command}. Type /help for available commands.`);
    }
  }

  private showWelcomeMessage(): void {
    // 환영 메시지 - 날짜/시간 없는 깔끔한 형태
    this.history.push('');
    this.history.push('🎉 Welcome to Chat CLI!');
    this.history.push(`📍 Room: ${this.room}`);
    this.history.push(`👤 Nickname: ${this.nickname}`);
    this.history.push('');
    
    // QR 코드 표시
    try {
      const qrContent = require('fs').readFileSync('/Users/tastekim/Desktop/sideproject/ai/app/qr.txt', 'utf8');
      const qrLines = qrContent.split('\n');
      qrLines.forEach((line: string) => {
        if (line.trim()) {
          this.history.push(line);
        }
      });
    } catch (error) {
      // QR 파일이 없으면 무시
    }
    
    this.history.push('');
    this.history.push('☕ Support this service through Buy Me Coffee!');
    this.history.push('Your generous support helps keep this service running.');
    this.history.push('You can also support via this link: https://coff.ee/tastekim');
    this.history.push('');
    this.history.push('💡 Quick Guide:');
    this.history.push('  • Type messages and press Enter to send');
    this.history.push('  • Use Shift + Enter for line breaks');
    this.history.push('  • Use @filepath to send image files (Only jpg, jpeg, png, gif, webp)');
    this.history.push('  • Use arrow keys ↑↓ to scroll through messages');
    this.history.push('  • Type /help for more commands');
    this.history.push('  • Press Ctrl+C to exit');
    this.history.push('');
    this.history.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.history.push('');
    this.draw();
  }

  private showQuickHelp(): void {
    this.displayMessage('system', '💡 Quick Tips:');
    this.displayMessage('system', '• Type messages and press Enter to send');
    this.displayMessage('system', '• Use @filepath to send files (e.g., @./image.jpg)');
    this.displayMessage('system', '• Type /help for more commands');
  }

  private showHelp(): void {
    this.displayMessage('system', '📋 Chat CLI Help');
    this.displayMessage('system', '');
    this.displayMessage('system', '🗨️  Basic Commands:');
    this.displayMessage('system', '  • Type any message to send to the room');
    this.displayMessage('system', '  • Press Enter to send message');
    this.displayMessage('system', '  • Press Shift+Enter for new line');
    this.displayMessage('system', '  • Press Ctrl+C to exit');
    this.displayMessage('system', '');
    this.displayMessage('system', '📎 File Attachment:');
    this.displayMessage('system', '  • @filepath - Send a file (e.g., @./photo.jpg)');
    this.displayMessage('system', '  • Supports: PNG, JPEG, GIF, WebP');
    this.displayMessage('system', '  • Max size: 10MB');
    this.displayMessage('system', '  • Examples: @./image.png, @/Users/user/pic.jpg');
    this.displayMessage('system', '');
    this.displayMessage('system', '⌨️  Keyboard Shortcuts:');
    this.displayMessage('system', '  • Ctrl+F - Open file selection guide');
    this.displayMessage('system', '  • Ctrl+H or F1 - Show this help');
    this.displayMessage('system', '  • Ctrl+L - Clear chat history');
    this.displayMessage('system', '  • Tab - Auto-complete file paths and commands');
    this.displayMessage('system', '');
    this.displayMessage('system', '⚙️  Commands:');
    this.displayMessage('system', '  • /help, /h - Show this help');
    this.displayMessage('system', '  • /file, /attach - File attachment guide');
    this.displayMessage('system', '  • /clear - Clear chat history');
    this.displayMessage('system', '  • /commands - List all commands');
  }

  private showCommands(): void {
    this.displayMessage('system', '⚙️  Available Commands:');
    this.displayMessage('system', '  /help, /h      - Show detailed help');
    this.displayMessage('system', '  /file, /attach - File attachment guide');
    this.displayMessage('system', '  /clear         - Clear chat history');
    this.displayMessage('system', '  /commands      - Show this command list');
  }

  private showFileHelp(): void {
    this.displayMessage('system', '📎 File Attachment Guide:');
    this.displayMessage('system', '');
    this.displayMessage('system', '🔹 How to attach files:');
    this.displayMessage('system', '   @filepath - Use @ symbol followed by file path');
    this.displayMessage('system', '');
    this.displayMessage('system', '🔹 Examples:');
    this.displayMessage('system', '   @./image.jpg          - Relative path');
    this.displayMessage('system', '   @/Users/user/pic.png  - Absolute path');
    this.displayMessage('system', '   @../folder/file.gif   - Parent directory');
    this.displayMessage('system', '');
    this.displayMessage('system', '🔹 Supported formats:');
    this.displayMessage('system', '   PNG, JPEG, GIF, WebP');
    this.displayMessage('system', '');
    this.displayMessage('system', '🔹 Limitations:');
    this.displayMessage('system', '   • Maximum file size: 10MB');
    this.displayMessage('system', '   • Only image files are supported');
    this.displayMessage('system', '   • File must exist and be readable');
  }

  private clearHistory(): void {
    this.history = [];
    this.displayMessage('system', 'Chat history cleared.');
  }

  private sendFile(filePath: string): void {
    if (!this.client.isConnectionOpen()) {
      this.displayMessage('error', '❌ Connection not available. Cannot send file.');
      return;
    }

    // ~/로 시작하면 홈 디렉토리로 변환
    const homeDir = require('os').homedir();
    const absolutePath = filePath.startsWith('~/')
      ? path.join(homeDir, filePath.slice(2))
      : path.resolve(process.cwd(), filePath);
    
    if (!fs.existsSync(absolutePath)) {
      this.displayMessage('error', `❌ File not found: ${filePath}`);
      return;
    }

    try {
      // 파일 정보 확인 및 표시
      const stats = fs.statSync(absolutePath);
      const fileSize = this.formatFileSize(stats.size);
      const fileName = path.basename(absolutePath);
      
      this.displayMessage('system', `📎 Preparing to send: ${fileName} (${fileSize})`);
      
      if (stats.size > 10 * 1024 * 1024) { // 10MB 제한
        this.displayMessage('error', '❌ File too large. Maximum size is 10MB.');
        return;
      }

      // 파일 읽기 시작
      this.displayMessage('system', '📤 Reading file...');
      const buffer = fs.readFileSync(absolutePath);
      
      // 이미지 유효성 검사
      if (!this.isValidImageBuffer(buffer)) {
        this.displayMessage('error', '❌ Invalid image format. Supported: PNG, JPEG, GIF, WebP');
        return;
      }
      
      this.displayMessage('system', '📡 Sending file...');
      
      if (!this.client.sendMessage(buffer)) {
        this.displayMessage('error', '❌ Failed to send file');
      } else {
        this.displayMessage('system', `✅ File sent successfully: ${fileName}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        this.displayMessage('error', `❌ Error reading file: ${error.message}`);
      } else {
        this.displayMessage('error', `❌ An unknown error occurred while reading the file.`);
      }
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private showFileAttachmentStatus(y: number): void {
    const filePath = this.currentInput.substring(1).trim();
    if (!filePath) {
      this.term.gray();
      if (this.fileSelectionMode && this.availableFiles.length > 0) {
        // 파일 목록을 힌트 UI로 표시
        this.term.moveTo(2, y)(`📎 Available files (${this.availableFiles.length}):`);
        const displayFiles = this.availableFiles.slice(0, 2); // 최대 2개까지만 표시
        displayFiles.forEach((file, index) => {
          this.term.moveTo(4, y + 1 + index)(`${index === this.selectedFileIndex ? '▶' : ' '} ${file}`);
        });
      } else {
        // @ 입력 시 홈 디렉토리에서 시작한다는 힌트 표시
        const homeDir = require('os').homedir();
        this.term.moveTo(2, y)(`📎 Start with ~/filename (e.g., ~/Pictures/image.jpg)`);
        this.term.moveTo(2, y + 1)(`   Tab to see files in ${homeDir.replace(require('os').homedir(), '~')}`);
      }
      return;
    }

    // ~/로 시작하면 홈 디렉토리로 변환
    const homeDir = require('os').homedir();
    const absolutePath = filePath.startsWith('~/')
      ? path.join(homeDir, filePath.slice(2))
      : path.resolve(process.cwd(), filePath);
    
    if (!fs.existsSync(absolutePath)) {
      this.term.red();
      this.term.moveTo(2, y)('❌ File not found');
    } else {
      // 실시간 파일 매칭 결과 표시
      if (this.fileSelectionMode && this.availableFiles.length > 0) {
        this.term.green();
        this.term.moveTo(2, y)(`📎 Matching files (${this.availableFiles.length}):`);
        const displayFiles = this.availableFiles.slice(0, 2); // 최대 2개까지만 표시
        displayFiles.forEach((file, index) => {
          this.term.moveTo(4, y + 1 + index)(`${index === this.selectedFileIndex ? '▶' : ' '} ${file}`);
        });
      } else {
        // 파일 상태 확인
        try {
          const stats = fs.statSync(absolutePath);
          const fileSize = this.formatFileSize(stats.size);
          const fileName = path.basename(absolutePath);
          
          if (stats.size > 10 * 1024 * 1024) {
            this.term.red();
            this.term.moveTo(2, y)(`❌ File too large: ${fileName} (${fileSize})`);
          } else {
            this.term.green();
            this.term.moveTo(2, y)(`📎 Ready to send: ${fileName} (${fileSize})`);
          }
        } catch (error) {
          this.term.red();
          this.term.moveTo(2, y)('❌ File not found - try typing to search');
        }
      }
    }
  }

  private showCommandStatus(y: number): void {
    const command = this.currentInput.toLowerCase().trim();
    const validCommands = ['/help', '/h', '/commands', '/file', '/attach', '/clear'];
    
    if (validCommands.includes(command)) {
      this.term.green();
      this.term.moveTo(2, y)('✅ Valid command');
    } else if (command.length > 1) {
      this.term.yellow();
      this.term.moveTo(2, y)('⚠️  Unknown command - press Enter to see available commands');
    } else {
      this.term.gray();
      this.term.moveTo(2, y)('💬 Type command name (help, file, clear, etc.)');
    }
  }

  private handleFileSelection(): void {
    this.displayMessage('system', '📁 File Selection Options:');
    this.displayMessage('system', '• Type @filepath to attach a file');
    this.displayMessage('system', '• Examples: @./image.jpg, @/path/to/file.png');
    this.displayMessage('system', '• Supported: PNG, JPEG, GIF, WebP (max 10MB)');
    this.displayMessage('system', '• Tip: Use Tab for path auto-completion');
    
    // 파일 선택 모드 활성화
    this.currentInput = '@';
  }

  private handleTabCompletion(): void {
    if (this.currentInput.startsWith('@')) {
      this.handleFilePathCompletion();
    } else if (this.currentInput.startsWith('/')) {
      this.handleCommandCompletion();
    }
  }

  private handleFilePathCompletion(): void {
    const filePath = this.currentInput.substring(1);
    if (!filePath) {
      const homeDir = require('os').homedir();
      // UI 힌트로 표시하도록 변경 (채팅 메시지가 아님)
      this.loadAvailableFilesForHint();
      return;
    }

    try {
      const dirPath = path.dirname(filePath);
      const baseName = path.basename(filePath);
      // 경로 처리 개선 - 홈 디렉토리에서 시작하도록 수정
      const homeDir = require('os').homedir();
      let resolvedDir;
      
      if (filePath.startsWith('~/')) {
        // ~/로 시작하는 경우 홈 디렉토리 기준
        resolvedDir = path.join(homeDir, dirPath.slice(2));
      } else if (filePath.startsWith('../')) {
        // ../로 시작하는 경우 홈 디렉토리의 상위 디렉토리 기준으로 변경
        resolvedDir = path.resolve(homeDir, dirPath);
      } else if (filePath.startsWith('./')) {
        // ./로 시작하는 경우 홈 디렉토리 기준
        resolvedDir = path.resolve(homeDir, dirPath);
      } else if (path.isAbsolute(filePath)) {
        // 절대 경로인 경우
        resolvedDir = dirPath;
      } else {
        // 기타 경우 홈 디렉토리 기준
        resolvedDir = path.resolve(homeDir, dirPath);
      }
      
      if (fs.existsSync(resolvedDir)) {
        const files = fs.readdirSync(resolvedDir)
          .filter(file => {
            const fullPath = path.join(resolvedDir, file);
            const stat = fs.statSync(fullPath);
            return stat.isFile() && this.isImageFile(file);
          })
          .filter(file => file.toLowerCase().startsWith(baseName.toLowerCase()));
        
        if (files.length === 1) {
          // 자동 완성 - 원래 경로 형식 유지
          let completedPath;
          if (filePath.startsWith('~/')) {
            completedPath = path.join(dirPath, files[0]);
          } else if (filePath.startsWith('../')) {
            completedPath = path.join(dirPath, files[0]);
          } else {
            completedPath = path.join(dirPath, files[0]);
          }
          this.currentInput = '@' + completedPath;
        } else if (files.length > 1) {
          // UI 힌트로 파일 목록 저장 (채팅 메시지로 표시하지 않음)
          this.availableFiles = files.map(file => {
            if (filePath.startsWith('~/')) {
              return path.join(dirPath, file);
            } else {
              return path.join(dirPath, file);
            }
          });
          this.fileSelectionMode = true;
        } else {
          // 일치하는 파일이 없으면 해당 디렉토리의 모든 이미지 파일을 힌트로 저장
          const allImageFiles = fs.readdirSync(resolvedDir)
            .filter(file => {
              const fullPath = path.join(resolvedDir, file);
              const stat = fs.statSync(fullPath);
              return stat.isFile() && this.isImageFile(file);
            });
          
          if (allImageFiles.length > 0) {
            this.availableFiles = allImageFiles.map(file => {
              if (filePath.startsWith('~/')) {
                return path.join(dirPath, file);
              } else {
                return path.join(dirPath, file);
              }
            });
            this.fileSelectionMode = true;
          } else {
            this.availableFiles = [];
            this.fileSelectionMode = false;
          }
        }
      } else {
        this.availableFiles = [];
        this.fileSelectionMode = false;
      }
    } catch (error) {
      this.availableFiles = [];
      this.fileSelectionMode = false;
    }
  }

  private loadAvailableFilesForHint(): void {
    try {
      const homeDir = require('os').homedir();
      this.availableFiles = fs.readdirSync(homeDir)
        .filter(file => {
          const fullPath = path.join(homeDir, file);
          const stat = fs.statSync(fullPath);
          return stat.isFile() && this.isImageFile(file);
        })
        .map(file => `~/${file}`)
        .sort();
      this.fileSelectionMode = true;
    } catch (error) {
      this.availableFiles = [];
      this.fileSelectionMode = false;
    }
  }

  private updateFileHints(): void {
    const filePath = this.currentInput.substring(1);
    if (!filePath) {
      this.loadAvailableFilesForHint();
      return;
    }

    try {
      const homeDir = require('os').homedir();
      let resolvedDir;
      let baseName = '';
      
      // 경로가 / 로 끝나는 경우 (디렉토리를 의미)
      if (filePath.endsWith('/')) {
        baseName = '';
        if (filePath.startsWith('~/')) {
          resolvedDir = path.join(homeDir, filePath.slice(2));
        } else if (filePath.startsWith('../')) {
          // ../ 의 경우 바로 상위 디렉토리를 의미
          if (filePath === '../') {
            resolvedDir = path.resolve(process.cwd(), '..');
          } else {
            resolvedDir = path.resolve(process.cwd(), filePath);
          }
        } else if (filePath.startsWith('./')) {
          // ./ 의 경우 현재 디렉토리를 의미
          if (filePath === './') {
            resolvedDir = process.cwd();
          } else {
            resolvedDir = path.resolve(process.cwd(), filePath);
          }
        } else if (path.isAbsolute(filePath)) {
          resolvedDir = filePath;
        } else {
          resolvedDir = path.resolve(process.cwd(), filePath);
        }
      } else {
        // 파일명이 포함된 경우
        const dirPath = path.dirname(filePath);
        baseName = path.basename(filePath);
        
        if (filePath.startsWith('~/')) {
          resolvedDir = path.join(homeDir, dirPath === '~' ? '' : dirPath.slice(2));
        } else if (filePath.startsWith('../')) {
          // ../ 로 시작하는 경우 상위 디렉토리 기준
          if (dirPath === '..') {
            resolvedDir = path.resolve(process.cwd(), '..');
          } else {
            resolvedDir = path.resolve(process.cwd(), dirPath);
          }
        } else if (filePath.startsWith('./')) {
          // ./ 로 시작하는 경우 현재 디렉토리 기준
          if (dirPath === '.') {
            resolvedDir = process.cwd();
          } else {
            resolvedDir = path.resolve(process.cwd(), dirPath);
          }
        } else if (path.isAbsolute(filePath)) {
          resolvedDir = dirPath;
        } else {
          resolvedDir = path.resolve(process.cwd(), dirPath);
        }
      }
      
      if (fs.existsSync(resolvedDir)) {
        const matchingFiles = fs.readdirSync(resolvedDir)
          .filter(file => {
            const fullPath = path.join(resolvedDir, file);
            const stat = fs.statSync(fullPath);
            return stat.isFile() && this.isImageFile(file) && 
                   file.toLowerCase().includes(baseName.toLowerCase());
          })
          .map(file => {
            // 원래 경로 형식 유지
            if (filePath.endsWith('/')) {
              return filePath + file;
            } else if (filePath.startsWith('~/')) {
              return path.join(path.dirname(filePath), file);
            } else {
              return path.join(path.dirname(filePath), file);
            }
          });
        
        this.availableFiles = matchingFiles;
        this.fileSelectionMode = matchingFiles.length > 0;
      } else {
        this.availableFiles = [];
        this.fileSelectionMode = false;
      }
    } catch (error) {
      this.availableFiles = [];
      this.fileSelectionMode = false;
    }
  }

  private handleCommandCompletion(): void {
    const commands = ['/help', '/file', '/attach', '/clear', '/commands'];
    const currentCmd = this.currentInput.toLowerCase();
    
    const matching = commands.filter(cmd => cmd.startsWith(currentCmd));
    
    if (matching.length === 1) {
      this.currentInput = matching[0];
    } else if (matching.length > 1) {
      this.displayMessage('system', '💡 Available commands:');
      matching.forEach(cmd => {
        this.displayMessage('system', `  • ${cmd}`);
      });
    }
  }

  private showCurrentDirectoryFiles(): void {
    try {
      const files = fs.readdirSync(process.cwd())
        .filter(file => {
          const stat = fs.statSync(file);
          return stat.isFile() && this.isImageFile(file);
        })
        .slice(0, 10);
      
      if (files.length > 0) {
        files.forEach(file => {
          const stats = fs.statSync(file);
          const size = this.formatFileSize(stats.size);
          this.displayMessage('system', `  • ${file} (${size})`);
        });
      } else {
        this.displayMessage('system', '  No image files found in current directory');
      }
    } catch (error) {
      this.displayMessage('system', '❌ Error reading current directory');
    }
  }

  private showHomeDirectoryFiles(): void {
    try {
      const homeDir = require('os').homedir();
      const files = fs.readdirSync(homeDir)
        .filter(file => {
          const fullPath = path.join(homeDir, file);
          const stat = fs.statSync(fullPath);
          return stat.isFile() && this.isImageFile(file);
        })
        .slice(0, 10);
      
      if (files.length > 0) {
        files.forEach(file => {
          const fullPath = path.join(homeDir, file);
          const stats = fs.statSync(fullPath);
          const size = this.formatFileSize(stats.size);
          this.displayMessage('system', `  • ~/${file} (${size})`);
        });
      } else {
        this.displayMessage('system', '  No image files found in home directory');
        this.displayMessage('system', '  Try looking in subfolders like ~/Pictures/ or ~/Downloads/');
      }
    } catch (error) {
      this.displayMessage('system', '❌ Error reading home directory');
    }
  }

  private showCurrentDirectoryFilesOnce(): void {
    // @ 입력 시 파일 목록을 힌트에 표시 (시스템 메시지로 채팅방에 표시하지 않음)
    // 힌트는 showFileAttachmentStatus에서 처리
  }

  private isImageFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext);
  }

  private enterFileSelectionMode(): void {
    this.fileSelectionMode = true;
    this.selectedFileIndex = -1;
    this.loadAvailableFiles();
  }

  private exitFileSelectionMode(): void {
    this.fileSelectionMode = false;
    this.availableFiles = [];
    this.selectedFileIndex = -1;
  }

  private loadAvailableFiles(): void {
    try {
      const homeDir = require('os').homedir();
      this.availableFiles = fs.readdirSync(homeDir)
        .filter(file => {
          const fullPath = path.join(homeDir, file);
          const stat = fs.statSync(fullPath);
          return stat.isFile() && this.isImageFile(file);
        })
        .map(file => `~/${file}`)
        .sort();
    } catch (error) {
      this.availableFiles = [];
    }
  }

  private navigateFileSelection(direction: number): void {
    if (this.availableFiles.length === 0) return;
    
    this.selectedFileIndex += direction;
    
    if (this.selectedFileIndex < -1) {
      this.selectedFileIndex = this.availableFiles.length - 1;
    } else if (this.selectedFileIndex >= this.availableFiles.length) {
      this.selectedFileIndex = -1;
    }
    
    if (this.selectedFileIndex >= 0) {
      this.currentInput = '@' + this.availableFiles[this.selectedFileIndex];
    } else {
      this.currentInput = '@';
    }
  }

  private wrapMessage(message: string, maxWidth: number): string[] {
    const lines: string[] = [];
    const messageLines = message.split('\n');
    
    for (const line of messageLines) {
      // ANSI 이스케이프 시퀀스가 포함된 경우 처리하지 않고 그대로 전달
      if (line.includes('\u001b[') || line.includes('\x1b[')) {
        lines.push(line);
        continue;
      }
      
      if (line.length <= maxWidth) {
        lines.push(line);
      } else {
        // 긴 줄을 maxWidth로 나누어 처리
        let currentLine = line;
        while (currentLine.length > maxWidth) {
          // 단어 경계에서 자르기 시도
          let breakPoint = maxWidth;
          const lastSpace = currentLine.lastIndexOf(' ', maxWidth);
          
          if (lastSpace > maxWidth * 0.7) { // 너무 짧지 않으면 단어 경계에서 자르기
            breakPoint = lastSpace;
          }
          
          lines.push(currentLine.substring(0, breakPoint));
          currentLine = currentLine.substring(breakPoint).trim();
        }
        
        if (currentLine.length > 0) {
          lines.push(currentLine);
        }
      }
    }
    
    return lines;
  }

  private countActualLines(message: string): number {
    // 터미널 이미지나 복잡한 문자열의 실제 줄 수를 계산
    const lines = message.split('\n');
    return lines.length;
  }

  private async displayMessage(type: 'user' | 'own' | 'system' | 'error' | 'image', content: string | Buffer, nickname?: string): Promise<void> {
    if (type === 'image' && Buffer.isBuffer(content)) {
      try {
        // Buffer 유효성 검사
        if (content.length === 0) {
          throw new Error('Empty image buffer');
        }
        
        // 이미지 타입 확인 (간단한 magic number 검사)
        if (!this.isValidImageBuffer(content)) {
          throw new Error('Invalid image format');
        }
        
        // 터미널에서 이미지 표시 활성화 (논블로킹)
        setTimeout(async () => {
          try {
            // terminal-image 사용 가능성 확인
            if (!terminalImage) {
              throw new Error('terminal-image module not loaded');
            }
            if (typeof terminalImage.buffer !== 'function') {
              throw new Error('terminal-image.buffer is not a function, type: ' + typeof terminalImage.buffer);
            }
            
            console.debug('Processing image with terminal-image, size:', content.length, 'terminal type:', process.env.TERM);
            const imageString = await terminalImage.buffer(content, { 
              width: Math.min(this.width - 4, 80),
              height: Math.min(this.height - 10, 30)
            });
            console.debug('Image processing result type:', typeof imageString, 'length:', imageString?.length);
            
            // 결과 유효성 검사 - 바이너리 데이터가 텍스트로 출력되는 것 방지
            if (!imageString || typeof imageString !== 'string' || imageString.includes('\x00')) {
              throw new Error(`Invalid image output - type: ${typeof imageString}, contains null: ${imageString?.includes('\x00')}`);
            }
            
            const formattedImage = this.messageFormatter.format(type, imageString, nickname);
            this.history.push(formattedImage);
            // 이미지 추가 후 강제로 최하단 스크롤
            this.scrollToBottom();
            this.needsFullRedraw = true;
            this.draw();
          } catch (imageError) {
            // 이미지 표시 실패 시 개선된 대안 표시
            const imageType = this.getImageTypeString(content);
            const fileSize = this.formatFileSize(content.length);
            const imageInfo = `📷 ${imageType} Image received (${fileSize})`;
            const formattedImage = this.messageFormatter.format('system', imageInfo, nickname);
            this.history.push(formattedImage);
            
            // 첫 번째 이미지 실패 시에만 안내 메시지 표시
            if (!this.hasShownImageFailureMessage) {
              this.hasShownImageFailureMessage = true;
              console.error('Image display failed:', imageError);
              const helpMessage = this.messageFormatter.format('system', 
                '💡 Images appear as text? This may be due to terminal compatibility. Try iTerm2 or update your terminal.', 
                undefined
              );
              this.history.push(helpMessage);
            }
            
            this.scrollToBottom();
            this.needsFullRedraw = true;
            this.draw();
          }
        }, 0);
      } catch (error) {
        console.error('Error displaying image:', error);
        // 이미지 표시 실패 시 개선된 파일 정보 표시
        const imageType = this.getImageTypeString(content);
        const fileSize = this.formatFileSize(content.length);
        const imageInfo = `📷 ${imageType} Image (${fileSize})`;
        const fallbackMessage = this.messageFormatter.format('system', imageInfo, nickname);
        this.history.push(fallbackMessage);
        
        // 첫 번째 이미지 실패 시에만 상세 안내 표시
        if (!this.hasShownImageFailureMessage) {
          this.hasShownImageFailureMessage = true;
          const helpMessage = this.messageFormatter.format('system', 
            '💡 Image display failed. Try using iTerm2 or updating your terminal. Error: ' + (error instanceof Error ? error.message : 'Unknown'), 
            undefined
          );
          this.history.push(helpMessage);
        }
      }
    } else if (typeof content === 'string') {
      const formattedMessage = this.messageFormatter.format(type, content, nickname);
      this.history.push(formattedMessage);
    }
    
    // 최근 100개 메시지만 유지
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }
    
    // 새 메시지 추가 후 최하단 스크롤
    this.scrollToBottom();
    this.needsFullRedraw = true; // 메시지 추가 시 전체 재렌더링 필요
    this.draw();
  }

  private isValidImageBuffer(buffer: Buffer): boolean {
    // 일반적인 이미지 포맷의 magic number 검사
    const header = buffer.slice(0, 8);
    
    // PNG
    if (header.indexOf(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) === 0) {
      return true;
    }
    
    // JPEG
    if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
      return true;
    }
    
    // GIF
    if (header.indexOf(Buffer.from('GIF87a')) === 0 || header.indexOf(Buffer.from('GIF89a')) === 0) {
      return true;
    }
    
    // WebP
    if (header.indexOf(Buffer.from('RIFF')) === 0 && buffer.slice(8, 12).indexOf(Buffer.from('WEBP')) === 0) {
      return true;
    }
    
    return false;
  }

  private getImageTypeString(buffer: Buffer): string {
    const header = buffer.slice(0, 8);
    
    // PNG
    if (header.indexOf(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) === 0) {
      return 'PNG';
    }
    
    // JPEG
    if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
      return 'JPEG';
    }
    
    // GIF
    if (header.indexOf(Buffer.from('GIF87a')) === 0 || header.indexOf(Buffer.from('GIF89a')) === 0) {
      return 'GIF';
    }
    
    // WebP
    if (header.indexOf(Buffer.from('RIFF')) === 0 && buffer.slice(8, 12).indexOf(Buffer.from('WEBP')) === 0) {
      return 'WebP';
    }
    
    return 'Unknown';
  }

  private updateWindowTitle(): void {
    const userCountText = this.userCount > 0 ? ` (${this.userCount} user${this.userCount > 1 ? 's' : ''})` : '';
    this.term.windowTitle(`Chat CLI - ${this.room} Room${userCountText}`);
  }

  private debouncedDraw(): void {
    if (this.drawTimeout) {
      clearTimeout(this.drawTimeout);
    }
    
    this.drawTimeout = setTimeout(() => {
      this.draw();
    }, 16); // 60fps로 제한
  }

  private draw(): void {
    if (this.isExiting || !this.width) return;
    this.term.hideCursor();
    
    // 전체 재렌더링이 필요한 경우만 화면 지우기
    if (this.needsFullRedraw) {
      this.term.clear();
      this.drawFullUI();
      this.needsFullRedraw = false;
    } else {
      // 입력 영역만 업데이트
      this.drawInputAreaOnly();
    }
  }

  private drawFullUI(): void {

    const inputLines = this.currentInput.split('\n');
    const inputHeight = Math.max(1, inputLines.length);
    const inputBoxHeight = inputHeight + 2;
    const hintAreaHeight = 3; // 힌트 영역 높이
    const messageBoxHeight = this.height - inputBoxHeight - hintAreaHeight;

    // 메시지 영역 테두리
    this.term.brightBlack();
    this.term.moveTo(1, 1)('┌' + '─'.repeat(this.width - 2) + '┐');
    
    // 헤더에 방 이름과 사용자 수 표시
    const headerText = `📍 ${this.room} Room`;
    const userCountText = `👥 ${this.userCount} user${this.userCount > 1 ? 's' : ''}`;
    const headerLength = headerText.length + userCountText.length + 3; // 공백 포함
    
    if (headerLength <= this.width - 4) {
      const spacer = ' '.repeat(this.width - 4 - headerLength);
      this.term.moveTo(2, 1);
      this.term.cyan()(headerText);
      this.term.moveTo(2 + headerText.length, 1)(spacer);
      this.term.green()(userCountText);
    } else {
      // 공간이 부족한 경우 간단하게 표시
      const simpleHeader = `${this.room} (${this.userCount})`;
      this.term.moveTo(2, 1);
      this.term.cyan()(simpleHeader.slice(0, this.width - 4));
    }
    
    for (let y = 2; y < messageBoxHeight; y++) {
      this.term.moveTo(1, y)('│');
      this.term.moveTo(this.width, y)('│');
    }
    this.term.moveTo(1, messageBoxHeight)('└' + '─'.repeat(this.width - 2) + '┘');

    this.drawMessageArea(messageBoxHeight);
    this.drawInputArea();
  }

  private drawMessageArea(messageBoxHeight: number): void {

    const messageAreaHeight = messageBoxHeight - 3; // 헤더 고려하여 -3
    const messageWidth = this.width - 4; // 좌우 패딩 고려
    
    // 모든 메시지의 줄 수 계산 (이미지 줄 수 정확히 계산)
    let totalLines = 0;
    const messageLines: string[][] = [];
    
    for (let i = 0; i < this.history.length; i++) {
      const message = this.history[i] as string;
      let wrappedLines: string[];
      
      // 이미지 메시지인 경우 실제 줄 수 계산
      if (message.includes('sent an image:')) {
        // 이미지 메시지의 실제 줄 수 계산
        wrappedLines = this.wrapMessage(message, messageWidth);
        // 이미지의 실제 줄 수를 추가로 계산
        const imageLines = this.countActualLines(message);
        // 이미지가 여러 줄을 차지하는 경우 추가
        if (imageLines > wrappedLines.length) {
          for (let j = wrappedLines.length; j < imageLines; j++) {
            wrappedLines.push('');
          }
        }
      } else {
        wrappedLines = this.wrapMessage(message, messageWidth);
      }
      
      messageLines.push(wrappedLines);
      totalLines += wrappedLines.length;
    }
    
    // 스크롤 계산 - 스크롤 오프셋 적용 (헤더 아래부터 시작)
    let currentY = 3;
    let displayedLines = 0;
    let startMessageIndex = 0;
    
    // 스크롤 오프셋이 0이면 최하단 표시, 아니면 위로 스크롤된 상태
    if (this.scrollOffset === 0) {
      // 최하단 메시지들을 표시
      for (let i = this.history.length - 1; i >= 0; i--) {
        const lines = messageLines[i];
        if (displayedLines + lines.length <= messageAreaHeight) {
          displayedLines += lines.length;
          startMessageIndex = i;
        } else {
          // 일부만 표시할 수 있는 경우 처리
          const remainingLines = messageAreaHeight - displayedLines;
          if (remainingLines > 0) {
            startMessageIndex = i;
            // 이 메시지의 일부만 표시
            messageLines[i] = messageLines[i].slice(-remainingLines);
          }
          break;
        }
      }
    } else {
      // 스크롤 오프셋만큼 위로 스크롤된 상태
      let skipLines = this.scrollOffset;
      let totalDisplayLines = 0;
      
      // 전체 줄 수에서 스크롤 오프셋만큼 건너뛰고 표시
      for (let i = 0; i < this.history.length; i++) {
        const lines = messageLines[i];
        if (skipLines > 0) {
          if (skipLines >= lines.length) {
            skipLines -= lines.length;
            continue;
          } else {
            // 일부만 건너뛰고 나머지 표시
            messageLines[i] = messageLines[i].slice(skipLines);
            skipLines = 0;
          }
        }
        
        if (totalDisplayLines + messageLines[i].length <= messageAreaHeight) {
          totalDisplayLines += messageLines[i].length;
          if (startMessageIndex === 0) startMessageIndex = i;
        } else {
          // 화면에 맞는 만큼만 표시
          const remainingLines = messageAreaHeight - totalDisplayLines;
          if (remainingLines > 0) {
            messageLines[i] = messageLines[i].slice(0, remainingLines);
            totalDisplayLines += remainingLines;
          }
          break;
        }
      }
    }
    
    // 메시지 표시 (헤더 아래부터 시작)
    for (let i = startMessageIndex; i < this.history.length; i++) {
      const lines = messageLines[i];
      for (const line of lines) {
        if (currentY < messageBoxHeight) {
          this.term.moveTo(2, currentY);
          this.term.styleReset();
          this.term(line);
          currentY++;
        } else {
          break;
        }
      }
    }
  }

  private drawInputArea(): void {
    const inputLines = this.currentInput.split('\n');
    const inputHeight = Math.max(1, inputLines.length);
    const inputBoxHeight = inputHeight + 2;
    const hintAreaHeight = 3;
    const messageBoxHeight = this.height - inputBoxHeight - hintAreaHeight;

    // 입력 영역 위치 조정 - 메시지 영역과 공백 추가
    const inputY = messageBoxHeight + 1;
    this.term.brightWhite();
    this.term.moveTo(1, inputY)('┌' + '─'.repeat(this.width - 2) + '┐');
    for (let i = 0; i < inputHeight; i++) {
      this.term.moveTo(1, inputY + 1 + i)('│');
      this.term.moveTo(this.width, inputY + 1 + i)('│');
    }
    this.term.moveTo(1, inputY + inputHeight + 1)('└' + '─'.repeat(this.width - 2) + '┘');

    let cursorX = 2;
    let cursorY = inputY + 1;
    
    // 입력 힌트 및 상태 표시
    if (this.currentInput.length === 0) {
      this.term.gray();
      this.term.moveTo(2, inputY + 1)('Type a message... (@filepath for files, /help for commands)');
      this.term.white();
    } else {
      inputLines.forEach((line, index) => {
        this.term.moveTo(2, inputY + 1 + index)(line);
        if (index === inputLines.length - 1) {
          cursorX += line.length;
          cursorY += index;
        }
      });
      
    }
    
    // 힌트 영역 표시 - 입력 영역과 간격 조정
    const hintY = inputY + inputHeight + 2;
    this.term.brightBlack();
    this.term.moveTo(1, hintY)('┌' + '─'.repeat(this.width - 2) + '┐');
    for (let i = 0; i < hintAreaHeight - 2; i++) {
      this.term.moveTo(1, hintY + 1 + i)('│');
      this.term.moveTo(this.width, hintY + 1 + i)('│');
    }
    this.term.moveTo(1, hintY + hintAreaHeight - 1)('└' + '─'.repeat(this.width - 2) + '┘');
    
    // 파일 첨부 감지 및 실시간 피드백
    if (this.currentInput.startsWith('@')) {
      this.showFileAttachmentStatus(hintY + 1);
    } else if (this.currentInput.startsWith('/')) {
      this.showCommandStatus(hintY + 1);
    } else {
      // 기본 힌트 표시
      this.term.gray();
      this.term.moveTo(2, hintY + 1)('💡 Tip: Use @ for files, / for commands, Ctrl+H for help');
    }

    // IME 입력 중인 문자를 힌트 영역 하단에 표시
    if (this.imeComposing) {
      this.term.gray();
      this.term.moveTo(2, hintY + 2)(`IME: ${this.imeComposing}`);
      this.term.styleReset();
    }

    this.term.moveTo(cursorX, cursorY);
    this.term.hideCursor(false);
    this.term.styleReset();
    
    // 입력 내용 변경 추적
    this.lastInputContent = this.currentInput;
  }

  private drawInputAreaOnly(): void {
    // 입력 내용이 변경되지 않았으면 업데이트하지 않음
    if (this.lastInputContent === this.currentInput && !this.fileSelectionMode) {
      return;
    }

    const inputLines = this.currentInput.split('\n');
    const inputHeight = Math.max(1, inputLines.length);
    const inputBoxHeight = inputHeight + 2;
    const hintAreaHeight = 3;
    const messageBoxHeight = this.height - inputBoxHeight - hintAreaHeight;
    const inputY = messageBoxHeight + 1;
    const hintY = inputY + inputHeight + 2;

    // 입력 영역 지우기 (이전 내용 제거)
    for (let i = 0; i < inputHeight; i++) {
      this.term.moveTo(2, inputY + 1 + i);
      this.term(' '.repeat(this.width - 4));
    }

    // 힌트 영역 지우기
    for (let i = 0; i < hintAreaHeight - 2; i++) {
      this.term.moveTo(2, hintY + 1 + i);
      this.term(' '.repeat(this.width - 4));
    }

    let cursorX = 2;
    let cursorY = inputY + 1;
    
    // 입력 힌트 및 상태 표시
    if (this.currentInput.length === 0) {
      this.term.gray();
      this.term.moveTo(2, inputY + 1)('Type a message... (@filepath for files, /help for commands)');
      this.term.white();
    } else {
      inputLines.forEach((line, index) => {
        this.term.moveTo(2, inputY + 1 + index)(line);
        if (index === inputLines.length - 1) {
          cursorX += line.length;
          cursorY += index;
        }
      });
    }
    
    // 파일 첨부 감지 및 실시간 피드백
    if (this.currentInput.startsWith('@')) {
      this.showFileAttachmentStatus(hintY + 1);
    } else if (this.currentInput.startsWith('/')) {
      this.showCommandStatus(hintY + 1);
    } else {
      // 기본 힌트 표시
      this.term.gray();
      this.term.moveTo(2, hintY + 1)('💡 Tip: Use @ for files, / for commands, Ctrl+H for help');
    }

    // IME 입력 중인 문자를 힌트 영역 하단에 표시
    if (this.imeComposing) {
      this.term.gray();
      this.term.moveTo(2, hintY + 2)(`IME: ${this.imeComposing}`);
      this.term.styleReset();
    }

    this.term.moveTo(cursorX, cursorY);
    this.term.hideCursor(false);
    this.term.styleReset();
    
    // 입력 내용 변경 추적
    this.lastInputContent = this.currentInput;
  }

  private scrollToBottom(): void {
    // 스크롤을 최하단으로 강제 이동
    this.scrollOffset = 0;
  }

  private scrollUp(): void {
    // 위로 스크롤
    this.scrollOffset = Math.max(0, this.scrollOffset - 5);
    this.needsFullRedraw = true;
    this.draw();
  }

  private scrollDown(): void {
    // 아래로 스크롤 (최하단까지만)
    this.scrollOffset = Math.min(this.scrollOffset + 5, this.getMaxScrollOffset());
    this.needsFullRedraw = true;
    this.draw();
  }

  private getMaxScrollOffset(): number {
    // 전체 메시지 줄 수 계산
    const messageWidth = this.width - 4;
    let totalLines = 0;
    
    for (let i = 0; i < this.history.length; i++) {
      const message = this.history[i] as string;
      const wrappedLines = this.wrapMessage(message, messageWidth);
      totalLines += wrappedLines.length;
    }
    
    const messageAreaHeight = this.height - 7; // 대략적인 메시지 영역 높이
    return Math.max(0, totalLines - messageAreaHeight);
  }

  private async exit(): Promise<void> {
    if (this.isExiting) return;
    this.isExiting = true;
    
    // 퇴장 메시지를 서버에 전송
    if (this.client.isConnectionOpen()) {
      this.displayMessage('system', `📢 ${this.nickname} is leaving the room.`);
      this.client.sendLeaveMessage(this.room, this.nickname);
      // 메시지 전송 후 짧은 지연
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.term.fullscreen(false);
    this.client.disconnect();
    this.term.processExit(0);
  }

}