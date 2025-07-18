import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { LocationInfo } from '../utils/location-detector';

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private userLocation: LocationInfo | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private isConnected: boolean = false;
  private isReconnecting: boolean = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(serverUrl: string = 'ws://34.64.54.24:8080/api/v1/ws') {
    super();
    this.serverUrl = serverUrl;
  }

  async connectWithParams(nickname: string, room: string, location?: LocationInfo): Promise<void> {
    const url = new URL(this.serverUrl);
    url.searchParams.set('nickname', nickname);
    url.searchParams.set('room', room);
    
    this.serverUrl = url.toString();
    this.userLocation = location || null;
    
    return this.connect();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      this.ws = new WebSocket(this.serverUrl);

      const connectTimeout = setTimeout(() => {
        if (this.ws) this.ws.terminate();
        reject(new Error('Connection timeout'));
      }, 10000);

      this.ws.on('open', () => {
        console.log('WebSocket connection opened');
        clearTimeout(connectTimeout);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        // All messages are now handled by the ChatInterface
        this.emit('message', data.toString());
      });

      this.ws.on('close', (code: number, reason: string) => {
        clearTimeout(connectTimeout);
        this.isConnected = false;
        this.emit('disconnected', { code, reason: reason || 'Connection closed' });
        if (code !== 1000 && !this.isReconnecting) {
          this.attemptReconnect();
        }
      });

      this.ws.on('error', (error: Error) => {
        clearTimeout(connectTimeout);
        this.isConnected = false;
        this.emit('error', error);
        if (this.reconnectAttempts === 0) {
          reject(error);
        }
      });
    });
  }

  private attemptReconnect(): void {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.emit('maxReconnectAttemptsReached');
      }
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();
        this.isReconnecting = false;
      } catch (error) {
        this.isReconnecting = false;
        this.attemptReconnect();
      }
    }, delay);
  }

  public sendWebSocketMessage(message: object): boolean {
    // console.log('sendWebSocketMessage called with:', message);
    // console.log('Connection state - isConnected:', this.isConnected);
    // console.log('WebSocket readyState:', this.ws?.readyState);
    // console.log('WebSocket.OPEN constant:', WebSocket.OPEN);
    
    if (!this.isConnectionOpen()) {
      console.error('Connection not open - cannot send message');
      this.emit('error', new Error('Connection not available'));
      return false;
    }
    try {
      const jsonMessage = JSON.stringify(message);
      // console.log('Sending JSON message:', jsonMessage);
      this.ws?.send(jsonMessage);
      // console.log('Message sent successfully');
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      this.emit('error', new Error('Failed to send message'));
      return false;
    }
  }

  disconnect(): void {
    this.isConnected = false;
    this.isReconnecting = false;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
    }
  }

  isConnectionOpen(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}
