import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { WebSocketClient } from '../core/client.js';
import { LocationInfo } from '../utils/location-detector.js';

// Custom hook for terminal dimensions
const useTerminalDimensions = () => {
  const [dimensions, setDimensions] = useState({
    width: process.stdout.columns || 80,
    height: process.stdout.rows || 24
  });
  
  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: process.stdout.columns || 80,
        height: process.stdout.rows || 24
      });
    };
    
    process.stdout.on('resize', handleResize);
    return () => {
      process.stdout.off('resize', handleResize);
    };
  }, []);
  
  return dimensions;
};

// Dynamic layout calculator
const getDynamicLayout = (terminalWidth: number) => {
  if (terminalWidth < 60) {
    return { roomList: 0, chat: 100, userList: 0 }; // Hide sidebars in small terminals
  } else if (terminalWidth < 80) {
    return { roomList: 25, chat: 75, userList: 0 }; // Hide user list only
  } else {
    return { roomList: 25, chat: 60, userList: 15 }; // Full layout
  }
};

// Define the structure for room information
interface RoomInfo {
  name: string;
  isPrivate: boolean;
  userCount: number;
}

interface Props {
  nickname: string;
  room: string;
  location: LocationInfo;
}

interface Message {
  type: 'user' | 'own' | 'system' | 'error';
  content: string;
  sender?: string;
}

// Parse message content for code blocks and markdown
const parseMessageContent = (content: string): { type: 'text' | 'code' | 'markdown'; content: string; language?: string }[] => {
  const parts: { type: 'text' | 'code' | 'markdown'; content: string; language?: string }[] = [];
  
  // Split by code blocks (```language\ncode\n```)
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)\n```/g;
  let lastIndex = 0;
  let match;
  
  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index);
      if (textBefore.trim()) {
        parts.push({ type: 'text', content: textBefore });
      }
    }
    
    // Add code block
    const language = match[1] || 'text';
    const codeContent = match[2];
    parts.push({ type: 'code', content: codeContent, language });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    const remainingText = content.slice(lastIndex);
    if (remainingText.trim()) {
      parts.push({ type: 'text', content: remainingText });
    }
  }
  
  // If no code blocks found, treat as plain text or markdown
  if (parts.length === 0) {
    // Check if it has markdown syntax
    const hasMarkdown = /(\*\*.*?\*\*|\*.*?\*|`.*?`|#+ |>+ |\[.*?\]\(.*?\))/.test(content);
    parts.push({ 
      type: hasMarkdown ? 'markdown' : 'text', 
      content 
    });
  }
  
  return parts;
};

// Code block component with syntax highlighting
const CodeBlock: React.FC<{ content: string; language?: string }> = ({ content, language }) => {
  return (
    <Box 
      borderStyle="round" 
      borderColor="gray" 
      paddingX={1} 
      paddingY={0}
      marginY={0}
      flexDirection="column"
    >
      <Box>
        <Text color="gray" dimColor>📄 {language || 'code'}</Text>
      </Box>
      {content.split('\n').map((line, index) => (
        <Text key={index} color="green" inverse>
          {line}
        </Text>
      ))}
    </Box>
  );
};

// Message bubble component with markdown and code block support
const MessageBubble: React.FC<{ message: Message; isOwn: boolean; terminalWidth: number }> = ({ message, isOwn, terminalWidth }) => {
  const layout = getDynamicLayout(terminalWidth);
  const maxMessageWidth = Math.max(20, Math.floor((layout.chat / 100) * terminalWidth - 10));
  
  // Parse message content
  const parsedContent = parseMessageContent(message.content);
  const hasCodeBlocks = parsedContent.some(part => part.type === 'code');
  
  return (
    <Box 
      flexDirection="row" 
      justifyContent={isOwn ? 'flex-end' : 'flex-start'}
      marginY={0}
      paddingX={1}
    >
      <Box
        borderStyle="round"
        borderColor={isOwn ? "white" : "cyan"}
        paddingX={1}
        paddingY={hasCodeBlocks ? 1 : 0}
        width={maxMessageWidth > 80 ? "80%" : "auto"}
        flexDirection="column"
      >
        {parsedContent.map((part, index) => {
          switch (part.type) {
            case 'code':
              return (
                <CodeBlock 
                  key={index} 
                  content={part.content} 
                  language={part.language}
                />
              );
            case 'markdown':
              // Simple markdown rendering without external dependency
              const renderSimpleMarkdown = (text: string) => {
                // Bold **text**
                const boldRegex = /\*\*(.*?)\*\*/g;
                // Italic *text*
                const italicRegex = /\*(.*?)\*/g;
                // Inline code `code`
                const codeRegex = /`([^`]+)`/g;
                
                const parts = [];
                let lastIndex = 0;
                let match;
                
                // Process bold text
                while ((match = boldRegex.exec(text)) !== null) {
                  if (match.index > lastIndex) {
                    parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
                  }
                  parts.push({ type: 'bold', content: match[1] });
                  lastIndex = match.index + match[0].length;
                }
                
                if (lastIndex < text.length) {
                  parts.push({ type: 'text', content: text.slice(lastIndex) });
                }
                
                return parts.map((part, i) => {
                  switch (part.type) {
                    case 'bold':
                      return <Text key={i} bold color={isOwn ? "white" : "cyan"}>{part.content}</Text>;
                    default:
                      return <Text key={i} color={isOwn ? "white" : "cyan"}>{part.content}</Text>;
                  }
                });
              };
              
              return (
                <Box key={index}>
                  {renderSimpleMarkdown(part.content)}
                </Box>
              );
            case 'text':
            default:
              // Handle multiline text
              const lines = part.content.split('\n');
              return lines.length > 1 ? (
                <Box key={index} flexDirection="column">
                  {lines.map((line, lineIndex) => (
                    <Text key={lineIndex} color={isOwn ? "white" : "cyan"} wrap="wrap">
                      {line}
                    </Text>
                  ))}
                </Box>
              ) : (
                <Text key={index} color={isOwn ? "white" : "cyan"} wrap="wrap">
                  {part.content}
                </Text>
              );
          }
        })}
      </Box>
    </Box>
  );
};

