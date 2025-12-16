import { WebSocketServer, WebSocket } from 'ws';
import { ClientPayload, ServerPayload, SessionState } from '../types';
import { knowledgeBase } from '../knowledge_base';
import { mockLLM } from '../mock_llm';

/**
 * Test configuration
 *
 * By default, tests connect to an existing server at ws://localhost:8787 (integration test mode).
 *
 * Environment variables:
 * - TEST_SERVER_URL: Override the server URL (default: ws://localhost:8787)
 * - USE_MOCK_SERVER: Set to "true" to spin up a mock server for unit testing
 */
export const TEST_CONFIG = {
  serverUrl: process.env.TEST_SERVER_URL || 'ws://localhost:8787',
  useMockServer: process.env.USE_MOCK_SERVER === 'true',
  mockServerPort: 8788,
};

const ACTION_TIMEOUT_MS = 30000;

// Mock server implementation for unit tests
function createSessionState(): SessionState {
  return {
    currentMessageId: null,
    isStreaming: false,
    isCancelled: false,
    pendingAction: null,
    confirmedActions: new Map(),
  };
}

function send(ws: WebSocket, payload: ServerPayload): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function generateSuggestionId(): string {
  return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function handleMessage(
  ws: WebSocket,
  state: SessionState,
  messageId: string,
  text: string
): Promise<void> {
  state.currentMessageId = messageId;
  state.isStreaming = true;
  state.isCancelled = false;

  const signal = { cancelled: false };

  try {
    const response = await mockLLM.generateResponse(text);
    let fullText = '';

    for await (const chunk of mockLLM.streamResponse(response.text, signal)) {
      if (state.isCancelled) {
        signal.cancelled = true;
        break;
      }
      fullText += chunk;
      send(ws, { type: 'stream', delta: chunk });
    }

    send(ws, {
      type: 'stream_end',
      reason: state.isCancelled ? 'cancelled' : 'done',
    });

    send(ws, {
      type: 'response',
      text: state.isCancelled ? fullText.trim() : response.text,
      citations: response.citations,
    });

    if (!state.isCancelled && response.suggestedAction) {
      const suggestionId = generateSuggestionId();
      state.pendingAction = {
        suggestionId,
        action: response.suggestedAction.action,
        payload: response.suggestedAction.payload,
        timestamp: Date.now(),
      };

      send(ws, {
        type: 'action_suggestion',
        suggestionId,
        action: response.suggestedAction.action,
        payload: response.suggestedAction.payload,
      });
    }
  } catch (error) {
    send(ws, {
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    state.isStreaming = false;
    state.currentMessageId = null;
  }
}

function handleCancel(state: SessionState): void {
  if (state.isStreaming) {
    state.isCancelled = true;
  }
}

function handleConfirmAction(
  ws: WebSocket,
  state: SessionState,
  suggestionId: string
): void {
  const now = Date.now();

  const lastConfirmed = state.confirmedActions.get(suggestionId);
  if (lastConfirmed && now - lastConfirmed < ACTION_TIMEOUT_MS) {
    send(ws, {
      type: 'action_executed',
      suggestionId,
      result: { ignored: true },
    });
    return;
  }

  if (!state.pendingAction || state.pendingAction.suggestionId !== suggestionId) {
    send(ws, { type: 'error', message: `Invalid action: ${suggestionId}` });
    return;
  }

  if (now - state.pendingAction.timestamp > ACTION_TIMEOUT_MS) {
    send(ws, { type: 'error', message: `Action expired: ${suggestionId}` });
    state.pendingAction = null;
    return;
  }

  const result = {
    success: true,
    action: state.pendingAction.action,
    executedAt: new Date().toISOString(),
  };

  state.confirmedActions.set(suggestionId, now);
  send(ws, { type: 'action_executed', suggestionId, result });
  state.pendingAction = null;
}

export interface TestContext {
  client: WebSocket;
  cleanup: () => Promise<void>;
}

/**
 * Create a test context with a WebSocket client.
 * In integration mode (default), connects to the running server.
 * In mock mode (USE_MOCK_SERVER=true), spins up a test server.
 */
export async function createTestContext(): Promise<TestContext> {
  if (TEST_CONFIG.useMockServer) {
    return createMockServerContext();
  }
  return createIntegrationContext();
}

async function createIntegrationContext(): Promise<TestContext> {
  const client = new WebSocket(TEST_CONFIG.serverUrl);

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Failed to connect to server at ${TEST_CONFIG.serverUrl}. Is the server running?`));
    }, 5000);

    client.on('open', () => {
      clearTimeout(timeout);
      resolve();
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Connection error: ${err.message}. Is the server running at ${TEST_CONFIG.serverUrl}?`));
    });
  });

  return {
    client,
    cleanup: async () => {
      client.close();
      await new Promise<void>((resolve) => {
        client.on('close', () => resolve());
        // If already closed, resolve immediately
        if (client.readyState === WebSocket.CLOSED) resolve();
      });
    },
  };
}

async function createMockServerContext(): Promise<TestContext> {
  await knowledgeBase.load();
  mockLLM.setConfig({ streamDelayMs: 0 });

  const serverState = createSessionState();
  const wss = new WebSocketServer({ port: TEST_CONFIG.mockServerPort });

  wss.on('connection', (ws) => {
    ws.on('message', async (data) => {
      const payload = JSON.parse(data.toString()) as ClientPayload;

      switch (payload.type) {
        case 'message':
          await handleMessage(ws, serverState, payload.id, payload.text);
          break;
        case 'cancel':
          handleCancel(serverState);
          break;
        case 'confirm_action':
          handleConfirmAction(ws, serverState, payload.suggestionId);
          break;
      }
    });
  });

  const client = new WebSocket(`ws://localhost:${TEST_CONFIG.mockServerPort}`);

  await new Promise<void>((resolve) => {
    client.on('open', resolve);
  });

  return {
    client,
    cleanup: async () => {
      client.close();
      await new Promise<void>((resolve) => {
        wss.close(() => resolve());
      });
    },
  };
}

/**
 * Wait for a specific message type from the server.
 */
export function waitForMessage<T extends ServerPayload>(
  client: WebSocket,
  type: T['type'],
  timeout = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.removeAllListeners('message');
      reject(new Error(`Timeout waiting for message type: ${type}`));
    }, timeout);

    const handler = (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as ServerPayload;
      if (msg.type === type) {
        clearTimeout(timer);
        client.removeAllListeners('message');
        resolve(msg as T);
      }
    };

    client.removeAllListeners('message');
    client.on('message', handler);
  });
}

/**
 * Collect a specific number of messages from the server.
 */
export function collectMessages(
  client: WebSocket,
  count: number,
  timeout = 5000
): Promise<ServerPayload[]> {
  return new Promise((resolve, reject) => {
    const messages: ServerPayload[] = [];
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${count} messages, got ${messages.length}`));
    }, timeout);

    client.on('message', (data) => {
      messages.push(JSON.parse(data.toString()));
      if (messages.length >= count) {
        clearTimeout(timer);
        resolve(messages);
      }
    });
  });
}

/**
 * Send a message to the server.
 */
export function sendMessage(client: WebSocket, id: string, text: string): void {
  client.send(JSON.stringify({ type: 'message', id, text }));
}

/**
 * Send a cancel request to the server.
 */
export function sendCancel(client: WebSocket): void {
  client.send(JSON.stringify({ type: 'cancel' }));
}

/**
 * Send an action confirmation to the server.
 */
export function sendConfirmAction(client: WebSocket, suggestionId: string): void {
  client.send(JSON.stringify({ type: 'confirm_action', suggestionId }));
}
