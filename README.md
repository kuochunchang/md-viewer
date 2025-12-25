# Markdown & Mermaid Viewer

A simple web application for real-time Markdown preview with Mermaid diagram support.

## ✨ Features

- **Real-time Preview** - Edit Markdown on the left, see rendered output on the right instantly
- **Mermaid Diagrams** - Full support for flowcharts, sequence diagrams, Gantt charts, and more
- **Multi-tab Interface** - Create multiple documents, drag to reorder, and manage easily
- **Batch Copy** - Copy markdown content from all open tabs to clipboard
- **PDF Export** - Download your rendered content as PDF with one click
- **Dark/Light Theme** - Toggle between display themes
- **Adjustable Font Size** - Customize font size (10-24px)
- **Auto-save** - All data is automatically saved to browser's localStorage

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### Build for Production

```bash
npm run build
```

## 📖 Usage

1. **Edit Markdown** - Type or paste Markdown in the left editor panel
2. **Manage Tabs** - Click `+` for new docs, drag tabs to reorder, double-click to rename
3. **Copy All** - Click the copy icon to copy all tabs content at once
4. **Adjust Layout** - Drag the divider to resize panels
5. **Export PDF** - Click the PDF icon to download
6. **Toggle Theme** - Click the sun/moon icon to switch themes
7. **Change Font Size** - Click the font size icon to adjust

## 💾 Data Storage

All your data (documents, settings) is stored in your browser's **localStorage**. 

> ⚠️ Clearing browser data will remove all saved content.

## 🔧 Tech Stack

- Vue 3 + TypeScript
- Vuetify 3
- Vite
- marked.js + highlight.js
- Mermaid.js

## 📝 License

MIT License
