# Voice Web Roadmap

This roadmap assumes we will keep `voice_web` independent from `hyprvox` for now, while selectively borrowing the strongest ideas from it.

The goal is simple:

- keep the web product fast to iterate on
- avoid premature shared-infra work
- improve quality by porting proven patterns from `hyprvox`

## Product Direction

`voice_web` should remain the browser-first transcription product.

`hyprvox` should remain the Linux daemon / CLI product.

They can share ideas and algorithms, but not a forced runtime architecture yet.

That means:

- `voice_web` owns browser recording, upload UX, transcript display, and deployment
- `hyprvox` remains the reference for merge quality, retry logic, config discipline, and STT heuristics
- code sharing is optional and delayed until duplication becomes a real maintenance cost

## Current State Summary

`voice_web` already has a strong product shell:

- simple browser recorder UX
- live waveform
- custom vocabulary input
- parallel Groq + Deepgram transcription
- LLM-based merge
- post-processing pass

But compared with `hyprvox`, it is behind in a few important areas:

- weaker merge strategy and fallback behavior
- less rigorous prompting
- less validation and observability
- no focused tests
- a few correctness bugs and stale UI pieces

## Roadmap

## Phase 0: Stabilize The Current App

Objective: make the current app correct and safe before we add sophistication.

### 0.1 Fix audio format correctness

Problem:

- browser audio is currently wrapped as `audio/wav` even though `MediaRecorder` often produces `webm/opus`
- this can cause poor decoding or intermittent provider issues

Work:

- detect the actual `MediaRecorder.mimeType`
- upload the blob with the correct filename extension and MIME type
- update the server-side content-type / suffix handling accordingly

Success criteria:

- recorded audio is uploaded with the correct type
- Groq and Deepgram receive audio in a format they actually expect

### 0.2 Fix timeout units

Problem:

- config values look like milliseconds, but request code multiplies by `1000` again

Work:

- standardize timeout units to milliseconds everywhere
- rename fields or add comments so this cannot regress

Success criteria:

- each provider request has a real, predictable timeout

### 0.3 Remove stale or drifted UI code

Problem:

- `design-lab.vue` is out of sync with the current `LiveWaveform` props

Work:

- either fix the page to match the current component API
- or remove it if it is no longer useful

Success criteria:

- no dead demo pages or mismatched component contracts

### 0.4 Clean up build reliability

Problem:

- local build currently trips over generated `.nuxt` state

Work:

- clean generated artifacts
- confirm build works from a clean checkout
- document the narrow validation command

Success criteria:

- `bun run build` is reliable in a normal clean environment

## Phase 1: Upgrade The Transcription Engine

Objective: port the best core logic from `hyprvox` into `voice_web`.

### 1.1 Improve Groq prompting

Port from `hyprvox`:

- stronger base transcription prompt
- explicit preservation of commands, filenames, acronyms, and technical terms
- dynamic boost-word prompt generation

Why:

- the current `voice_web` vocabulary prompt path is effectively stubbed
- `hyprvox` has a much better prompt baseline

### 1.2 Improve Deepgram keyterm handling

Port from `hyprvox`:

- sanitize boost words
- deduplicate terms
- enforce a clear limit
- preserve first casing when useful

Why:

- this keeps custom vocabulary reliable instead of just appending raw user input

### 1.3 Replace naive merge with gated merge strategy

Port from `hyprvox`:

- exact match short-circuit
- normalization-based short-circuit
- punctuation-only short-circuit
- minor diff gating
- single-word technical correction handling
- only call the LLM when disagreement is meaningful

Why:

- lower latency
- lower cost
- more predictable output
- fewer unnecessary LLM calls

### 1.4 Improve fallback decisions

Port from `hyprvox`:

- clearer single-source fallback rules
- more explicit rate-limit / timeout handling
- better provider failure messaging

Why:

- current fallback works, but it is not as deliberate or observable

## Phase 2: Make The App Trustworthy

Objective: make quality measurable.

### 2.1 Add unit tests for transcript merge logic

Add tests for:

- exact match handling
- punctuation-only differences
- technical-word conflicts
- list / structured dictation cues
- LLM fallback paths

This is the highest-value test surface in the app.

### 2.2 Add tests for post-processing

