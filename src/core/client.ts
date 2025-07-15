import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { LocationInfo } from '../utils/location-detector';

export interface MessageData {
  type: 'message' | 'system' | 'join' | 'leave' | 'user_count';
  nickname?: string;
  message: string | Buffer;
  room: string;
  timestamp: Date;
  location?: { countryCode: string; country: string };
  data?: any;
}

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private userLocation: LocationInfo | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private isConnected: boolean = false;
  private isReconnecting: boolean = false;
  private hasConnectedBefore: boolean = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatTimeout: NodeJS.Timeout | null = null;

  private debugLog(message: string, ...args: any[]) {
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      const logMessage = `[${new Date().toISOString()}] ${message}`;
      console.log(logMessage, ...args);
      try {
        require('fs').appendFileSync('/tmp/chat-debug.log', logMessage + ' ' + args.map(a => JSON.stringify(a)).join(' ') + '\n');
      } catch (e) {
        // 파일 쓰기 실패해도 무시
      }
    }
  }

  constructor(serverUrl: string = 'ws://34.64.54.24:8080/api/v1/ws') {
    super();
    this.serverUrl = serverUrl;
    
    // 디버깅 모드 활성화
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      console.log('🔍 Debug mode enabled');
      // 로그 파일에 기록
      require('fs').appendFileSync('/tmp/chat-debug.log', `[${new Date().toISOString()}] Debug mode enabled\n`);
    }
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

        if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
          console.log('🔧 WebSocket created, setting up event listeners...');
        }

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
          
          if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
            console.log('🔗 WebSocket connected to:', this.serverUrl);
          }
          
          // 초기 연결인지 재연결인지 구분하여 이벤트 발생
          if (!this.hasConnectedBefore) {
            this.hasConnectedBefore = true;
            this.emit('connected');
          } else {
            this.emit('reconnected');
          }
          
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
              console.log('📨 WebSocket message event triggered');
              console.log('📨 Raw data type:', typeof data);
              console.log('📨 Raw data length:', data.toString().length);
              console.log('📨 Raw message received:', data.toString());
            }
            
            if (data.toString() === 'pong') {
              if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
                console.log('🏓 Received pong response');
              }
              // Heartbeat response
              if (this.heartbeatTimeout) {
                clearTimeout(this.heartbeatTimeout);
              }
              return;
            }

            // 먼저 문자열로 변환해서 JSON인지 확인
            const messageStr = data.toString();
            
            // JSON 메시지인지 확인 (중괄호로 시작하는지)
            if (messageStr.trim().startsWith('{')) {
              if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
                console.log('📝 Processing JSON text message...');
              }
              
              try {
                const message = JSON.parse(messageStr);
                
                if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
                  console.log('📨 Successfully parsed JSON message:', message);
                  console.log('📨 Message type:', message.type);
                  console.log('📨 Message nickname:', message.nickname);
                  console.log('📨 Message content:', message.message);
                }
                
                this.handleMessage(message);
              } catch (parseError) {
                console.error('❌ Failed to parse JSON message:', parseError);
                console.error('❌ Message content:', messageStr);
              }
            } else if (Buffer.isBuffer(data) && !messageStr.trim().startsWith('{')) {
              // 실제 바이너리 데이터 (이미지 등)
              if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
                console.log('📦 Received binary data, size:', data.length);
              }
              
              if (this.isValidImageBuffer(data)) {
                this.handleMessage({ type: 'message', message: data, room: '', timestamp: new Date() });
              } else {
                if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
                  console.warn('⚠️ Invalid image buffer received, ignoring');
                }
              }
            } else {
              // 알 수 없는 메시지 형식
              if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
                console.warn('⚠️ Unknown message format:', messageStr);
              }
            }
          } catch (error) {
            console.error('❌ Failed to parse message:', error);
            console.error('❌ Raw data:', data.toString());
            if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
              console.error('❌ Error stack:', error);
            }
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
          
          if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
            console.error('🚨 WebSocket error:', error);
          }
          
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
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      console.log('🔄 Handling message type:', message.type, message);
    }
    
    switch (message.type) {
      case 'message':
        if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
          console.log('💬 Emitting message event:', message);
        }
        this.emit('message', message);
        break;
      case 'system':
        if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
          console.log('🔧 Emitting system event:', message);
        }
        this.emit('system', message);
        break;
      case 'join':
        if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
          console.log('👋 User joined:', message.nickname);
        }
        this.emit('system', { message: `${message.nickname} joined the room`, isJoinMessage: true, nickname: message.nickname });
        break;
      case 'leave':
        if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
          console.log('👋 User left:', message.nickname);
        }
        this.emit('system', { message: `${message.nickname} left the room`, isLeaveMessage: true, nickname: message.nickname });
        break;
      case 'user_count':
        if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
          console.log('👥 User count update:', message.data);
        }
        this.emit('user_count', message);
        break;
      default:
        console.warn('⚠️ Unknown message type:', message.type, message);
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
        const joinMessage = {
          type: 'join',
          room,
          nickname,
          timestamp: new Date(),
        };
        
        if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
          console.log('📤 Sending join message:', joinMessage);
        }
        
        this.ws.send(JSON.stringify(joinMessage));
      } catch (error) {
        console.error('Failed to send join message:', error);
        this.emit('error', new Error('Failed to join room'));
      }
    } else {
      this.emit('error', new Error('Connection not available'));
    }
  }

  async connectWithParams(nickname: string, room: string, location?: LocationInfo): Promise<void> {
    const url = new URL(this.serverUrl);
    url.searchParams.set('nickname', nickname);
    url.searchParams.set('room', room);
    
    this.serverUrl = url.toString();
    this.userLocation = location || null;
    
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      console.log('🔗 Connecting to:', this.serverUrl);
      console.log('👤 Nickname:', nickname, 'Room:', room);
      console.log('📍 User Location set to:', this.userLocation);
    }
    
    return this.connect();
  }

  sendMessage(message: string | Buffer): boolean {
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      console.log('🚀 sendMessage called with:', typeof message === 'string' ? `"${message}"` : `Buffer(${message.length} bytes)`);
      console.log('🔌 WebSocket state:', this.ws?.readyState, 'isConnected:', this.isConnected);
    }
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
        console.error('❌ Cannot send message - WebSocket not ready');
        console.log('   WebSocket exists:', !!this.ws);
        console.log('   WebSocket state:', this.ws?.readyState);
        console.log('   Expected state (OPEN):', 1);
      }
      this.emit('error', new Error('Connection not available'));
      return false;
    }

    try {
      if (Buffer.isBuffer(message)) {
        if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
          console.log('📤 Sending image buffer, size:', message.length);
        }
        this.ws.send(message);
      } else {
        const msgObj = {
          type: 'message',
          message,
          timestamp: new Date(),
          location: this.userLocation ? {
            countryCode: this.userLocation.countryCode,
            country: this.userLocation.country
          } : undefined,
        };
        
        const jsonString = JSON.stringify(msgObj);
        
        if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
          console.log('📤 Sending text message object:', msgObj);
          console.log('📤 User location when sending:', this.userLocation);
          console.log('📤 JSON string being sent:', jsonString);
        }
        
        this.ws.send(jsonString);
        
        if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
          console.log('✅ Message sent successfully');
        }
      }
      return true;
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
        console.error('   Error details:', error);
      }
      this.emit('error', new Error('Failed to send message'));
      return false;
    }
  }

  sendLeaveMessage(room: string, nickname: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: 'leave',
          room,
          nickname,
          timestamp: new Date(),
        }));
      } catch (error) {
        console.error('Failed to send leave message:', error);
      }
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