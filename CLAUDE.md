# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A TypeScript WebSocket server for LLM communication. The project includes a mock LLM that can be configured to produce hallucinations for testing purposes.

## Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run the server
npm start

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Development mode (watch for changes)
npm run dev
```

## Architecture

- **WebSocket Server**: Handles real-time bidirectional communication with clients
- **Mock LLM** (`src/mock_llm.ts`): Simulates LLM responses with configurable hallucination behavior
- **Knowledge Base** (`kb/`): Markdown files containing reference data (prices, policies, contact info). Citations in responses reference these files.

### Source Structure

```
src/
├── index.ts          # Entry point, WebSocket server setup
├── mock_llm.ts       # Mock LLM with hallucination config
├── knowledge_base.ts # KB retrieval and citation logic
├── guardrail.ts      # Number extraction and verification
├── types.ts          # Shared TypeScript interfaces
└── __tests__/        # Vitest tests
kb/
└── *.md              # Knowledge base markdown files
```

### Design Requirements

- **Separation of Concerns**: Distinct modules for WebSocket handling, LLM interaction, and Knowledge Base retrieval
- **Testability**: Architecture should allow unit testing guardrails without a live WebSocket connection
- **Fail-Closed**: If verification fails or is ambiguous, default to not answering rather than guessing

## Hallucination Detection

### Number Definition

A "number" is any sequence of 0-9 digits, including:
- Integers: `12`
- Decimals: `12.5`, `12,5` (`.` and `,` are equivalent)
- Percentages: `50%`
- Dates: `2025-12-12`
- Phone numbers: `+46...`

### Core Rule

**If a number exists in the final response, the exact token (normalized) must occur in at least one cited snippet.**

Normalization: decimal separators are interchangeable (`12.5` == `12,5`).

### Citation Format

- `snippet`: 1-3 lines of context containing the supporting text (including numbers)
- `file`: Path to the KB file

### Edge Cases

| Scenario | Response |
|----------|----------|
| Retrieval returns 0 sources | "I couldn't find any references to this in the knowledge base" |
| Number rule violated (hallucination) | "I cannot verify that" + show top-hit citations (number won't be in them) |

## WebSocket Protocol

### Client → Server

| Type | Fields | Description |
|------|--------|-------------|
| `message` | `id: string, text: string` | Send a message to the LLM |
| `cancel` | - | Cancel the current streaming response |
| `confirm_action` | `suggestionId: string` | Confirm a suggested action |

### Server → Client

| Type | Fields | Description |
|------|--------|-------------|
| `stream` | `delta: string` | Streaming response chunk |
| `stream_end` | `reason: "done" \| "cancelled"` | End of stream |
| `response` | `text: string, citations: Array<{ file, snippet }>` | Full response with citations |
| `action_suggestion` | `suggestionId: string, action: string, payload: any` | Suggested action |
| `action_executed` | `suggestionId: string, result: any` | Action execution result |

### Actions

| Action | Trigger |
|--------|---------|
| `schedule_callback` | "call me", "call person" |
| `send_sms` | SMS-related requests |
| `create_ticket` | Ticket-related requests |

### Spam Protection

Duplicate `confirm_action` for the same `suggestionId` within 30 seconds is ignored, and just returns:
```json
{ "type": "action_executed", "suggestionId": "...", "result": { "ignored": true } }
```

### Message Flow

1. Client sends `message`
2. Server streams response via multiple `stream` messages
3. Server sends `stream_end` (reason: "done" or "cancelled" if client sent `cancel`)
4. Server sends `response` with full text and citations
5. Optionally, server sends `action_suggestion`
6. If client sends `confirm_action`, server responds with `action_executed`

### Edge Cases

- Cancellation during complex operations (action executing, awaiting confirmation) must not leave orphaned state
- Clear error messaging when responses are blocked (e.g., "Verification failed: Number mismatch")
- Actions and confirmations expire after the 30s idempotency window