Add tests for:

- hallucination stripping
- grammar normalization
- punctuation mapping
- cleanup behavior

### 2.3 Add provider-level tests around orchestration

Test:

- both providers succeed
- one provider fails
- both providers fail
- non-English guardrail path

### 2.4 Add basic request diagnostics

Log:

- audio type
- file size
- provider latencies
- merge strategy used
- fallback reason

This does not need full telemetry yet. Just enough to debug real failures.

## Phase 3: Improve Product UX

Objective: make the web app feel intentional and production-ready.

### 3.1 Better processing feedback

Add:

- provider progress states
- “transcribing” vs “merging” vs “finalizing”
- clearer warning vs error messaging

### 3.2 Transcript quality affordances

Add:

- copy feedback that is more visible
- regenerate / retry button
- raw transcript inspector for debugging
- optional “show provider outputs” panel for comparison

### 3.3 Better vocabulary UX

Add:

- chips instead of only comma-separated text
- save / recent vocabulary sets
- default technical profile presets

### 3.4 Upload support

Add:

- drag-and-drop audio upload
- local file transcription in addition to live recording

This expands use cases without changing the core architecture.

## Phase 4: Production Readiness

Objective: make the app easy to maintain and deploy.

### 4.1 Stronger runtime config validation

Borrow the spirit of `hyprvox` config validation:

- validate required API keys at startup
- expose provider availability clearly in health responses
- fail fast with useful messages

### 4.2 API contract cleanup

Standardize response shape:

- `text`
- `model`
- `duration_ms`
- `merge_strategy`
- `fallback_used`
- `warnings`

### 4.3 Separate orchestration from route handlers

Refactor:

- keep API routes thin
- move provider orchestration and merge decisions into service modules

This keeps the current app independent while making later extraction easier if needed.

### 4.4 Introduce benchmark fixtures

Keep a few local audio fixtures and compare:

- provider outputs
- merge quality
- latency

This gives us a stable way to evaluate future prompt or merge changes.

## Phase 5: Optional Future Extraction

Only do this if duplication becomes painful.

Possible future move:

- extract a small shared package for merge logic and provider helpers

Do not start here.

Trigger conditions for extraction:

- repeated bug fixes in both repos
- repeated copying of prompt / merge logic
- both apps needing the same STT feature work every week

## Recommended Implementation Order

If we want the highest leverage path, do the work in this order:

1. fix MIME / audio format correctness
2. fix timeout units
3. clean build + stale UI drift
4. port Groq prompting from `hyprvox`
5. port Deepgram keyterm sanitization
6. port merge gating strategy
7. add tests for merge + post-processing
8. improve diagnostics and API response shape
9. improve UX and upload support

## Naming Direction

The current name `voice_web` is descriptive, but not product-grade.

Good naming directions:

- short
- easy to say aloud
- related to speech / transcription / prompts
- distinct from `hyprvox`, but not random

### Best Candidates

#### 1. Voxa

Why it works:

- short
- product-like
- speech-adjacent without sounding generic
- easy to brand

#### 2. Voxlet

Why it works:

- feels lightweight and web-native
- still connected to the voice/transcription space
- distinct from `hyprvox`

#### 3. Promptvox

Why it works:

- ties directly to the “voice for AI workflows” use case
- pairs well conceptually with `hyprvox`

#### 4. Voxlane

Why it works:

- sounds like a focused workflow tool
- easy to remember
- modern without being too trendy

#### 5. Speechlane

Why it works:

- clear and practical
- feels like a product for moving spoken input into work

### More Options

- Voxflow
- Speaklane
- Voxcraft
- Echotype
- Promptwave
- Saygrid
- Voiceline
- Voxbeam

## My Picks

If I were choosing for this product, I would shortlist:

1. `Voxa`
2. `Promptvox`
3. `Voxlane`

`Voxa` is the cleanest standalone product name.

`Promptvox` is the best if you want it to feel closer to the AI-agent workflow niche.

`Voxlane` is the best if you want something product-y without sounding too literal.

## Decision

Recommended strategy:

- keep `voice_web` independent
- improve it aggressively using `hyprvox` as the reference
- delay shared-core work until the pain is real

That gives the best speed-to-improvement with the least architectural drag.
