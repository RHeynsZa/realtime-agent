import { Citation, LLMResponse, KBSearchResult } from './types';
import { knowledgeBase } from './knowledge_base';
import {
  verifyResponse,
  generateUnverifiedNumbersResponse,
  generateNoSourcesResponse,
} from './guardrail';
import { generateHallucination } from './hallucination';
import { createLogger } from './logger';

const log = createLogger('llm');

export interface MockLLMConfig {
  hallucinate: boolean; // If true, inject unverified numbers
  streamDelayMs: number; // Delay between stream chunks
}

const DEFAULT_CONFIG: MockLLMConfig = {
  hallucinate: false,
  streamDelayMs: 50,
};

export class MockLLM {
  private config: MockLLMConfig;

  constructor(config: Partial<MockLLMConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setConfig(config: Partial<MockLLMConfig>): void {
    log.debug('Config updated', { ...config });
    this.config = { ...this.config, ...config };
  }

  /**
   * Generate a response based on KB search results
   */
  async generateResponse(query: string): Promise<LLMResponse> {
    log.debug('Generating response', { queryLength: query.length });

    const searchResults = knowledgeBase.search(query);
    log.debug('KB search completed', { resultCount: searchResults.length });

    if (searchResults.length === 0) {
      log.info('No KB results found', { query: query.slice(0, 50) });
      const noSourceResponse = generateNoSourcesResponse();
      return {
        text: noSourceResponse.text,
        citations: noSourceResponse.citations,
      };
    }

    const citations: Citation[] = searchResults.map(r => ({
      file: r.file,
      snippet: r.snippet,
    }));

    let responseText = this.buildResponseText(query, searchResults);

    if (this.config.hallucinate) {
      log.warn('Hallucination mode enabled - injecting fake data');
      responseText = this.injectHallucination(responseText, searchResults);
    }

    const verification = verifyResponse(responseText, citations);

    if (!verification.valid) {
      log.warn('Guardrail triggered - unverified numbers detected', {
        unverifiedNumbers: verification.unverifiedNumbers,
      });
      const guardrailResponse = generateUnverifiedNumbersResponse(
        verification.unverifiedNumbers,
        citations
      );
      return {
        text: guardrailResponse.text,
        citations: guardrailResponse.citations,
      };
    }

    const suggestedAction = this.detectAction(query);
    if (suggestedAction) {
      log.debug('Action detected', { action: suggestedAction.action });
    }

    log.debug('Response generated', {
      responseLength: responseText.length,
      citationCount: citations.length,
      hasAction: !!suggestedAction,
    });

    return {
      text: responseText,
      citations,
      suggestedAction,
    };
  }

  /**
   * Stream response text character by character
   */
  async *streamResponse(
    text: string,
    signal?: { cancelled: boolean }
  ): AsyncGenerator<string, void, unknown> {
    const words = text.split(' ');

    for (const word of words) {
      if (signal?.cancelled) {
        return;
      }

      yield word + ' ';
      await this.delay(this.config.streamDelayMs);
    }
  }

  private buildResponseText(query: string, results: KBSearchResult[]): string {
    // Build a response that includes information from the snippets
    const topResult = results[0];

    // Extract key information from the snippet
    const snippet = topResult.snippet;

    // Simple response construction - in a real LLM this would be much smarter
    return `Based on the knowledge base: ${snippet.trim()}`;
  }

  private injectHallucination(text: string, searchResults: KBSearchResult[]): string {
    return text + generateHallucination(searchResults);
  }

  private detectAction(
    query: string
  ): LLMResponse['suggestedAction'] | undefined {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('call me') || lowerQuery.includes('call person')) {
      return {
        action: 'schedule_callback',
        payload: { requestedAt: new Date().toISOString() },
      };
    }

    if (lowerQuery.includes('sms') || lowerQuery.includes('text me')) {
      return {
        action: 'send_sms',
        payload: { requestedAt: new Date().toISOString() },
      };
    }

    if (lowerQuery.includes('ticket') || lowerQuery.includes('support')) {
      return {
        action: 'create_ticket',
        payload: { requestedAt: new Date().toISOString() },
      };
    }

    return undefined;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const mockLLM = new MockLLM();
