# 🃏 Poker Planner

A modern, peer-to-peer (P2P) agile estimation tool designed for remote teams who value privacy, speed, and a premium user experience. No servers, no registration, just pure peer-to-peer planning.

## ✨ Features

- **🚀 Serverless P2P**: Uses WebRTC (via PeerJS) for direct browser-to-browser communication. Your data never touches a backend.
- **💎 Glassmorphism UI**: A stunning, modern interface with vibrant animated backgrounds and sleek translucent panels.
- **📊 Real-time Statistics**: Automatically calculates Mean and Standard Deviation once votes are revealed.
- **🛠️ Host Controls**: 
  - **Force Reveal**: Reveal all votes instantly.
  - **Reset**: Start a new round with a single click.
  - **Sort**: Organize revealed votes for better clarity.
- **📱 Responsive Design**: Works seamlessly on desktops, tablets, and mobile devices.
- **⚡ Fast & Lightweight**: Zero dependencies other than PeerJS, ensuring near-instant load times.

## 🛠️ Technology Stack

- **HTML5 & CSS3**: Custom styles with advanced CSS animations and layout patterns.
- **Vanilla JavaScript**: Robust state management and application logic.
- **PeerJS**: Simplified WebRTC implementation for peer discovery and data channels.
- **Google Fonts**: Custom typography using the "Outfit" font family.

## 🚀 Getting Started

### Hosting a Room
1. Visit the project page (or open `index.html` locally).
2. Enter your **Display Name**.
3. Click **Create Room**.
4. Share the **Room ID** with your team.

### Joining a Room
1. Enter your **Display Name**.
2. Paste the **Room ID** provided by the host.
3. Click **Join Room**.

## 📖 How it Works

1. **Voting**: Each participant selects a card from their deck. Votes are hidden until everyone has voted or the host forces a reveal.
2. **Revealing**: Once revealed, the statistics panel appears, showing the mean and standard deviation of the current round.
3. **Resetting**: The host can reset the room to clear all votes and start a fresh estimation round.

## 🔒 Privacy & Security

Poker Planner is built with privacy in mind. Because it uses **WebRTC**, communication happens directly between peers. There is no central server storing your votes, names, or room activity.

---

Built with ❤️ for agile teams.
