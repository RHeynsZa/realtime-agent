import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import {
  ServerPayload,
  ServerStream,
  ServerStreamEnd,
  ServerResponse,
  ServerActionSuggestion,
  ServerActionExecuted,
  ServerError,
} from '../types';
import {
  createTestContext,
  waitForMessage,
  sendMessage,
  sendConfirmAction,
  TestContext,
  TEST_CONFIG,
} from './test-helper';

describe('WebSocket Server', () => {
  let ctx: TestContext;
  let client: WebSocket;

  beforeEach(async () => {
    ctx = await createTestContext();
    client = ctx.client;
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  describe('message handling', () => {
    it('should stream response and send final response', async () => {
      const responsePromise = waitForMessage<ServerResponse>(client, 'response');

      sendMessage(client, 'msg-1', 'What is the Basic Plan price?');

      const response = await responsePromise;
      expect(response.type).toBe('response');
      expect(response.citations.length).toBeGreaterThan(0);
    });

    it('should send stream_end with done reason', async () => {
      const streamEndPromise = waitForMessage<ServerStreamEnd>(client, 'stream_end');

      sendMessage(client, 'msg-2', 'What is the refund policy?');

      const streamEnd = await streamEndPromise;
      expect(streamEnd.reason).toBe('done');
    });

    it('should send stream chunks', async () => {
      const streamPromise = waitForMessage<ServerStream>(client, 'stream');

      sendMessage(client, 'msg-3', 'Tell me about pricing');

      const stream = await streamPromise;
      expect(stream.type).toBe('stream');
      expect(stream.delta).toBeDefined();
    });
  });

  describe('action suggestions', () => {
    it('should suggest action for "call me" messages', async () => {
      const actionPromise = waitForMessage<ServerActionSuggestion>(client, 'action_suggestion');

      sendMessage(client, 'msg-4', 'Please call me about pricing');

      const action = await actionPromise;
      expect(action.action).toBe('schedule_callback');
      expect(action.suggestionId).toBeDefined();
    });

    it('should execute action on confirm', async () => {
      const messages: ServerPayload[] = [];
      client.removeAllListeners('message');

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);

        client.on('message', (data) => {
          const msg = JSON.parse(data.toString()) as ServerPayload;
          messages.push(msg);

          // After receiving action_suggestion, send confirm
          if (msg.type === 'action_suggestion') {
            sendConfirmAction(client, (msg as ServerActionSuggestion).suggestionId);
          }

          // Resolve when we get action_executed
          if (msg.type === 'action_executed') {
            clearTimeout(timeout);
            resolve();
          }
        });

        sendMessage(client, 'msg-5', 'Please call me about the pricing plan');
      });

      const executed = messages.find(m => m.type === 'action_executed') as ServerActionExecuted;
      expect(executed).toBeDefined();
      expect(executed.result).toHaveProperty('success', true);
    });

    it('should ignore duplicate confirm within 30s', async () => {
      const messages: ServerPayload[] = [];
      let actionExecutedCount = 0;
      client.removeAllListeners('message');

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);

        client.on('message', (data) => {
          const msg = JSON.parse(data.toString()) as ServerPayload;
          messages.push(msg);

          // After receiving action_suggestion, send first confirm
          if (msg.type === 'action_suggestion') {
            const suggestionId = (msg as ServerActionSuggestion).suggestionId;
            sendConfirmAction(client, suggestionId);
          }

          // Count action_executed messages
          if (msg.type === 'action_executed') {
            actionExecutedCount++;

            if (actionExecutedCount === 1) {
              // After first execution, send second confirm (duplicate)
              const action = messages.find(m => m.type === 'action_suggestion') as ServerActionSuggestion;
              sendConfirmAction(client, action.suggestionId);
            } else if (actionExecutedCount === 2) {
              // Got both executions
              clearTimeout(timeout);
              resolve();
            }
          }
        });

        sendMessage(client, 'msg-6', 'Please call me about the pricing plan');
      });

      const executions = messages.filter(m => m.type === 'action_executed') as ServerActionExecuted[];
      expect(executions.length).toBe(2);
      expect(executions[1].result).toHaveProperty('ignored', true);
    });

    it('should error on invalid suggestion ID', async () => {
      const errorPromise = waitForMessage<ServerError>(client, 'error');

      sendConfirmAction(client, 'invalid-id');

      const error = await errorPromise;
      expect(error.message).toContain('Invalid action');
    });
  });

  describe('no sources', () => {
    it('should return no-sources response for unknown queries', async () => {
      const responsePromise = waitForMessage<ServerResponse>(client, 'response');

      sendMessage(client, 'msg-7', 'xyznonexistent123');

      const response = await responsePromise;
      expect(response.text).toContain("couldn't find");
      expect(response.citations).toEqual([]);
    });
  });
});

// Log test mode on startup
console.log(`\n[test] Running in ${TEST_CONFIG.useMockServer ? 'MOCK SERVER' : 'INTEGRATION'} mode`);
console.log(`[test] Server URL: ${TEST_CONFIG.useMockServer ? `ws://localhost:${TEST_CONFIG.mockServerPort}` : TEST_CONFIG.serverUrl}\n`);
