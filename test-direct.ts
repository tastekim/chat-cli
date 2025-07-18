#!/usr/bin/env tsx

import { startInkChatInterface } from './src/ui/ink-chat-interface.js';

// Test with direct connection to korean room
const testLocation = {
  country: 'KR',
  region: 'Seoul',
  city: 'Seoul',
  timezone: 'Asia/Seoul',
  flag: '🇰🇷'
};

console.log('🧪 Starting direct test...');
startInkChatInterface('tastekim', 'korean', testLocation);