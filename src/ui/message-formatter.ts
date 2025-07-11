import { Terminal } from 'terminal-kit';

export class MessageFormatter {
  private term: Terminal;

  constructor(term: Terminal) {
    this.term = term;
  }

  format(type: 'user' | 'own' | 'system' | 'error' | 'image', message: string, nickname?: string): string {
    const timestamp = new Date().toLocaleTimeString();
    
    switch (type) {
      case 'user':
        return `^K${timestamp}^ ^g${nickname || 'Unknown'}:^ ${this.formatMessage(message)}`;
      
      case 'own':
        return `^K${timestamp}^ ^b${nickname || 'You'}:^ ${this.formatMessage(message)}`;
      
      case 'system':
        return `^K${timestamp}^ ^y^/System:^ ^y${message}^`;
      
      case 'error':
        return `^K${timestamp}^ ^r^/Error:^ ^r${message}^`;
      
      case 'image':
        return `^K${timestamp}^ ^m${nickname || 'User'} sent an image:^\n${message}`;

      default:
        return message;
    }
  }

  private formatMessage(message: string): string {
    // terminal-kit's markup is powerful, but for complex replacements,
    // we'll stick to simple string replacement for now.
    
    // Handle code blocks
    message = message.replace(/```([^`]+)```/g, (match, code) => {
      return `^K${code}^`; // Black background, white text
    });

    // Handle inline code
    message = message.replace(/`([^`]+)`/g, (match, code) => {
      return `^K${code}^`; // Black background, white text
    });

    // Handle URLs - fixed to prevent trailing ^
    message = message.replace(/(https?:\/\/[^\s]+)/g, (match, url) => {
      return `^_^c${url}^`; // Underlined cyan, ^ at end is style reset
    });

    // Handle mentions
    message = message.replace(/@(\w+)/g, (match, username) => {
      return `^m${match}^`; // Magenta
    });

    // Handle bold text
    message = message.replace(/\*\*([^*]+)\*\*/g, (match, text) => {
      return `^+${text}^`; // Bold
    });

    // Handle italic text
    message = message.replace(/\*([^*]+)\*/g, (match, text) => {
      return `^/${text}^`; // Italic
    });

    return message;
  }
}
