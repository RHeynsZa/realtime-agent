import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { MockLLM } from '../mock_llm';
import { knowledgeBase } from '../knowledge_base';

describe('MockLLM', () => {
  let llm: MockLLM;

  beforeAll(async () => {
    await knowledgeBase.load();
  });

  beforeEach(() => {
    llm = new MockLLM({ streamDelayMs: 0 }); // Fast tests
  });

  describe('generateResponse', () => {
    it('should return response with citations when KB has matches', async () => {
      const response = await llm.generateResponse('What is the price of Basic Plan?');

      expect(response.text).toBeDefined();
      expect(response.citations.length).toBeGreaterThan(0);
    });

    it('should return no-sources message when KB has no matches', async () => {
      const response = await llm.generateResponse('xyznonexistent123');

      expect(response.text).toContain("couldn't find");
      expect(response.citations).toEqual([]);
    });

    it('should detect hallucination when enabled', async () => {
      llm.setConfig({ hallucinate: true });
      const response = await llm.generateResponse('What is the refund policy?');

      // Should detect the injected fake number and return verification failure
      expect(response.text).toContain('cannot verify');
    });

    it('should suggest schedule_callback action for "call me"', async () => {
      const response = await llm.generateResponse('Please call me about pricing');

      expect(response.suggestedAction).toBeDefined();
      expect(response.suggestedAction?.action).toBe('schedule_callback');
    });

    it('should suggest send_sms action for SMS requests', async () => {
      const response = await llm.generateResponse('Send me an SMS with the details');

      expect(response.suggestedAction).toBeDefined();
      expect(response.suggestedAction?.action).toBe('send_sms');
    });

    it('should suggest create_ticket action for ticket requests', async () => {
      const response = await llm.generateResponse('Create a support ticket please');

      expect(response.suggestedAction).toBeDefined();
      expect(response.suggestedAction?.action).toBe('create_ticket');
    });

    it('should not suggest action when no trigger detected', async () => {
      const response = await llm.generateResponse('What is the price?');

      expect(response.suggestedAction).toBeUndefined();
    });
  });

  describe('streamResponse', () => {
    it('should yield chunks of text', async () => {
      const chunks: string[] = [];
      for await (const chunk of llm.streamResponse('Hello world test')) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toContain('Hello');
    });

    it('should stop streaming when cancelled', async () => {
      const signal = { cancelled: false };
      const chunks: string[] = [];

      const longText = 'word '.repeat(100);

      for await (const chunk of llm.streamResponse(longText, signal)) {
        chunks.push(chunk);
        if (chunks.length === 3) {
          signal.cancelled = true;
        }
      }

      expect(chunks.length).toBe(3);
    });
  });

  describe('setConfig', () => {
    it('should update configuration', async () => {
      llm.setConfig({ hallucinate: true });

      const response = await llm.generateResponse('What is the refund policy?');
      // Hallucination mode injects 99.99% which won't be in KB snippets about refunds
      expect(response.text).toContain('cannot verify');
    });
  });
});
