# Realtime Agent

A TypeScript WebSocket server for LLM communication with hallucination detection guardrails.

## Quick Start

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

The server runs on port 8787 by default.

## Testing

The test suite supports two modes:

### Integration Tests (Default)

By default, tests connect to an existing WebSocket server. This is useful for testing against the real server implementation.

```bash
# Start the server in one terminal
npm start

# Run tests in another terminal
npm test
```

If the server isn't running, tests will fail with a connection error.

### Unit Tests (Mock Server)

To run tests without a running server, use the mock server mode:

```bash
# Run tests with mock server
USE_MOCK_SERVER=true npm test

# Watch mode with mock server
USE_MOCK_SERVER=true npm run test:watch
```

### Custom Server URL

You can specify a custom server URL for integration tests:

```bash
TEST_SERVER_URL=ws://my-server:9000 npm test
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TEST_SERVER_URL` | `ws://localhost:8787` | WebSocket server URL for integration tests |
| `USE_MOCK_SERVER` | `false` | Set to `true` to use an in-memory mock server |
| `LOG_LEVEL` | `debug` | Logging level (`debug`, `info`, `warn`, `error`) |

### Test Files

- `server.test.ts` - WebSocket server integration/unit tests
- `knowledge_base.test.ts` - Knowledge base search and query rewriting tests
- `guardrail.test.ts` - Number extraction and verification tests
- `mock_llm.test.ts` - Mock LLM response generation tests

## Development

```bash
# Development mode with watch
npm run dev

# Run tests in watch mode
npm run test:watch

# Run tests with mock server in watch mode
USE_MOCK_SERVER=true npm run test:watch
```

## Architecture

```
src/
├── index.ts          # WebSocket server entry point
├── mock_llm.ts       # Mock LLM with streaming responses
├── knowledge_base.ts # KB search with synonym expansion
├── guardrail.ts      # Number verification guardrails
├── logger.ts         # Structured logging utility
├── types.ts          # TypeScript interfaces
└── __tests__/
    ├── test-helper.ts        # Test utilities and mock server
    ├── server.test.ts        # Server integration tests
    ├── knowledge_base.test.ts
    ├── guardrail.test.ts
    └── mock_llm.test.ts
kb/
└── *.md              # Knowledge base markdown files
```

## WebSocket Protocol

### Client Messages

```typescript
// Send a message
{ "type": "message", "id": "msg-123", "text": "What is the price?" }

// Cancel current stream
{ "type": "cancel" }

// Confirm an action
{ "type": "confirm_action", "suggestionId": "action_123" }
```

### Server Messages

```typescript
// Streaming chunk
{ "type": "stream", "delta": "Based on " }

// Stream complete
{ "type": "stream_end", "reason": "done" | "cancelled" }

// Full response with citations
{
  "type": "response",
  "text": "The Basic Plan costs $9.99/month",
  "citations": [{ "file": "kb/prices.md", "snippet": "..." }]
}

// Suggested action
{
  "type": "action_suggestion",
  "suggestionId": "action_123",
  "action": "schedule_callback",
  "payload": { ... }
}

// Action executed
{ "type": "action_executed", "suggestionId": "action_123", "result": { ... } }

// Error
{ "type": "error", "message": "Invalid action" }
```

## Guardrails

The server verifies that all numbers in responses are backed by knowledge base citations. If a number cannot be verified, the response is blocked and replaced with a warning message.

Numbers include:
- Integers and decimals: `12`, `12.5`, `12,5`
- Percentages: `50%`
- Dates: `2025-12-12`
- Phone numbers: `+1-555-123-4567`

## License

MIT
