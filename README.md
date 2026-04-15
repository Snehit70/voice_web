# Voice Web

AI-powered speech-to-text transcription with dual STT engines and intelligent merging.

## Features

- **Dual STT Engine Architecture** - Runs Groq (Whisper Large V3) and Deepgram (Nova-3) in parallel
- **LLM-Powered Merging** - Combines the accuracy of Whisper with Deepgram's formatting intelligence
- **Real-time Audio Visualization** - Live waveform display during recording
- **Custom Vocabulary** - Boost recognition of domain-specific terms and names
- **Smart Post-processing** - Grammar fixes, hallucination filtering, punctuation normalization
- **Non-English Detection** - Guards against non-English audio with clear user feedback

## Architecture

### System Overview

```mermaid
flowchart TB
    subgraph Client["Browser"]
        UI[AudioRecorder.vue]
        REC[useRecorder Composable]
        VIS[LiveWaveform]
    end

    subgraph Server["Nitro Server"]
        API["/api/transcribe"]
        TR[Transcriber]
        PP[Post-processor]
    end

    subgraph STT["STT Engines"]
        GROQ[Groq/Whisper]
        DG[Deepgram/Nova-3]
    end

    subgraph LLM["LLM Service"]
        MERGE[Transcript Merger]
    end

    UI --> REC
    REC --> VIS
    REC -->|"POST audio/wav"| API
    API --> TR
    TR -->|parallel| GROQ
    TR -->|parallel| DG
    GROQ --> MERGE
    DG --> MERGE
    MERGE --> PP
    PP -->|"JSON response"| REC
```

### Component Hierarchy

```mermaid
graph TD
    subgraph Pages
        INDEX[pages/index.vue]
        DESIGN[pages/design-lab.vue]
    end

    subgraph Components
        AR[AudioRecorder.vue]
        LW[LiveWaveform.vue]
        ST[StreamingText.vue]
        SH[ShimmeringText.vue]
        TOAST[Toast.vue]
    end

    subgraph Composables
        UR[useRecorder.ts]
        UT[useToast.ts]
    end

    INDEX --> AR
    INDEX --> SH
    AR --> LW
    AR --> ST
    AR --> UR
    UR --> UT
```

### Server Architecture

```mermaid
graph LR
    subgraph API["API Layer"]
        TRANS[transcribe.post.ts]
        HEALTH[health.get.ts]
    end

    subgraph Services["Service Layer"]
        T[Transcriber]
        LLM[LLMService]
    end

    subgraph Providers["Provider Layer"]
        GROQ[GroqTranscriber]
        DG[DeepgramTranscriber]
    end

    subgraph Utils["Utilities"]
        CFG[config.ts]
        PP[postprocess.ts]
        VOC[vocabulary.ts]
    end

    TRANS --> T
    T --> LLM
    T --> GROQ
    T --> DG
    GROQ --> CFG
    DG --> CFG
    LLM --> CFG
    T --> PP
    GROQ --> VOC
```

### Transcription Flow

```mermaid
sequenceDiagram
    participant Browser
    participant API as /api/transcribe
    participant Transcriber
    participant Groq as Groq/Whisper
    participant Deepgram as Deepgram/Nova-3
    participant LLM as LLM Merger
    participant PP as Post-processor

    Browser->>API: POST audio file + keywords
    API->>Transcriber: transcribeWithFallback(keywords)
    
    par Parallel STT
        Transcriber->>Groq: transcribe(keywords)
        Transcriber->>Deepgram: transcribe(keywords)
    end

    Groq-->>Transcriber: text (verbatim accuracy)
    Deepgram-->>Transcriber: text (formatting quality)

    alt Both engines succeed
        alt Resolve locally (exact / formatting-only / minor diff)
            Transcriber->>Transcriber: deterministic merge gate
        else Needs semantic conflict resolution
            Transcriber->>LLM: mergeTranscripts()
            LLM-->>Transcriber: merged text
        end
    else One engine fails
        Transcriber->>Transcriber: use longest result
    end

    Transcriber->>PP: process()
    PP-->>Transcriber: cleaned text
    Transcriber-->>API: { text, model, merge_strategy, duration_ms }
    API-->>Browser: JSON response
```

### Data Flow

