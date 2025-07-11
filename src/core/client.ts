import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface MessageData {
  type: 'message' | 'system' | 'join' | 'leave';
  nickname?: string;
  message: string | Buffer;
  room: string;
  timestamp: Date;
}

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private isConnected: boolean = false;
  private isReconnecting: boolean = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatTimeout: NodeJS.Timeout | null = null;

  constructor(serverUrl: string = 'ws://34.64.54.24:8080/api/v1/ws') {
    super();
    this.serverUrl = serverUrl;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (this.isConnected) {
          resolve();
          return;
        }

        this.cleanupConnection();
        this.ws = new WebSocket(this.serverUrl);

        const connectTimeout = setTimeout(() => {
          if (this.ws) {
            this.ws.terminate();
            this.ws = null;
          }
          reject(new Error('Connection timeout'));
        }, 10000); // 10초 타임아웃

        this.ws.on('open', () => {
          clearTimeout(connectTimeout);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.isReconnecting = false;
          this.startHeartbeat();
          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            if (data.toString() === 'pong') {
              // Heartbeat response
              if (this.heartbeatTimeout) {
                clearTimeout(this.heartbeatTimeout);
              }
              return;
            }

            if (Buffer.isBuffer(data)) {
              // 이미지 버퍼 유효성 검사
              if (this.isValidImageBuffer(data)) {
                this.handleMessage({ type: 'message', message: data, room: '', timestamp: new Date() });
              } else {
                // 유효하지 않은 이미지 버퍼는 무시 (로그만 남기고 사용자에게 표시하지 않음)
                // console.warn('Received invalid image buffer, ignoring');
              }
            } else {
              const message = JSON.parse(data.toString());
              this.handleMessage(message);
            }
          } catch (error) {
            console.error('Failed to parse message:', error);
            this.emit('error', new Error('Failed to parse message'));
          }
        });

        this.ws.on('close', (code: number, reason: string) => {
          clearTimeout(connectTimeout);
          this.isConnected = false;
          this.stopHeartbeat();
          this.emit('disconnected', { code, reason: reason || 'Connection closed' });
          
          // 정상적인 종료가 아닌 경우만 재연결 시도
          if (code !== 1000 && !this.isReconnecting) {
            this.attemptReconnect();
          }
        });

        this.ws.on('error', (error: Error) => {
          clearTimeout(connectTimeout);
          this.isConnected = false;
          this.stopHeartbeat();
          this.emit('error', error);
          
          // 연결 시도 중 에러가 발생한 경우
          if (this.reconnectAttempts === 0) {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(message: MessageData): void {
    switch (message.type) {
      case 'message':
        this.emit('message', message);
        break;
      case 'system':
        this.emit('system', message);
        break;
      case 'join':
        this.emit('system', { message: `${message.nickname} joined the room` });
        break;
      case 'leave':
        this.emit('system', { message: `${message.nickname} left the room` });
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  private cleanupConnection(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.stopHeartbeat();
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('ping');
        this.heartbeatTimeout = setTimeout(() => {
          // 서버로부터 pong 응답이 없으면 연결 종료
          if (this.ws) {
            this.ws.terminate();
          }
        }, 5000); // 5초 응답 대기
      }
    }, 30000); // 30초마다 heartbeat
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  private attemptReconnect(): void {
    if (this.isReconnecting) {
      return;
    }

    this.isReconnecting = true;
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000); // 최대 30초
      
      // 재연결 시도는 백그라운드에서 조용히 처리
      this.reconnectTimeout = setTimeout(async () => {
        try {
          await this.connect();
          // 재연결 성공 메시지도 표시하지 않음
          // this.emit('system', { message: 'Reconnected successfully!' });
        } catch (error) {
          console.error('Reconnection failed:', error);
          // 재연결 실패는 로그로만 기록하고 사용자에게 표시하지 않음
          this.isReconnecting = false;
          this.attemptReconnect();
        }
      }, delay);
    } else {
      this.isReconnecting = false;
      this.emit('system', { message: 'Failed to reconnect after multiple attempts. Please restart the application.' });
      this.emit('maxReconnectAttemptsReached');
    }
  }

  joinRoom(room: string, nickname: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: 'join',
          room,
          nickname,
          timestamp: new Date(),
        }));
      } catch (error) {
        console.error('Failed to send join message:', error);
        this.emit('error', new Error('Failed to join room'));
      }
    } else {
      this.emit('error', new Error('Connection not available'));
    }
  }

  async connectWithParams(nickname: string, room: string): Promise<void> {
    const url = new URL(this.serverUrl);
    url.searchParams.set('nickname', nickname);
    url.searchParams.set('room', room);
    
    this.serverUrl = url.toString();
    return this.connect();
  }

  sendMessage(message: string | Buffer): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.emit('error', new Error('Connection not available'));
      return false;
    }

    try {
      if (Buffer.isBuffer(message)) {
        this.ws.send(message);
      } else {
        this.ws.send(JSON.stringify({
          type: 'message',
          message,
          timestamp: new Date(),
        }));
      }
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      this.emit('error', new Error('Failed to send message'));
      return false;
    }
  }

  disconnect(): void {
    this.isConnected = false;
    this.isReconnecting = false;
    this.cleanupConnection();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
  }

  isConnectionOpen(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  getConnectionState(): string {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'disconnected';
      default: return 'unknown';
    }
  }

  private isValidImageBuffer(buffer: Buffer): boolean {
    // 빈 버퍼 또는 너무 작은 버퍼 체크
    if (!buffer || buffer.length < 8) {
      return false;
    }
    
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
}