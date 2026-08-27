# Drishti AI - MCVRA Visualizer & UI Dashboard

This is a [Next.js](https://nextjs.org) application powering the DRISHTI-AI interactive dashboard, MCVRA (Multi-Criteria Vulnerability Risk Assessment) graph visualizer, and Climate AI Assistant.

## Features

- **MCVRA Risk Graph Generator**: Visualizes hierarchical risk assessment trees (Criteria, Metrics, Questions, Raster layers) powered by `@xyflow/react` (React Flow v12).
- **Design System & UI/UX Aligned**: Styled using `integrated-tool-frontend`'s exact design tokens (`#E9F3F0`, `#F4F7FE`, `#FFF8EC`, `#F5F5F5`, `#FEF3C7`, `#F1CBCB`), primary brand green (`#208661`), button variants, and typography.
- **Curved Bezier Connections**: Smooth cubic Bezier edge rendering connecting assessment nodes (`CurvedEdge`) with `#208661` strokes.
- **Beautify / Auto-Layout**: One-click wand tool in graph controls (`handleBeautify`) to auto-arrange tree node positions dynamically.
- **PNG Canvas Export**: High-resolution image snapshot export (`handleExportPng` via `html-to-image`) for downloading risk maps.
- **Interactive MiniMap Toggle**: Show/hide mini-map overlay directly from canvas control panel.
- **Floating AI Chat Copilot Drawer**: Slide-over AI Assistant drawer (`FloatingChatDrawer`) accessible across all views with real-time SSE streaming, Markdown rendering, RAG source inspection, `#208661` message bubbles, and quick prompt chips.
- **Node Inspector**: Real-time parameter inspection, formula viewing, choices score mapping, and raw JSON export.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3001](http://localhost:3001) with your browser to view the application.

## Key Dependencies

- `@xyflow/react` (^12.11.3): Core graph canvas engine.
- `html-to-image` (^1.11.11): Canvas export snapshot engine.
- `react-markdown` (^10.1.0): Markdown renderer for streaming chat responses.
- `lucide-react`: Modern icon system.
