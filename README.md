# 💬 Chat CLI

<div align="center">
<img src="https://velog.velcdn.com/images/tastekim_/post/be19a41c-83fb-4be5-b4c4-40e42719be37/image.png">

[![npm version](https://badge.fury.io/js/@chat-cli%2Fchat-cli.svg)](https://badge.fury.io/js/@chat-cli%2Fchat-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

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
- 🖥️ **Beautiful terminal UI** | 아름다운 터미널 UI
- 📁 **Smart file hints** | 스마트 파일 힌트
- ⌨️ **Intuitive keyboard shortcuts** | 직관적인 키보드 단축키
- 🎨 **Syntax highlighting** | 구문 강조
- 📜 **Scrollable message history** | 스크롤 가능한 메시지 기록

### 🛠️ Developer Features | 개발자 기능
- 🔌 **WebSocket protocol** | WebSocket 프로토콜
- 🔧 **Configurable server endpoints** | 구성 가능한 서버 엔드포인트
- 📋 **Command-line interface** | 명령줄 인터페이스
- 🎛️ **Environment variable support** | 환경 변수 지원

## 📖 Documentation | 문서

### Keyboard Shortcuts | 키보드 단축키

| Shortcut | Action | 설명 |
|----------|--------|------|
| `Ctrl + C` | Exit | 종료 |
| `Ctrl + F` | File selection | 파일 선택 |
| `Ctrl + H` | Help | 도움말 |
| `Ctrl + L` | Clear history | 기록 지우기 |
| `↑ ↓` | Scroll messages | 메시지 스크롤 |
| `\` | New line(fixing...) | 줄바꿈(수정중...) |
| `@` | File hints | 파일 힌트 |

### Room Options | 방 옵션

When you start `chat-cli`, you'll be presented with an interactive menu to select your chat room:

`chat-cli`를 실행하면 채팅방을 선택할 수 있는 대화형 메뉴가 표시됩니다:

- **🇰🇷 Korean Room** - For Korean conversations | 한국어 대화방
- **🇺🇸 English Room** - For English conversations | 영어 대화방  
- **🇪🇸 Spanish Room** - For Spanish conversations | 스페인어 대화방
- **🚀 Create Custom Room** - Create your own room to share with friends | 친구들과 공유할 수 있는 커스텀 방 생성

#### Creating Custom Rooms | 커스텀 방 생성

1. Select "Create Custom Room (Share to your friends!)" from the menu
2. Enter your desired room name (letters, numbers, hyphens, and underscores only)
3. Share the room name with your friends so they can join the same room

1. 메뉴에서 "Create Custom Room (Share to your friends!)" 선택
2. 원하는 방 이름 입력 (영문자, 숫자, 하이픈, 언더스코어만 사용 가능)
3. 친구들과 방 이름을 공유하여 같은 방에 참여할 수 있도록 함

### Configuration | 설정

Create a `.chat-cli` directory in your home folder for persistent settings:

홈 폴더에 `.chat-cli` 디렉토리를 생성하여 지속적인 설정을 관리하세요:

```bash
~/.chat-cli/
├── config.json     # User preferences | 사용자 설정
└── user.json       # User information | 사용자 정보
```

## 🔧 Requirements | 요구사항

- **Node.js** 22.14.0 or higher | 22.14.0 이상
- **Terminal** with color support | 컬러 지원 터미널
- **Network connection** for real-time features | 실시간 기능을 위한 네트워크 연결

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