// System message component
const SystemMessage: React.FC<{ message: Message }> = ({ message }) => {
  const color = message.type === 'error' ? 'red' : 'yellow';
  
  return (
    <Box justifyContent="center" marginY={0}>
      <Text color={color} dimColor italic>
        {message.content}
      </Text>
    </Box>
  );
};

// Responsive sidebar component
const ResponsiveSidebar: React.FC<{ 
  type: 'room' | 'user';
  terminalWidth: number;
  children: React.ReactNode;
}> = ({ type, terminalWidth, children }) => {
  const layout = getDynamicLayout(terminalWidth);
  const width = type === 'room' ? layout.roomList : layout.userList;
  
  if (width === 0) return null; // Hide sidebar if no space
  
  return (
    <Box width={`${width}%`} borderStyle="round" borderColor="gray">
      {children}
    </Box>
  );
};

// Room list component
const RoomList: React.FC<{ 
  rooms: RoomInfo[], 
  currentRoom: string, 
  title: string,
  unreadRooms: Set<string>,
  onSelect: (room: string) => void 
}> = ({ rooms, currentRoom, title, unreadRooms, onSelect }) => {
  return (
    <Box flexDirection="column" height="100%" overflow="hidden">
      <Box paddingY={0} paddingX={1} justifyContent="flex-start" height={1} flexShrink={0}>
        <Text color="cyan" dimColor>
          {title}
        </Text>
      </Box>
      <Box flexDirection="column" flexGrow={1} paddingX={1} overflow="hidden">
        {rooms.map((room, index) => (
          <Box key={room.name} paddingY={0} flexShrink={0}>
            <Text 
              color={room.name === currentRoom ? 'green' : 'white'}
              bold={room.name === currentRoom}
            >
              {index + 1}. {room.isPrivate ? '🔒' : '#'} {room.name} ({room.userCount})
              {unreadRooms.has(room.name) && room.name !== currentRoom && (
                <Text color="green" bold> •</Text>
              )}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// User list component
const UserList: React.FC<{ 
  users: string[],
  currentUser: string
}> = ({ users, currentUser }) => {
  return (
    <Box flexDirection="column" height="100%" overflow="hidden">
      <Box paddingY={0} paddingX={1} justifyContent="flex-start" height={1} flexShrink={0}>
        <Text color="cyan" dimColor>
          Users ({users.length})
        </Text>
      </Box>
      <Box flexDirection="column" flexGrow={1} paddingX={1} overflow="hidden">
        {users.map((user, index) => (
          <Box key={user} paddingY={0} flexShrink={0}>
            <Text 
              color={user === currentUser ? 'green' : 'white'}
              bold={user === currentUser}
            >
              {user === currentUser ? '👤' : '👥'} {user}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// Chat panel component
const ChatPanel: React.FC<{ 
  terminalWidth: number;
  currentRoomId: string;
  messages: Message[];
  isTyping: boolean;
  currentInput: string;
  nickname: string;
}> = ({ terminalWidth, currentRoomId, messages, isTyping, currentInput, nickname }) => {
  const layout = getDynamicLayout(terminalWidth);
  
  return (
    <Box flexDirection="column" width={`${layout.chat}%`} borderStyle="round" borderColor="cyan" minWidth="40" height="100%">
      {/* Chat Header */}
      <Box paddingY={0} paddingX={1} justifyContent="flex-start" height={1} flexShrink={0}>
        <Text color="cyan" dimColor>
          Chat - {currentRoomId}
        </Text>
      </Box>
      
      {/* Messages Container - Expandable, leaving space for typing indicator */}
      <Box flexDirection="column" flexGrow={1} paddingX={1} overflow="hidden">
        {messages.slice(-10).map((message, index) => {
          if (message.type === 'system' || message.type === 'error') {
            return <SystemMessage key={index} message={message} />;
          }
          return (
            <MessageBubble 
              key={index} 
              message={message} 
              isOwn={message.type === 'own'} 
              terminalWidth={terminalWidth}
            />
          );
        })}
      </Box>
      
      {/* Typing Indicator - Fixed at bottom of chat panel */}
      <Box height={1} paddingX={1} flexShrink={0}>
        {isTyping && currentInput ? (
          <Text color="gray" dimColor>
            💭 {nickname} is typing...
          </Text>
        ) : (
          <Text> </Text>
        )}
      </Box>
    </Box>
  );
};

// Simple Input component
const ChatInput: React.FC<{ 
  value: string; 
  placeholder?: string;
  isFocused?: boolean;
}> = ({ value, placeholder, isFocused = true }) => {
  return (
    <Box 
      flexDirection="row"
      alignItems="center"
      width="100%"
      paddingX={1}
      paddingY={0}
      height="100%"
    >
      <Box marginRight={1}>
        <Text color="cyan">💬</Text>
      </Box>
      <Text wrap="wrap">
        {value || (placeholder && <Text color="gray" dimColor>{placeholder}</Text>)}
        {isFocused && <Text color="cyan">|</Text>}
      </Text>
    </Box>
  );
};

const ChatInterface: React.FC<Props> = ({ nickname, room, location }) => {
  const { exit } = useApp();
  const { width: terminalWidth, height: terminalHeight } = useTerminalDimensions();
  
  // State management
  const [currentViewingRoom, setCurrentViewingRoom] = useState(room); // 현재 UI에서 보고 있는 방
  const [joinedRooms, setJoinedRooms] = useState<RoomInfo[]>([]); // 실제로 참여한 방들
  const [availableRooms, setAvailableRooms] = useState<RoomInfo[]>([]);
  const [messages, setMessages] = useState<Message[]>([]); // 현재 보고 있는 방의 메시지
  const [allRoomMessages, setAllRoomMessages] = useState<{ [roomId: string]: Message[] }>({}); // 모든 방의 메시지
  const [unreadRooms, setUnreadRooms] = useState<Set<string>>(new Set()); // 읽지 않은 메시지가 있는 방들
  const [currentInput, setCurrentInput] = useState('');
  const [showJoinedRooms, setShowJoinedRooms] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [currentRoomUsers, setCurrentRoomUsers] = useState<string[]>([]);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [roomCreationStep, setRoomCreationStep] = useState<'name' | 'privacy' | 'password' | null>(null);
  const [pendingRoomData, setPendingRoomData] = useState<{name?: string, isPrivate?: boolean, password?: string}>({});
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [pendingJoinRoom, setPendingJoinRoom] = useState<{name: string, isPrivate: boolean} | null>(null);
  
  // WebSocket client
  const [client] = useState(() => new WebSocketClient());
  
  // Handle terminal resize with immediate responsive behavior
  useEffect(() => {
    const handleResize = () => {
      // Clear screen on resize to prevent UI duplication
      process.stdout.write('\x1b[2J\x1b[H');
    };
    
    process.stdout.on('resize', handleResize);
    
    return () => {
      process.stdout.off('resize', handleResize);
    };
  }, []);
  
  // Prevent scrolling beyond terminal bounds
  useEffect(() => {
    // Disable line wrapping and hide cursor
    process.stdout.write('\x1b[?7l'); // Disable line wrapping
    process.stdout.write('\x1b[?25l'); // Hide cursor
    
    return () => {
      process.stdout.write('\x1b[?25h'); // Show cursor
      process.stdout.write('\x1b[?7h'); // Enable line wrapping
    };
  }, []);

  // Add message to specific room (or current viewing room if no room specified)
  const addMessageToRoom = useCallback((roomId: string, type: Message['type'], content: string, sender?: string) => {
    const newMessage: Message = { type, content, sender };
    
    // Store in all room messages
    setAllRoomMessages(prev => {
      const roomMessages = prev[roomId] || [];
      
      // Check for duplicate messages (same content, same sender, within 1 second)
      const now = Date.now();
      const isDuplicate = roomMessages.some(msg => 
        msg.content === content && 
        msg.sender === sender && 
        msg.type === type
      );
      
      if (isDuplicate && sender === nickname) {
        // Skip adding duplicate own messages (optimistic update already added it)
        return prev;
      }
      
      return {
        ...prev,
        [roomId]: [...roomMessages, newMessage]
      };
    });
    
    // If this message is for the currently viewing room, also update the messages state
    if (roomId === currentViewingRoom) {
      setMessages(prev => {
        // Check for duplicates in current messages too
        const isDuplicate = prev.some(msg => 
          msg.content === content && 
          msg.sender === sender && 
          msg.type === type
        );
        
        if (isDuplicate && sender === nickname) {
          return prev; // Don't add duplicate own messages
        }
        
        return [...prev, newMessage];
      });
    } else {
      // If message is for a different room and not from self, mark as unread
      if (sender && sender !== nickname && type === 'user') {
        setUnreadRooms(prev => new Set([...prev, roomId]));
      }
    }
  }, [currentViewingRoom, nickname]);

  // Add message to current viewing room (for system messages, etc.)
  const addMessage = useCallback((type: Message['type'], content: string, sender?: string) => {
    addMessageToRoom(currentViewingRoom, type, content, sender);
  }, [currentViewingRoom, addMessageToRoom]);

  // Handle WebSocket events
  useEffect(() => {
    const setupClient = async () => {
      try {
        addMessage('system', 'Connecting to server...');
        await client.connectWithParams(nickname, room, location);
        setIsConnected(true);
        
        // Set the initial viewing room and add to joined rooms
        setCurrentViewingRoom(room);
        const initialRoom = { name: room, isPrivate: false, userCount: 1 };
        setJoinedRooms([initialRoom]);
        console.log(`Initial room set: ${room}`, [initialRoom]);
        // Add self to user list
        setCurrentRoomUsers([nickname]);
        addMessage('system', `Connected! Welcome to ${room}.`);
        addMessage('system', 'Type /help to see available commands');

        // Setup event handlers
        client.on('message', (data: any) => {
          try {
            const message = JSON.parse(data);
            switch (message.type) {
              case 'CHAT_MESSAGE':
                handleChatMessage(message.payload);
                break;
              case 'ROOM_LIST':
                handleRoomList(message.payload);
                break;
              case 'ROOM_CREATED':
                handleRoomCreated(message.payload);
                break;
              case 'ROOM_DELETED':
                handleRoomDeleted(message.payload);
                break;
              case 'USER_COUNT_UPDATE':
                handleUserCountUpdate(message.payload);
                break;
              case 'JOIN_ROOM_SUCCESS':
                handleJoinRoomSuccess(message.payload);
                break;
              case 'JOIN_ROOM_ERROR':
                handleJoinRoomError(message.payload);
                break;
              case 'ERROR':
                addMessage('error', `Server Error: ${message.payload.message}`);
                break;
              default:
                addMessage('system', `Unknown message type: ${message.type}`);
            }
          } catch (err) {
            console.error('Failed to parse message:', err, 'Raw data:', data);
            addMessage('error', `Failed to parse message: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        });

        client.on('disconnected', (data) => {
          setIsConnected(false);
          addMessage('system', `Disconnected: ${data.reason || 'Connection lost'}`);
        });
        
        client.on('error', (error) => {
          addMessage('error', `Connection error: ${error.message || 'Unknown error'}`);
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        addMessage('error', `Failed to connect: ${errorMessage}`);
      }
    };

    setupClient();

    return () => {
      client.disconnect();
    };
  }, [client, nickname, location]); // Removed room and addMessage to prevent reconnections

  // Message handlers
  const handleChatMessage = useCallback((payload: any) => {
    const { roomId, sender, content } = payload;
    
    const messageType = sender === nickname ? 'own' : (sender === 'System' ? 'system' : 'user');
    
    // Store message in the appropriate room
    addMessageToRoom(roomId, messageType, content, sender);
    
    // Update user list only for the currently viewing room
    if (roomId === currentViewingRoom && sender !== 'System' && sender !== nickname && !currentRoomUsers.includes(sender)) {
      setCurrentRoomUsers(prev => [...prev, sender]);
    }
    
    // Auto-add room to joined rooms if we receive a message from a room we're not tracking
    if (sender === 'System' && (content.includes('Welcome to') || content.includes('You have joined'))) {
      setJoinedRooms(prev => {
        const roomExists = prev.some(r => r.name === roomId);
        if (!roomExists) {
          const roomToAdd = availableRooms.find(r => r.name === roomId);
          if (roomToAdd) {
            console.log(`Adding room to joined list: ${roomId}`, [...prev, roomToAdd]);
            return [...prev, roomToAdd];
          } else {
            // Create a basic room info if not found in available rooms
            const newRoom = { name: roomId, isPrivate: false, userCount: 1 };
            console.log(`Creating and adding new room: ${roomId}`, [...prev, newRoom]);
            return [...prev, newRoom];
          }
        }
        return prev;
      });
      
      // Auto-switch to the new room if this is a room creation welcome message
      if (content.includes('Welcome to') && roomId !== currentViewingRoom) {
        // Switch to the new room immediately
        setTimeout(() => {
          const roomHistory = allRoomMessages[roomId] || [];
          setCurrentViewingRoom(roomId);
          setMessages(roomHistory);
          setCurrentRoomUsers([nickname]);
        }, 100); // Small delay to ensure state updates
      }
    }
  }, [nickname, currentViewingRoom, addMessageToRoom, availableRooms, currentRoomUsers]);

  const handleRoomList = useCallback((payload: any) => {
    setAvailableRooms(payload.rooms || []);
    // Update joined rooms info with current room counts
    setJoinedRooms(prev => 
      prev.map(joinedRoom => {
        const updatedRoom = (payload.rooms || []).find((r: RoomInfo) => r.name === joinedRoom.name);
        return updatedRoom || joinedRoom;
      })
    );
  }, []);

  const handleRoomCreated = useCallback((payload: any) => {
    console.log('Room created:', payload);
    setAvailableRooms(prev => {
      if (!prev.some(r => r.name === payload.name)) {
        addMessage('system', `🏠 New room '${payload.name}' has been created!`);
        return [...prev, payload];
      }
      return prev;
    });
  }, [addMessage]);

  const handleRoomDeleted = useCallback((payload: any) => {
    setAvailableRooms(prev => prev.filter(r => r.name !== payload.name));
    setJoinedRooms(prev => {
      const filtered = prev.filter(r => r.name !== payload.name);
      const hasLobby = filtered.some(r => r.name === 'Lobby');
      if (!hasLobby) {
        // Always ensure Lobby is in the joined rooms
        filtered.unshift({ name: 'Lobby', isPrivate: false, userCount: 1 });
      }
      return filtered;
    });
    
    // If we're currently viewing the deleted room, switch to Lobby
    if (currentViewingRoom === payload.name) {
      setCurrentViewingRoom('Lobby');
      setMessages(allRoomMessages['Lobby'] || []);
      addMessage('system', `Room '${payload.name}' was deleted. Switched to Lobby.`);
    }
  }, [currentViewingRoom, allRoomMessages, addMessage]);

  const handleUserCountUpdate = useCallback((payload: any) => {
    setAvailableRooms(prev => 
      prev.map(r => r.name === payload.name ? { ...r, userCount: payload.userCount } : r)
    );
    setJoinedRooms(prev => 
      prev.map(r => r.name === payload.name ? { ...r, userCount: payload.userCount } : r)
    );
    
    // Update current room users if it's the currently viewing room
    if (payload.name === currentViewingRoom) {
      const userCount = payload.userCount;
      if (userCount > 0) {
        // Create a user list with self and placeholder for others
        const users = [nickname];
        for (let i = 1; i < userCount; i++) {
          users.push(`User${i}`);
        }
        setCurrentRoomUsers(users);
      } else {
        setCurrentRoomUsers([]);
      }
    }
  }, [currentViewingRoom, nickname]);

  // Handle join room success
  const handleJoinRoomSuccess = useCallback((payload: any) => {
    const { roomName } = payload;
    addMessage('system', `✅ Successfully joined room: ${roomName}`);
    
    // Find the room in available rooms and add to joined rooms
    const targetRoom = availableRooms.find(r => r.name === roomName);
    if (targetRoom) {
      setJoinedRooms(prev => {
        if (!prev.some(r => r.name === targetRoom.name)) {
          console.log(`Adding room to joined list: ${roomName}`, [...prev, targetRoom]);
          return [...prev, targetRoom];
        }
        return prev;
      });
      
      // Switch to the new room
      setTimeout(() => {
        const roomHistory = allRoomMessages[roomName] || [];
        setCurrentViewingRoom(roomName);
        setMessages(roomHistory);
        setCurrentRoomUsers([nickname]);
      }, 100);
    }
  }, [availableRooms, allRoomMessages, nickname]);

  // Handle join room error
  const handleJoinRoomError = useCallback((payload: any) => {
    const { message } = payload;
    if (message.includes('password') || message.includes('incorrect')) {
      addMessage('error', '🔒 Incorrect password. Please try again.');
    } else {
      addMessage('error', `❌ Failed to join room: ${message}`);
    }
  }, [addMessage]);

  // Graceful exit handler
  const handleGracefulExit = useCallback(() => {
    addMessage('system', '👋 Goodbye! Disconnecting from chat...');
    
    // Disconnect from WebSocket
    try {
      client.disconnect();
    } catch (error) {
      // Ignore disconnect errors during exit
    }
    
    // Show goodbye message and exit after a short delay
    setTimeout(() => {
      // Clear screen and show final message
      process.stdout.write('\x1b[?1049l'); // Disable alternative screen buffer
      process.stdout.write('\x1b[2J\x1b[H'); // Clear screen
      console.log('\n👋 Thanks for using Chat CLI! See you next time!\n');
      exit();
    }, 1000);
  }, [client, addMessage, exit]);

  // Handle system signals for graceful shutdown
  useEffect(() => {
    const handleSignal = () => {
      handleGracefulExit();
    };

    process.on('SIGINT', handleSignal);
    process.on('SIGTERM', handleSignal);

    return () => {
      process.off('SIGINT', handleSignal);
      process.off('SIGTERM', handleSignal);
    };
  }, [handleGracefulExit]);

  // Global key handling for manual input
  useInput((input: string, key: any) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      handleGracefulExit();
      return;
    }

    // Handle Enter for submit
    if (key.return) {
      if (currentInput.trim()) {
        handleInputSubmit(currentInput);
      }
      setCurrentInput('');
      setIsTyping(false);
      return;
    }

    // Handle regular character input
    if (input && !key.ctrl && !key.meta && !key.escape && !key.tab && !key.return) {
      setCurrentInput(prev => prev + input);
      setIsTyping(true);
      return;
    }

    // Handle backspace
    if (key.backspace || key.delete) {
      setCurrentInput(prev => {
        const newValue = prev.slice(0, -1);
        if (newValue.length === 0) {
          setIsTyping(false);
        }
        return newValue;
      });
      return;
    }

    if (key.tab) {
      // If input starts with '/', show command hints
      if (currentInput.startsWith('/')) {
        addMessage('system', '📋 Available commands:');
        [
          { command: '/help', description: 'Show available commands' },
          { command: '/create-room', description: 'Create a new chat room' },
          { command: '/join <room>', description: 'Join a specific room' },
          { command: '/leave', description: 'Leave current room' },
          { command: '/users', description: 'List users in current room' },
          { command: '/rooms', description: 'List available rooms' },
          { command: '/clear', description: 'Clear chat history' },
          { command: '/quit', description: 'Exit the application' },
          { command: '/1, /2, /3...', description: 'Switch to joined room by number' },
        ].forEach(cmd => {
          addMessage('system', `${cmd.command} - ${cmd.description}`);
        });
        return;
      }
      // Otherwise toggle room view
      setShowJoinedRooms(prev => !prev);
      return;
    }
  });


  // Switch room function (defined before usage) - now just changes the viewing room
  const switchToRoom = useCallback((roomName: string) => {
    // Check if we're actually joined to this room
    const isJoined = joinedRooms.some(r => r.name === roomName);
    if (!isJoined) {
      addMessage('error', `You are not in room '${roomName}'. Use /join ${roomName} to join first.`);
      return;
    }
    
    // Ensure we're switching to a different room
    if (currentViewingRoom === roomName) {
      return;
    }
    
    // Load chat history for the room
    const roomHistory = allRoomMessages[roomName] || [];
    
    // Update state synchronously to ensure consistency
    setCurrentViewingRoom(roomName);
    setMessages(roomHistory);
    
    // Clear unread status for this room
    setUnreadRooms(prev => {
      const newSet = new Set(prev);
      newSet.delete(roomName);
      return newSet;
    });
    
    // Reset user list for the new room
    setCurrentRoomUsers([nickname]);

    // Add message to the NEW room (use addMessageToRoom to ensure it goes to the right room)
    addMessageToRoom(roomName, 'system', `Now viewing room: ${roomName}`);
  }, [allRoomMessages, joinedRooms, nickname, currentViewingRoom, addMessageToRoom]);

  // Handle message submission
  const handleInputSubmit = useCallback((value: string) => {
    if (!value.trim()) {
      setCurrentInput('');
      setIsTyping(false);
      return;
    }

    const trimmedValue = value.trim();
    
    // Handle commands
    if (trimmedValue.startsWith('/')) {
      const command = trimmedValue.toLowerCase();
      
      switch (command) {
        case '/help':
          addMessage('system', '📋 Available commands:');
          [
            { command: '/help', description: 'Show available commands' },
            { command: '/create-room', description: 'Create a new chat room' },
            { command: '/join <room>', description: 'Join a specific room' },
            { command: '/leave', description: 'Leave current room' },
            { command: '/users', description: 'List users in current room' },
            { command: '/rooms', description: 'List available rooms' },
            { command: '/clear', description: 'Clear chat history' },
            { command: '/quit', description: 'Exit the application' },
            { command: '/1, /2, /3...', description: 'Switch to joined room by number' },
          ].forEach(cmd => {
            addMessage('system', `${cmd.command} - ${cmd.description}`);
          });
          break;
          
        case '/create-room':
          addMessage('system', '🏠 Starting room creation process...');
          addMessage('system', 'Enter room name (or type "cancel" to abort):');
          setIsCreatingRoom(true);
          setRoomCreationStep('name');
          setPendingRoomData({});
          break;
          
        case '/users':
          const userList = currentRoomUsers.length > 0 
            ? currentRoomUsers.join(', ') 
            : 'No other users';
          addMessage('system', `👥 Users in ${currentViewingRoom}: ${userList}`);
          break;
          
        case '/rooms':
          if (availableRooms.length > 0) {
            addMessage('system', '🏠 Available rooms:');
            availableRooms.forEach(room => {
              addMessage('system', `${room.name} (${room.userCount} users) ${room.isPrivate ? '🔒' : '🌐'}`);
            });
          } else {
            addMessage('system', 'No rooms available');
          }
          break;
          
        case '/clear':
          setMessages([]);
          addMessage('system', '🧹 Chat history cleared');
          break;
          
        case '/quit':
        case '/exit':
          handleGracefulExit();
          break;
          
        case '/leave':
          if (currentViewingRoom === 'Lobby') {
            addMessage('error', 'Cannot leave the Lobby room');
          } else {
            const roomToLeave = currentViewingRoom;
            addMessage('system', `🚪 Leaving room: ${roomToLeave}`);
            // Send leave room message
            client.sendWebSocketMessage({
              type: 'LEAVE_ROOM',
              payload: { name: roomToLeave }
            });
            // Remove from joined rooms (but ensure Lobby is always present)
            setJoinedRooms(prev => {
              const filtered = prev.filter(r => r.name !== roomToLeave);
              const hasLobby = filtered.some(r => r.name === 'Lobby');
              if (!hasLobby) {
                // Always ensure Lobby is in the joined rooms
                filtered.unshift({ name: 'Lobby', isPrivate: false, userCount: 1 });
              }
              console.log(`After leaving ${roomToLeave}, joined rooms:`, filtered.map(r => r.name));
              return filtered;
            });
            // Switch to Lobby view
            switchToRoom('Lobby');
          }
          break;
          
        default:
          if (command.startsWith('/join ')) {
            const roomName = trimmedValue.substring(6).trim();
            if (roomName) {
              // Check if room exists in available rooms
              const targetRoom = availableRooms.find(r => r.name.toLowerCase() === roomName.toLowerCase());
              if (targetRoom) {
                // Check if already joined
                const alreadyJoined = joinedRooms.some(r => r.name === targetRoom.name);
                if (alreadyJoined) {
                  addMessage('system', `You are already in room '${targetRoom.name}'. Switching view...`);
                  switchToRoom(targetRoom.name);
                } else {
                  // Check if room is private
                  if (targetRoom.isPrivate) {
                    addMessage('system', `🔒 Room '${targetRoom.name}' is private. Please enter the password:`);
                    setIsJoiningRoom(true);
                    setPendingJoinRoom({ name: targetRoom.name, isPrivate: true });
                  } else {
                    // Public room - join directly
                    addMessage('system', `🚪 Joining room: ${targetRoom.name}`);
                    attemptJoinRoom(targetRoom.name, '');
                  }
                }
              } else {
                addMessage('error', `Room '${roomName}' not found. Use /rooms to see available rooms.`);
              }
            } else {
              addMessage('error', 'Usage: /join <room-name>');
            }
          } else if (command.match(/^\/[1-9]$/)) {
            // Handle room switching by number (/1, /2, /3, etc.)
            const roomNumber = parseInt(command.substring(1));
            const roomIndex = roomNumber - 1;
            
            if (roomIndex < joinedRooms.length) {
              const targetRoom = joinedRooms[roomIndex];
              if (targetRoom && targetRoom.name !== currentViewingRoom) {
                // Use a more immediate approach for room switching
                const roomHistory = allRoomMessages[targetRoom.name] || [];
                setCurrentViewingRoom(targetRoom.name);
                setMessages(roomHistory);
                setCurrentRoomUsers([nickname]);
                
                // Clear unread status for this room
                setUnreadRooms(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(targetRoom.name);
                  return newSet;
                });
                
                // Add confirmation message to the new room
                addMessageToRoom(targetRoom.name, 'system', `🔄 Switched to room: ${targetRoom.name}`);
              } else if (targetRoom && targetRoom.name === currentViewingRoom) {
                addMessage('system', `You are already viewing ${targetRoom.name}`);
              }
            } else {
              addMessage('error', `Room ${roomNumber} not found. You have ${joinedRooms.length} joined rooms.`);
            }
          } else {
            addMessage('error', `Unknown command: ${command}. Type /help for available commands.`);
          }
          break;
      }
    } else {
      // Check if we're in room creation mode
      if (isCreatingRoom && roomCreationStep) {
        handleRoomCreationInput(trimmedValue);
      } else if (isJoiningRoom && pendingJoinRoom) {
        // Handle room joining password input
        handleRoomJoinInput(trimmedValue);
      } else {
        // Regular message - ensure we're sending to the correct room
        if (!currentViewingRoom) {
          addMessage('error', 'No room selected. Cannot send message.');
          setCurrentInput('');
          setIsTyping(false);
          return;
        }
        
        // Double-check that we're actually joined to this room
        const isJoinedToCurrentRoom = joinedRooms.some(r => r.name === currentViewingRoom);
        if (!isJoinedToCurrentRoom) {
          console.log(`Current viewing room: ${currentViewingRoom}`);
          console.log(`Joined rooms:`, joinedRooms.map(r => r.name));
          addMessage('error', `You are not joined to room '${currentViewingRoom}'. Use /join to join a room first.`);
          setCurrentInput('');
          setIsTyping(false);
          return;
        }
        
        const messageData = {
          type: 'SEND_MESSAGE',
          payload: {
            roomId: currentViewingRoom,
            content: trimmedValue,
          },
        };
        
        const sent = client.sendWebSocketMessage(messageData);
        
        if (!sent) {
          addMessage('error', 'Failed to send message - connection not available');
        } else {
          // Optimistic update: immediately show the message in the UI
          addMessageToRoom(currentViewingRoom, 'own', trimmedValue, nickname);
          console.log(`Message sent to room: ${currentViewingRoom}`);
        }
      }
    }
    
    setCurrentInput('');
    setIsTyping(false);
  }, [client, currentViewingRoom, addMessage, currentRoomUsers, availableRooms, exit, switchToRoom, isCreatingRoom, roomCreationStep]);

  // Handle room creation input
  const handleRoomCreationInput = useCallback((input: string) => {
    if (input.toLowerCase() === 'cancel') {
      addMessage('system', '❌ Room creation cancelled.');
      setIsCreatingRoom(false);
      setRoomCreationStep(null);
      setPendingRoomData({});
      return;
    }

    switch (roomCreationStep) {
      case 'name':
        if (input.length < 1 || input.length > 15) {
          addMessage('error', 'Room name must be 1-15 characters long. Try again:');
          return;
        }
        if (availableRooms.some(room => room.name.toLowerCase() === input.toLowerCase())) {
          addMessage('error', `Room '${input}' already exists. Choose a different name:`);
          return;
        }
        setPendingRoomData(prev => ({ ...prev, name: input }));
        addMessage('system', `Room name set to: ${input}`);
        addMessage('system', 'Make room private? (y/n):');
        setRoomCreationStep('privacy');
        break;

      case 'privacy':
        const isPrivate = input.toLowerCase() === 'y' || input.toLowerCase() === 'yes';
        setPendingRoomData(prev => ({ ...prev, isPrivate }));
        
        if (isPrivate) {
          addMessage('system', 'Room will be private.');
          addMessage('system', 'Enter password for the room:');
          setRoomCreationStep('password');
        } else {
          addMessage('system', 'Room will be public.');
          // Create the room immediately
          const roomData = { name: pendingRoomData.name!, isPrivate: false, password: '' };
          console.log('Creating public room:', roomData); // Debug log
          createRoom(roomData);
        }
        break;

      case 'password':
        if (input.length < 1) {
          addMessage('error', 'Password cannot be empty. Try again:');
          return;
        }
        // Create the room with password
        const roomData = { name: pendingRoomData.name!, isPrivate: true, password: input };
        console.log('Creating private room:', roomData); // Debug log
        createRoom(roomData);
        break;
    }
  }, [roomCreationStep, pendingRoomData, availableRooms, addMessage]);

  // Attempt to join room function
  const attemptJoinRoom = useCallback((roomName: string, password: string) => {
    // Send join room message
    const sent = client.sendWebSocketMessage({
      type: 'JOIN_ROOM',
      payload: { 
        name: roomName,
        password: password 
      }
    });
    
    if (sent) {
      addMessage('system', `🔄 Attempting to join room: ${roomName}`);
    } else {
      addMessage('error', 'Failed to send join request - connection not available');
      // Reset joining state
      setIsJoiningRoom(false);
      setPendingJoinRoom(null);
    }
  }, [client, addMessage]);

  // Handle room join input
  const handleRoomJoinInput = useCallback((input: string) => {
    if (input.toLowerCase() === 'cancel') {
      addMessage('system', '❌ Room join cancelled.');
      setIsJoiningRoom(false);
      setPendingJoinRoom(null);
      return;
    }

    if (pendingJoinRoom) {
      const password = input.trim();
      if (password.length === 0) {
        addMessage('error', 'Password cannot be empty. Please enter the password (or type "cancel" to abort):');
        return;
      }
      
      // Attempt to join with password
      attemptJoinRoom(pendingJoinRoom.name, password);
      
      // Reset joining state
      setIsJoiningRoom(false);
      setPendingJoinRoom(null);
    }
  }, [pendingJoinRoom, addMessage, attemptJoinRoom]);

  // Create room function
  const createRoom = useCallback((roomData: { name: string, isPrivate: boolean, password: string }) => {
    addMessage('system', `🚀 Creating room '${roomData.name}'...`);
    
    // Check if connection is open
    if (!client.isConnectionOpen()) {
      addMessage('error', '❌ WebSocket connection is not open. Cannot send room creation request.');
      // Reset creation state
      setIsCreatingRoom(false);
      setRoomCreationStep(null);
      setPendingRoomData({});
      return;
    }
    
    const messageData = {
      type: 'CREATE_ROOM',
      payload: {
        name: roomData.name,
        isPrivate: roomData.isPrivate,
        password: roomData.password
      }
    };
    
    try {
      const success = client.sendWebSocketMessage(messageData);
      
      if (success) {
        addMessage('system', '✅ Room creation request sent to server.');
      } else {
        addMessage('error', '❌ Failed to send room creation request.');
      }
    } catch (error) {
      addMessage('error', `❌ Error sending room creation request: ${error}`);
    }
    
    // Reset creation state
    setIsCreatingRoom(false);
    setRoomCreationStep(null);
    setPendingRoomData({});
  }, [client, addMessage]);

  // Calculate available height for main content (total - header - input)
  // Ensure we don't exceed terminal bounds
  const headerHeight = 3;
  const inputHeight = 3;
  const availableHeight = Math.max(5, terminalHeight - headerHeight - inputHeight);
  const safeHeight = Math.min(terminalHeight, terminalHeight);

  return (
    <Box flexDirection="column" width="100%" height={safeHeight}>
      {/* Header - Fixed height with responsive text */}
      <Box 
        justifyContent="space-between" 
        paddingX={1} 
        paddingY={0} 
        borderStyle="round" 
        borderColor="cyan"
        height={headerHeight}
        flexShrink={0}
      >
        <Box flexDirection="row" alignItems="center">
          <Text bold color="cyan">
            {currentViewingRoom}
          </Text>
          <Box marginLeft={1}>
            <Text color="gray">— {nickname}</Text>
          </Box>
        </Box>
        <Box flexDirection="row" alignItems="center">
          <Text color={isConnected ? 'green' : 'red'}>
            {isConnected ? '● ' : '● '}
          </Text>
          <Box marginRight={1}>
            <Text color="gray">{showJoinedRooms ? 'Joined' : 'Available'}</Text>
          </Box>
          {terminalWidth > 60 && (
            <Text color="gray" dimColor>
              Tab: Toggle/Commands | Ctrl+C: Exit
            </Text>
          )}
        </Box>
      </Box>

      {/* Main Content Area - Fixed height to fill space exactly */}
      <Box flexDirection="row" height={availableHeight} flexShrink={0}>
        {/* Room List Panel - Responsive */}
        <ResponsiveSidebar type="room" terminalWidth={terminalWidth}>
          <RoomList 
            rooms={showJoinedRooms ? joinedRooms : availableRooms}
            currentRoom={currentViewingRoom}
            title={showJoinedRooms ? 'Joined Rooms' : 'Available Rooms'}
            unreadRooms={unreadRooms}
            onSelect={switchToRoom}
          />
        </ResponsiveSidebar>

        {/* Chat Panel - Responsive */}
        <ChatPanel 
          terminalWidth={terminalWidth}
          currentRoomId={currentViewingRoom}
          messages={messages}
          isTyping={isTyping}
          currentInput={currentInput}
          nickname={nickname}
        />

        {/* User List Panel - Responsive */}
        <ResponsiveSidebar type="user" terminalWidth={terminalWidth}>
          <UserList 
            users={currentRoomUsers}
            currentUser={nickname}
          />
        </ResponsiveSidebar>
      </Box>

      {/* Input Box - Fixed height */}
      <Box 
        height={inputHeight} 
        borderStyle="round" 
        borderColor={isCreatingRoom ? "yellow" : isJoiningRoom ? "magenta" : "cyan"}
        flexShrink={0}
      >
        <ChatInput 
          value={currentInput}
          placeholder={isCreatingRoom ? 
            (roomCreationStep === 'name' ? 'Enter room name...' :
             roomCreationStep === 'privacy' ? 'Make private? (y/n)...' :
             roomCreationStep === 'password' ? 'Enter password...' : 'Type a message...') :
            isJoiningRoom ? 'Enter room password (or type "cancel")...' :
            'Type a message...'} 
        />
      </Box>
    </Box>
  );
};

export const startInkChatInterface = (nickname: string, room: string, location: LocationInfo) => {
  // Clear entire screen and reset cursor position
  process.stdout.write('\x1b[2J\x1b[H');
  
  // Force alternative screen buffer to prevent header clipping
  process.stdout.write('\x1b[?1049h'); // Enable alternative screen buffer
  
  const cleanup = () => {
    process.stdout.write('\x1b[?1049l'); // Disable alternative screen buffer
  };
  
  // Cleanup on exit
  process.on('exit', cleanup);
  
  render(<ChatInterface nickname={nickname} room={room} location={location} />, {
    exitOnCtrlC: false,
    patchConsole: false
  });
};