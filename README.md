# Drishti AI - MCVRA Visualizer & UI Dashboard

This is a pure [React 19](https://react.dev) single-page application powered by [Vite](https://vite.dev) and [Tailwind CSS v4](https://tailwindcss.com), hosting the DRISHTI-AI interactive dashboard, MCVRA (Multi-Criteria Vulnerability Risk Assessment) graph visualizer, Scorecard Editor, and Climate AI Assistant.

## Features

- **Pure React 19 SPA Architecture**: High-performance client-side rendering with instant HMR powered by Vite and native ESM.
- **MCVRA Risk Graph Generator**: Visualizes hierarchical risk assessment trees (Criteria, Metrics, Questions, Raster layers, and Text fields) powered by `@xyflow/react` (React Flow v12).
- **Generation Control with Stop Button**: Allows canceling / aborting active MCVRA graph generation at any time during execution via `AbortController`, preventing unnecessary backend processing and providing immediate UI feedback.
- **Survey Column Fields Mapping & Syntax Highlighting**: Supports custom survey dataset column configuration (JSON / CSV formats) with real-time JSON syntax color highlighting, auto Tab indentation, one-click Format JSON, and expandable tall editor to map assessment indicators dynamically against survey dataset fields.
- **Design System & UI/UX Aligned**: Styled using `integrated-tool-frontend`'s exact design tokens (`#E9F3F0`, `#F4F7FE`, `#FFF8EC`, `#F5F5F5`, `#FEF3C7`, `#F1CBCB`), primary brand green (`#208661`), button variants, and typography.
- **Curved Bezier Connections**: Smooth cubic Bezier edge rendering connecting assessment nodes (`CurvedEdge`) with `#208661` strokes.
- **Beautify / Auto-Layout**: One-click wand tool in graph controls (`handleBeautify`) to auto-arrange tree node positions dynamically.
- **PNG Canvas Export**: High-resolution image snapshot export (`handleExportPng` via `html-to-image`) for downloading risk maps.
- **Interactive MiniMap & Overview Navigator**: Interactive overview navigation panel with pannable viewport dragging, zoomable scroll, click-to-center coordinate navigation, direct node selection jumping, and top-left pillar type filter buttons to instantly focus criteria, metrics, questions, or raster nodes.
- **MCVRA Graph Copilot Drawer**: Interactive conversational assistant (`McvraChatDrawer`) integrated directly with the active MCVRA graph to re-arrange node positions in real-time, inspect calculation formulas, trace attached components and children, and summarize graph statistics.
- **Floating AI Chat Copilot Drawer**: Slide-over AI Assistant drawer (`FloatingChatDrawer`) accessible across all views with real-time SSE streaming, Markdown rendering, RAG source inspection, `#208661` message bubbles, and quick prompt chips.
- **Scorecard Editor & Visualization**: Comprehensive visual dashboard designer and reviewer workspace for generated MCVRA risk indicators. Features:
  - Drag-and-drop component palette (Containers, KPI Cards, Charts, Tables, Headings, Text, Embed Links, and Images).
  - Vega-Lite interactive chart rendering (bar charts, line trends, scatter plots, distributions) with responsive containers.
  - Live Inspector property editing for cards, chart specifications, column formatting, and container flex/grid layouts.
  - Multi-version management with review status, semantic and structural validation, auto-drafting from active MCVRA graphs, and version history switching.
  - Seamless state persistence across tabs without re-rendering or state loss.
- **Node Inspector**: Real-time parameter inspection, formula viewing, choices score mapping, and raw JSON export.

## Getting Started

First, install dependencies and run the development server:

```bash
pnpm install
pnpm dev
# or
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) with your browser to view the application.

### Building for Production

```bash
pnpm build
# Preview production build locally
pnpm preview
```

## Key Dependencies

- `react` (^19.2.8) & `react-dom` (^19.2.8): Core React UI engine.
- `vite` (^8.3.0) & `@vitejs/plugin-react`: Next-generation frontend tooling and bundler.
- `@tailwindcss/vite` (^4.3.3): Tailwind CSS v4 native Vite integration.
- `@xyflow/react` (^12.11.3): Core graph canvas engine.
- `vega` (^6.4.0), `vega-embed` (^7.2.0), `vega-lite` (^6.4.3): High-performance declarative chart visualization engine.
- `html-to-image` (^1.11.13): Canvas export snapshot engine.
- `react-markdown` (^10.1.0): Markdown renderer for streaming chat responses.
- `lucide-react` (^1.33.0): Modern icon system.