```mermaid
flowchart LR
    subgraph Input
        MIC[Microphone]
        BLOB[Audio Blob]
    end

    subgraph Processing
        GROQ_OUT[Groq Output<br/>High word accuracy]
        DG_OUT[Deepgram Output<br/>Better formatting]
        MERGED[LLM Merged]
    end

    subgraph PostProcess
        HALL[Strip Hallucinations]
        GRAM[Grammar Fixes]
        PUNCT[Punctuation]
        CLEAN[Cleanup]
    end

    subgraph Output
        TEXT[Final Transcript]
    end

    MIC --> BLOB
    BLOB --> GROQ_OUT
    BLOB --> DG_OUT
    GROQ_OUT --> MERGED
    DG_OUT --> MERGED
    MERGED --> HALL
    HALL --> GRAM
    GRAM --> PUNCT
    PUNCT --> CLEAN
    CLEAN --> TEXT
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Nuxt 3 |
| Frontend | Vue 3 Composition API |
| Styling | Tailwind CSS |
| Server | Nitro |
| STT Engine 1 | Groq (Whisper Large V3) |
| STT Engine 2 | Deepgram (Nova-3) |
| LLM | Groq (Llama 3.3 70B) |
| Deployment | Vercel |
| Package Manager | Bun |

## API Reference

### POST /api/transcribe

Transcribe an audio file using dual STT engines.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file` (required): Audio file (wav, mp3, webm, ogg)
  - `keywords` (optional): JSON array of boost words

**Response:**
```json
{
  "text": "Transcribed text content",
  "model": "merged | groq:whisper-large-v3 | deepgram:nova-3",
  "duration_ms": 1234,
  "llm_improved": true,
  "merge_strategy": "llm | llm_fallback | exact_match | normalized_match | formatting_only | minor_diff | single_word_match | single_provider",
  "merge_reason": "llm_succeeded | llm_error_fallback | provider_fallback | ...",
  "fallback_used": false,
  "warnings": []
}
```

**Error Responses:**
- `400` - No file uploaded
- `422` - Non-English audio detected
- `500` - Transcription failed
- `503` - Transcriber not initialized

### GET /api/health

Health check endpoint.

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Groq API key for Whisper and LLM |
| `DEEPGRAM_API_KEY` | Yes | Deepgram API key for Nova-3 |

### Runtime Config

Configuration is managed in `server/utils/config.ts`:

```typescript
{
  groq: {
    enabled: true,
    model: 'whisper-large-v3',
    timeoutMs: 30000
  },
  deepgram: {
    enabled: true,
    model: 'nova-3',
    timeoutMs: 30000
  },
  llm: {
    enabled: true,
    model: 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1',
    timeoutMs: 30000
  }
}
```

## Setup

### Prerequisites

- Node.js 18+ or Bun
- Groq API key
- Deepgram API key

### Installation

```bash
# Clone repository
git clone <repo-url>
cd voice_web

# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env with your API keys
```

### Development

```bash
bun run dev
```

### Production Build

```bash
bun run build
bun run preview
```

### Deploy to Vercel

```bash
vercel
```

## Project Structure

```
voice_web/
├── app.vue                    # Root component
├── nuxt.config.ts             # Nuxt configuration
├── pages/
│   ├── index.vue              # Main transcription page
│   └── design-lab.vue         # UI component playground
├── components/
│   ├── AudioRecorder.vue      # Recording UI & controls
│   ├── LiveWaveform.vue       # Real-time audio visualization
│   ├── StreamingText.vue      # Text display with typing effect
│   ├── ShimmeringText.vue     # Animated tagline
│   └── Toast.vue              # Notification component
├── composables/
│   ├── useRecorder.ts         # Recording & upload logic
│   └── useToast.ts            # Toast state management
├── server/
│   ├── api/
│   │   ├── transcribe.post.ts # Main transcription endpoint
│   │   └── health.get.ts      # Health check
│   └── utils/
│       ├── config.ts          # Configuration management
│       ├── transcribe.ts      # Transcriber orchestrator
│       ├── groq.ts            # Groq/Whisper integration
│       ├── deepgram.ts        # Deepgram/Nova-3 integration
│       ├── llm.ts             # LLM service (merging, improvement)
│       ├── postprocess.ts     # Text cleanup utilities
│       └── vocabulary.ts      # Custom vocabulary prompts
├── assets/
│   └── css/main.css           # Global styles
└── public/
    ├── favicon.svg
    └── logo.svg
```

## How It Works

### Dual Engine Strategy

Voice Web uses two STT engines with complementary strengths:

1. **Groq/Whisper** - Excellent word-level accuracy, especially for technical terms
2. **Deepgram/Nova-3** - Superior punctuation, formatting, and number handling

Both run in parallel. When both succeed, an LLM merges the results:
- Uses Whisper's words for content accuracy
- Uses Deepgram's formatting for punctuation and structure
- Removes self-corrections and filler words

### Post-processing Pipeline

1. **Hallucination Filtering** - Removes common Whisper hallucinations ("Thank you for watching", etc.)
2. **Grammar Fixes** - Fixes contractions, capitalizes proper nouns
3. **Punctuation Mapping** - Converts spoken punctuation ("new line" → `\n`)
4. **Smart Cleanup** - Normalizes spacing, capitalizes sentence starts

### Custom Vocabulary

Users can boost specific terms via the settings modal. These are:
- Sent to Deepgram as `keyterm` parameters
- Prioritized for domain-specific recognition (names, products, technical terms)

## License

MIT
