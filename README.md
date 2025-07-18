# 💬 Chat CLI

<div align="center">
<img src="https://velog.velcdn.com/images/tastekim_/post/4bb7992d-70e9-4340-b588-559b90d7a0f8/image.png">

[![npm version](https://badge.fury.io/js/@tastekim%2Fchat-cli.svg)](https://badge.fury.io/js/@tastekim%2Fchat-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-22.14.0+-green.svg)](https://nodejs.org/)

**A Chat CLI that lets you communicate with developers from all over the world while you're at work, naturally and unobtrusively.**

*터미널로 업무중에도 눈치 안보고 자연스럽게 세상 모든 개발자와 소통할 수 있는 채팅 CLI*

[🚀 Quick Start](#🚀-quick-start) • [✨ Features](#-features) • [📖 Documentation](#-documentation) • [☕ Support](https://buymeacoffee.com/tastekim)

</div>

---

## 🌟 Overview | 개요

Chat CLI is a modern, terminal-based chat application that brings real-time communication directly to your command line. Built with TypeScript and powered by WebSocket technology, it offers a seamless and intuitive chat experience without leaving your terminal.

Chat CLI는 실시간 커뮤니케이션을 명령줄로 직접 가져오는 현대적인 터미널 기반 채팅 애플리케이션입니다. TypeScript로 구축되고 WebSocket 기술로 구동되며, 터미널을 벗어나지 않고도 원활하고 직관적인 채팅 경험을 제공합니다.

## 🚀 Quick Start | 빠른 시작

### Installation | 설치

```bash
# Install globally | 전역 설치
npm install -g @tastekim/chat-cli

# Run immediately | 즉시 실행
chat-cli
```

### Basic Usage | 기본 사용법

```bash
# Start chatting | 채팅 시작
chat-cli

# Help | 도움말
chat-cli --help
```

## ✨ Features | 기능

### 🎯 Core Features | 핵심 기능
- 💬 **Real-time messaging** | 실시간 메시징
- 🖼️ **Image sharing support** | 이미지 공유 지원
- 🏠 **Multiple chat rooms** | 다중 채팅방
- 🚀 **Custom room creation** | 커스텀 방 생성
- 👥 **Multi-user support** | 다중 사용자 지원
- 🔄 **Auto-reconnection** | 자동 재연결

### 🎨 User Experience | 사용자 경험
- 🖥️ **Beautiful terminal UI with rounded borders** | 둥근 테두리로 아름다운 터미널 UI
- ⌨️ **Intuitive keyboard shortcuts** | 직관적인 키보드 단축키
- 🎯 **Responsive layout** | 반응형 레이아웃
- 🔄 **Dynamic room switching** | 동적 방 전환

### 🛠️ Developer Features | 개발자 기능
- 🔌 **WebSocket protocol** | WebSocket 프로토콜
- 📋 **Rich command-line interface** | 풍부한 명령줄 인터페이스
- 🏷️ **TypeScript support** | 타입스크립트 지원
- 📦 **Modern ES modules** | 현대적인 ES 모듈

## 📖 Documentation | 문서

### Keyboard Shortcuts | 키보드 단축키

| Shortcut | Action | 설명 |
|----------|--------|------|
| `Ctrl + C` | Exit | 종료 |
| `Enter` | Send message | 메시지 전송 |
| `Tab` | Toggle rooms/Commands | 방 목록 토글/명령어 |
| `Backspace` | Delete character | 문자 삭제 |
| `Escape` | Exit | 종료 |

### Chat Commands | 채팅 명령어

| Command | Action | 설명 |
|---------|--------|------|
| `/help` | Show help | 도움말 표시 |
| `/create-room` | Create new room | 새 방 생성 |
| `/join <room>` | Join room | 방 참여 |
| `/leave` | Leave current room | 현재 방 나가기 |
| `/users` | List users | 사용자 목록 |
| `/rooms` | List rooms | 방 목록 |
| `/clear` | Clear chat | 채팅 기록 지우기 |
| `/quit` | Exit app | 앱 종료 |
| `/1, /2, /3...` | Switch to room | 방 번호로 전환 |

### Room Management | 방 관리

Chat CLI provides a modern, dynamic room management system:

Chat CLI는 현대적이고 동적인 방 관리 시스템을 제공합니다:

#### Starting with Lobby | 로비에서 시작
- **🏠 Lobby** - Default starting room | 기본 시작 방
- **👥 Multi-user support** - See real-time user count | 실시간 사용자 수 확인
- **🔄 Auto-reconnection** - Seamless connection management | 원활한 연결 관리

#### Room Features | 방 기능
- **🏠 Public rooms** - Open to everyone | 모든 사람에게 열린 공개 방
- **🔒 Private rooms** - Password protected | 비밀번호 보호 비공개 방
- **👥 Real-time user count** - See who's online | 실시간 온라인 사용자 수
- **🔄 Dynamic room switching** - Switch between joined rooms | 참여한 방 간 동적 전환
- **💬 Unread indicators** - Green dot for new messages | 새 메시지 알림 (녹색 점)

#### Creating Rooms | 방 생성
1. Use `/create-room` command | `/create-room` 명령어 사용
2. Enter room name (1-15 characters) | 방 이름 입력 (1-15자)
3. Choose public or private | 공개 또는 비공개 선택
4. Set password if private | 비공개인 경우 비밀번호 설정

#### Joining Rooms | 방 참여
1. Use `/join <room-name>` command | `/join <방이름>` 명령어 사용
2. Enter password if required | 필요시 비밀번호 입력
3. Switch between rooms using `/1`, `/2`, `/3`... | `/1`, `/2`, `/3`... 으로 방 전환

### Interface Layout | 인터페이스 레이아웃

Chat CLI features a responsive, three-panel layout:

Chat CLI는 반응형 3패널 레이아웃을 제공합니다:

```
┌─────────────────────────────────────────────────────────────┐
│                    🔵 Chat CLI - Room                       │
├─────────────┬─────────────────────────────┬─────────────────┤
│ 📁 Rooms    │        💬 Chat             │   👥 Users      │
│             │                            │                 │
│ 1. # Lobby  │  [Message bubbles with    │  👤 You         │
│    (5) •    │   rounded borders]         │  👥 Other       │
│             │                            │                 │
│ 2. # Room2  │  💭 typing indicator...    │                 │
│    (2)      │                            │                 │
├─────────────┼─────────────────────────────┼─────────────────┤
│             │  💬 Type a message...      │                 │
└─────────────┴─────────────────────────────┴─────────────────┘
```

#### Responsive Design | 반응형 디자인
- **Wide terminals (80+ cols)**: Full 3-panel layout | 넓은 터미널: 전체 3패널
- **Medium terminals (60-79 cols)**: 2-panel layout | 중간 터미널: 2패널
- **Small terminals (<60 cols)**: Single chat panel | 작은 터미널: 단일 채팅 패널

### Configuration | 설정

User data is automatically managed:

사용자 데이터는 자동으로 관리됩니다:

```bash
~/.chat-cli/
├── config.json     # User preferences | 사용자 설정
└── user.json       # User information | 사용자 정보
```

## 🔧 Requirements | 요구사항

- **Node.js** 22.14.0 or higher | 22.14.0 이상
- **Terminal** with color support and Unicode | 컬러 및 유니코드 지원 터미널
- **Network connection** for real-time features | 실시간 기능을 위한 네트워크 연결
- **Minimum terminal size**: 60x15 characters | 최소 터미널 크기: 60x15 문자

## 🎨 Design Features | 디자인 특징

### Modern UI Elements | 현대적인 UI 요소
- **🎨 Color-coded elements** - Intuitive color system | 직관적인 색상 시스템
- **📱 Responsive layout** - Adapts to terminal size | 터미널 크기에 맞춰 적응
- **💬 Message bubbles** - Chat-app style message display | 채팅앱 스타일 메시지 표시
- **🔵 Status indicators** - Visual connection and activity status | 시각적 연결 및 활동 상태 표시

### Typography & Icons | 타이포그래피 및 아이콘
- **📝 Consistent typography** - Clear, readable text | 일관된 타이포그래피
- **🎯 Contextual icons** - Meaningful visual cues | 의미 있는 시각적 단서
- **🌈 Gradient title** - Beautiful app branding | 아름다운 앱 브랜딩

## 🤝 Contributing | 기여하기

We welcome contributions! Please feel free to submit a Pull Request.

기여를 환영합니다! 언제든지 Pull Request를 제출해 주세요.

1. Fork the repository | 저장소 포크
2. Create your feature branch | 기능 브랜치 생성
3. Commit your changes | 변경사항 커밋
4. Push to the branch | 브랜치에 푸시
5. Open a Pull Request | Pull Request 열기

## 📄 License | 라이선스

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 📈 Version History | 버전 기록

### Latest Updates (v1.4.8+) | 최신 업데이트
- **🎨 UI/UX Improvements** | UI/UX 개선
  - Rounded borders for all UI components | 모든 UI 컴포넌트에 둥근 테두리
  - Enhanced visual consistency | 향상된 시각적 일관성
  - Better responsive design | 개선된 반응형 디자인
  
- **⚡ Performance Enhancements** | 성능 향상
  - Optimized input handling | 최적화된 입력 처리
  - Improved WebSocket management | 개선된 WebSocket 관리
  - Better memory usage | 향상된 메모리 사용량
  
- **🔧 Technical Improvements** | 기술적 개선
  - Simplified input processing | 단순화된 입력 처리
  - Enhanced error handling | 향상된 오류 처리
  - Better code organization | 개선된 코드 구조

## ☕ Support | 후원

If you find this project helpful, consider buying me a coffee! Your support helps keep this project alive and enables continuous improvements.

이 프로젝트가 도움이 되셨다면 커피 한 잔 사주세요! 여러분의 후원은 이 프로젝트를 지속시키고 지속적인 개선을 가능하게 합니다.

<div align="center">

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/tastekim)

**[☕ Buy me a coffee](https://buymeacoffee.com/tastekim)**

*Your generous support is greatly appreciated! | 여러분의 너그러운 후원에 깊이 감사드립니다!*

</div>

---

<div align="center">

**Made with ❤️ by [tastekim](https://github.com/tastekim)**

*Chat CLI - Bringing conversations to your terminal | Chat CLI - 대화를 터미널로*

</div>