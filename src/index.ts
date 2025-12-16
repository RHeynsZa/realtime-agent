import { WebSocketServer, WebSocket } from 'ws';
import {
  ClientPayload,
  ServerPayload,
  SessionState,
  ServerStream,
  ServerStreamEnd,
  ServerResponse,
  ServerActionSuggestion,
  ServerActionExecuted,
  ServerError,
} from './types';
import { knowledgeBase } from './knowledge_base';
import { mockLLM } from './mock_llm';
import { createLogger } from './logger';

const PORT = 8787;
const ACTION_TIMEOUT_MS = 30000; // 30 seconds

const log = createLogger('server');

let connectionCounter = 0;

function createSessionState(): SessionState {
  return {
    currentMessageId: null,
    isStreaming: false,
    isCancelled: false,
    pendingAction: null,
    confirmedActions: new Map(),
  };
}

function send(ws: WebSocket, payload: ServerPayload, sessionLog: ReturnType<typeof createLogger>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
    sessionLog.debug(`Sent ${payload.type}`, { type: payload.type });
  }
}

function generateSuggestionId(): string {
  return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function handleMessage(
  ws: WebSocket,
  state: SessionState,
  messageId: string,
  text: string,
  sessionLog: ReturnType<typeof createLogger>
): Promise<void> {
  sessionLog.info('Processing message', { messageId, textLength: text.length });
  sessionLog.debug('Message content', { text: text.slice(0, 100) });

  state.currentMessageId = messageId;
  state.isStreaming = true;
  state.isCancelled = false;

  const signal = { cancelled: false };

  try {
    const startTime = Date.now();
    const response = await mockLLM.generateResponse(text);
    sessionLog.debug('LLM response generated', {
      duration: `${Date.now() - startTime}ms`,
      citationCount: response.citations.length,
      hasAction: !!response.suggestedAction,
    });

    let fullText = '';
    let chunkCount = 0;
    for await (const chunk of mockLLM.streamResponse(response.text, signal)) {
      if (state.isCancelled) {
        signal.cancelled = true;
        sessionLog.info('Stream cancelled by client', { chunksStreamed: chunkCount });
        break;
      }

      fullText += chunk;
      chunkCount++;
      const streamMsg: ServerStream = { type: 'stream', delta: chunk };
      send(ws, streamMsg, sessionLog);
    }

    const streamEndMsg: ServerStreamEnd = {
      type: 'stream_end',
      reason: state.isCancelled ? 'cancelled' : 'done',
    };
    send(ws, streamEndMsg, sessionLog);
    sessionLog.debug('Stream completed', { reason: streamEndMsg.reason, totalChunks: chunkCount });

    const responseMsg: ServerResponse = {
      type: 'response',
      text: state.isCancelled ? fullText.trim() : response.text,
      citations: response.citations,
    };
    send(ws, responseMsg, sessionLog);

    if (!state.isCancelled && response.suggestedAction) {
      const suggestionId = generateSuggestionId();
      state.pendingAction = {
        suggestionId,
        action: response.suggestedAction.action,
        payload: response.suggestedAction.payload,
        timestamp: Date.now(),
      };

      const actionMsg: ServerActionSuggestion = {
        type: 'action_suggestion',
        suggestionId,
        action: response.suggestedAction.action,
        payload: response.suggestedAction.payload,
      };
      send(ws, actionMsg, sessionLog);
      sessionLog.info('Action suggested', { action: response.suggestedAction.action, suggestionId });
    }

    sessionLog.info('Message processed', { messageId, duration: `${Date.now() - startTime}ms` });
  } catch (error) {
    sessionLog.error('Error processing message', {
      messageId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    const errorMsg: ServerError = {
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    send(ws, errorMsg, sessionLog);
  } finally {
    state.isStreaming = false;
    state.currentMessageId = null;
  }
}

function handleCancel(state: SessionState, sessionLog: ReturnType<typeof createLogger>): void {
  if (state.isStreaming) {
    sessionLog.info('Cancel requested', { messageId: state.currentMessageId });
    state.isCancelled = true;
  } else {
    sessionLog.debug('Cancel ignored - not streaming');
  }
}

function handleConfirmAction(
  ws: WebSocket,
  state: SessionState,
  suggestionId: string,
  sessionLog: ReturnType<typeof createLogger>
): void {
  sessionLog.info('Action confirmation received', { suggestionId });
  const now = Date.now();

  const lastConfirmed = state.confirmedActions.get(suggestionId);
  if (lastConfirmed && now - lastConfirmed < ACTION_TIMEOUT_MS) {
    sessionLog.warn('Duplicate confirmation ignored (spam protection)', { suggestionId });
    const ignoredMsg: ServerActionExecuted = {
      type: 'action_executed',
      suggestionId,
      result: { ignored: true },
    };
    send(ws, ignoredMsg, sessionLog);
    return;
  }

  if (!state.pendingAction || state.pendingAction.suggestionId !== suggestionId) {
    sessionLog.warn('Invalid action confirmation', { suggestionId, hasPending: !!state.pendingAction });
    const errorMsg: ServerError = {
      type: 'error',
      message: `Invalid action: ${suggestionId}`,
    };
    send(ws, errorMsg, sessionLog);
    return;
  }

  if (now - state.pendingAction.timestamp > ACTION_TIMEOUT_MS) {
    sessionLog.warn('Action expired', { suggestionId, age: `${now - state.pendingAction.timestamp}ms` });
    const errorMsg: ServerError = {
      type: 'error',
      message: `Action expired: ${suggestionId}`,
    };
    send(ws, errorMsg, sessionLog);
    state.pendingAction = null;
    return;
  }

  const result = executeAction(state.pendingAction.action, state.pendingAction.payload, sessionLog);

  state.confirmedActions.set(suggestionId, now);

  for (const [id, timestamp] of state.confirmedActions) {
    if (now - timestamp > ACTION_TIMEOUT_MS) {
      state.confirmedActions.delete(id);
    }
  }

  const executedMsg: ServerActionExecuted = {
    type: 'action_executed',
    suggestionId,
    result,
  };
  send(ws, executedMsg, sessionLog);

  state.pendingAction = null;
}

function executeAction(
  action: string,
  payload: Record<string, unknown>,
  sessionLog: ReturnType<typeof createLogger>
): Record<string, unknown> {
  sessionLog.info('Executing action', { action });

  switch (action) {
    case 'schedule_callback':
      return {
        success: true,
        message: 'Callback scheduled',
        scheduledAt: new Date().toISOString(),
      };
    case 'send_sms':
      return {
        success: true,
        message: 'SMS sent',
        sentAt: new Date().toISOString(),
      };
    case 'create_ticket':
      const ticketId = `TICKET-${Date.now()}`;
      sessionLog.debug('Ticket created', { ticketId });
      return {
        success: true,
        message: 'Ticket created',
        ticketId,
      };
    default:
      sessionLog.warn('Unknown action type', { action });
      return { success: false, message: `Unknown action: ${action}` };
  }
}

function parseClientPayload(data: string): ClientPayload | null {
  try {
    const parsed = JSON.parse(data);

    if (parsed.type === 'message' && parsed.id && parsed.text) {
      return { type: 'message', id: parsed.id, text: parsed.text };
    }

    if (parsed.type === 'cancel') {
      return { type: 'cancel' };
    }

    if (parsed.type === 'confirm_action' && parsed.suggestionId) {
      return { type: 'confirm_action', suggestionId: parsed.suggestionId };
    }

    return null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  log.info('Starting server...');

  const startTime = Date.now();
  await knowledgeBase.load();
  log.info('Knowledge base loaded', { duration: `${Date.now() - startTime}ms` });

  const wss = new WebSocketServer({ port: PORT });
  log.info('WebSocket server started', { port: PORT });

  wss.on('connection', (ws: WebSocket) => {
    connectionCounter++;
    const sessionId = `session-${connectionCounter}`;
    const sessionLog = createLogger(sessionId);

    sessionLog.info('Client connected');

    const state = createSessionState();

    ws.on('message', async (data: Buffer) => {
      const rawData = data.toString();
      sessionLog.debug('Received message', { size: rawData.length });

      const payload = parseClientPayload(rawData);

      if (!payload) {
        sessionLog.warn('Invalid message format', { data: rawData.slice(0, 100) });
        const errorMsg: ServerError = {
          type: 'error',
          message: 'Invalid message format',
        };
        send(ws, errorMsg, sessionLog);
        return;
      }

      sessionLog.debug('Parsed payload', { type: payload.type });

      switch (payload.type) {
        case 'message':
          await handleMessage(ws, state, payload.id, payload.text, sessionLog);
          break;
        case 'cancel':
          handleCancel(state, sessionLog);
          break;
        case 'confirm_action':
          handleConfirmAction(ws, state, payload.suggestionId, sessionLog);
          break;
      }
    });

    ws.on('close', () => {
      sessionLog.info('Client disconnected');
      state.isCancelled = true;
      state.pendingAction = null;
    });

    ws.on('error', (error: Error) => {
      sessionLog.error('WebSocket error', { error: error.message });
    });
  });

  log.info('Server ready');
}

main().catch((error) => {
  log.error('Fatal error', { error: error.message });
  process.exit(1);
});
