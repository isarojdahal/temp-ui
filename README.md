# Drishti AI - MCVRA Visualizer & UI Dashboard

This is a pure [React 19](https://react.dev) single-page application powered by [Vite](https://vite.dev) and [Tailwind CSS v4](https://tailwindcss.com), hosting the DRISHTI-AI interactive dashboard, MCVRA (Multi-Criteria Vulnerability Risk Assessment) graph visualizer, Scorecard Editor, and Climate AI Assistant.

## Features

- **Pure React 19 SPA Architecture**: High-performance client-side rendering with instant HMR powered by Vite and native ESM.
- **MCVRA Risk Graph Generator & AI Copilot**: Visualizes hierarchical risk assessment trees (Criteria, Metrics, Questions, Raster layers, and Text fields) powered by `@xyflow/react` (React Flow v12).
- **Floating "Generate Assessment Tree" Button & Copilot Chat Workflow**: Matches the exact interaction ergonomics of `integrated-tool-frontend`. Clicking the floating pill button at the bottom center opens the slide-in AI Copilot drawer and hides the button. Generation, iterative editing, node rearranging, and formula analysis are driven entirely from chatting.
- **In-Page Framework Upload with Browser Persistence**: On-page framework file selector (.xlsx, .xls, .csv, .json) in the visualizer controls sidebar. Parses rows in the browser with `xlsx`, tracks indicator counts, and caches the data in `localStorage` (`drishti_mcvra_framework_content`) so the testing workflow does not require backend model setup or file re-uploading on reload.
- **Interactive Tree Preview Dialog**: Integrated `TreePreviewModal` allows inspecting AI-generated assessment trees with zoom, pan, minimap, and node statistics badges prior to applying to the active canvas.
- **Generation Control with Stop Button**: Allows canceling / aborting active MCVRA graph generation at any time during execution via `AbortController`, preventing unnecessary backend processing and providing immediate UI feedback.
- **Survey Column Fields Mapping & Syntax Highlighting**: Supports custom survey dataset column configuration (JSON / CSV formats) with real-time JSON syntax color highlighting, auto Tab indentation, one-click Format JSON, and expandable tall editor to map assessment indicators dynamically against survey dataset fields.
- **Design System & UI/UX Aligned**: Styled using `integrated-tool-frontend`'s exact design tokens (`#E9F3F0`, `#F4F7FE`, `#FFF8EC`, `#F5F5F5`, `#FEF3C7`, `#F1CBCB`), primary brand green (`#208661`), button variants, and typography.
- **Curved Bezier Connections**: Smooth cubic Bezier edge rendering connecting assessment nodes (`CurvedEdge`) with `#208661` strokes.
- **Beautify / Auto-Layout**: One-click wand tool in graph controls (`handleBeautify`) to auto-arrange tree node positions dynamically.
- **PNG Canvas Export**: High-resolution image snapshot export (`handleExportPng` via `html-to-image`) for downloading risk maps.
- **Interactive MiniMap & Overview Navigator**: Interactive overview navigation panel with pannable viewport dragging, zoomable scroll, click-to-center coordinate navigation, direct node selection jumping, and top-left pillar type filter buttons to instantly focus criteria, metrics, questions, or raster nodes.
- **Floating AI Chat Copilot Drawer**: Slide-over AI Assistant drawer (`FloatingChatDrawer`) accessible across all views with real-time SSE streaming, Markdown rendering, RAG source inspection, `#208661` message bubbles, and quick prompt chips.
- **Scorecard Visual Editor Powered by Puck**: Comprehensive visual dashboard designer and reviewer workspace for generated MCVRA risk indicators using `@puckeditor/core`. Features:
  - Supports the 3-section scorecard architecture:
    1. **Profile**: Facility overview card, field survey attributes (`AdditionalInfo`), and geospatial boundary visualizer (`Map`).
    2. **Scores & Breakdown**: Executive summary `KpiCard`s, per-pillar breakdowns, indicator distribution `Chart`s, and detailed `Table`s.
    3. **Interpretation**: Qualitative narrative synthesizing survey observations against the risk scores, identifying key vulnerability drivers and actionable mitigation recommendations.
  - Native Puck visual drag-and-drop editor with categorized component drawers: Layout & Structure (`Grid`, `Flex`, `Spacer`), Typography (`Heading`, `Text`), Risk Data & Visuals (`KpiCard`, `Chart`, `Table`, `Map`, `AdditionalInfo`), UI Elements (`Card`, `Image`), and Media (`EmbedLink`).
  - Standard A4 page layout (`794px × 1123px`), A3 layout, and fluid full-width modes with real-time responsive styling.
  - Interactive property inspector with real-time field controls for cards, headings, text blocks, containers, map layers, and links.
  - Vega-Lite interactive chart rendering (bar charts, grouped bars, line trends, radar distributions) with responsive containers.
  - Bidirectional adapter between backend FastAPI recursive tree schema and Puck Data format with zero data loss.
  - Multi-version management with review status, semantic and structural validation, auto-drafting from active MCVRA graphs, and version history switching.
  - Seamless state persistence across tabs without re-rendering or state loss.
- **Floating "Build with AI" Button in Scorecard Page**: Center-bottom floating action button on the Puck scorecard canvas matching `integrated-tool-frontend`. Automatically hides when the chat drawer opens. Enables generating new scorecards from natural language prompts, modifying existing scorecards live in the Puck visual editor (switching canvas layout between A4, A3, and full-width, adjusting titles and risk statuses, enhancing narrative and emergency mitigation recommendations), translating dashboards into Nepali/Hindi/English, and querying vulnerability drivers.
- **Node Inspector**: Real-time parameter inspection, formula viewing, choices score mapping, and raw JSON export.
- **Centralized System & Assessment Settings**: Unified settings dialog accessible from the top navigation bar to configure global assessment metadata (`Assessment ID`, `Domain / Tenant Name`, and `User / Analyst ID`) alongside backend service hosts (`MCVRA Generator API`, `Scorecard Generator API`, `Climate Chatbot RAG API`, and service authentication tokens). Eliminates redundant inputs across individual feature pages and persists all configurations across sessions in `localStorage`.

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

### Backend Microservices & Default Ports

The frontend integrates with the Drishti AI suite running on non-conflicting 10000-series ports to avoid collision with `integrated-dastaa`:

| Microservice | Default Port | Environment Variable | Payload Specification |
|---|---|---|---|
| **MCVRA Tree Generator** | `10000` | `VITE_MCVRA_URL` | `multipart/form-data` with `file` (.xlsx/.csv/.json), `facility_type`, `assessment_type`, and `survey_file_column_names` JSON string |
| **Risk Scorecard Generator**| `10001` | `VITE_SCORECARD_URL` | `application/json` with 3-section indicator & metric payloads |
| **Climate Assistant Chatbot**| `10002` | `VITE_CHATBOT_URL` | `application/json` with SSE streaming and RAG retrieval |

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
- `@puckeditor/core` (^0.23.0): Open-source drag-and-drop visual editor engine powering the Scorecard designer.
- `lucide-react` (^1.33.0): Modern icon system.
