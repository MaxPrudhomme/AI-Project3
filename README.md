## Installation

```bash
bun install
```

## Running the Game

```bash
bun dev
```

The game will start on `http://localhost:5173`

## Local LLM Setup

To use the LLM player feature, you need a local LLM server running with an OpenAI-compatible API.

### Recommended: LM Studio

1. Download and install [LM Studio](https://lmstudio.ai/)
2. Load any model (recommended GPT-OSS 20b or larger)
3. Start the local server (default: `http://localhost:1234/v1`)
4. The game will automatically detect available models

### Alternative: Ollama with OpenAI Compatibility

```bash
# Run Ollama with OpenAI API compatibility
OLLAMA_ORIGINS=* ollama serve
```

Then use the endpoint: `http://localhost:11434/v1`

### Requirements

- OpenAI-compatible `/v1/chat/completions` endpoint
- `/v1/models` endpoint for model discovery
- CORS enabled for browser access

## How to Play

- **LLM Mode**: Click "LLM Controls" in the sidebar
  - Select a model from the dropdown
  - Click "Play" for auto-play or "Step" for turn-by-turn
  - The LLM will analyze the game state and make decisions
  - Auto-play stops when you win or lose