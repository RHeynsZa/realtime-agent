import * as fs from 'fs';
import * as path from 'path';
import { KBDocument, KBSearchResult } from './types';
import { createLogger } from './logger';

const log = createLogger('kb');
const KB_DIR = path.join(__dirname, '..', 'kb');

// Synonym mappings: key is the canonical term, values are synonyms that map to it
const SYNONYMS: Record<string, string[]> = {
  price: ['cost', 'pricing', 'costs', 'fee', 'fees', 'rate', 'rates', 'much'],
  plan: ['plans', 'tier', 'tiers', 'package', 'packages', 'subscription'],
  refund: ['refunds', 'money back', 'return', 'returns', 'reimburse'],
  contact: ['phone', 'call', 'email', 'reach', 'support'],
  policy: ['policies', 'terms', 'rules', 'guidelines'],
  discount: ['discounts', 'off', 'save', 'savings', 'promotion', 'deal'],
  uptime: ['availability', 'reliable', 'reliability', 'sla'],
};

/**
 * Expand query with synonym mappings to improve search hits.
 * Adds canonical terms alongside original terms rather than replacing.
 */
export function rewriteQuery(query: string): string {
  const words = query.toLowerCase().split(/\s+/);
  const expanded: string[] = [];

  for (const word of words) {
    // Add original word if not already present
    if (!expanded.includes(word)) {
      expanded.push(word);
    }

    // Check if this word is a synonym and add the canonical term
    for (const [canonical, synonyms] of Object.entries(SYNONYMS)) {
      if (synonyms.some(s => s === word || s.split(' ').includes(word))) {
        if (!expanded.includes(canonical)) {
          expanded.push(canonical);
        }
      }
    }
  }

  return expanded.join(' ');
}

export class KnowledgeBase {
  private documents: KBDocument[] = [];

  async load(): Promise<void> {
    log.debug('Loading knowledge base', { path: KB_DIR });
    this.documents = [];

    if (!fs.existsSync(KB_DIR)) {
      log.warn('KB directory not found', { path: KB_DIR });
      return;
    }

    const files = fs.readdirSync(KB_DIR).filter(f => f.endsWith('.md'));
    log.debug('Found KB files', { count: files.length, files });

    for (const file of files) {
      const filePath = path.join(KB_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      this.documents.push({
        file: `kb/${file}`,
        content,
      });
    }

    log.info('Knowledge base loaded', {
      documentCount: this.documents.length,
      totalSize: this.documents.reduce((sum, d) => sum + d.content.length, 0),
    });
  }

  search(query: string, maxResults: number = 3): KBSearchResult[] {
    if (this.documents.length === 0) {
      log.warn('Search attempted on empty KB');
      return [];
    }

    const results: KBSearchResult[] = [];
    const rewrittenQuery = rewriteQuery(query);
    const queryTerms = rewrittenQuery.split(/\s+/).filter(t => t.length > 2);

    log.debug('Searching KB', {
      originalQuery: query.slice(0, 50),
      rewrittenQuery: rewrittenQuery.slice(0, 80),
      termCount: queryTerms.length,
    });

    for (const doc of this.documents) {
      const lines = doc.content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        let score = 0;

        for (const term of queryTerms) {
          if (line.includes(term)) {
            score += 1;
          }
        }

        if (score > 0) {
          const startLine = Math.max(0, i - 1);
          const endLine = Math.min(lines.length - 1, i + 1);
          const snippet = lines.slice(startLine, endLine + 1).join('\n');

          results.push({
            file: doc.file,
            snippet,
            score,
          });
        }
      }
    }

    const topResults = results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    log.debug('Search completed', {
      totalMatches: results.length,
      returnedResults: topResults.length,
      topScore: topResults[0]?.score ?? 0,
      files: [...new Set(topResults.map(r => r.file))],
    });

    return topResults;
  }

  getAllDocuments(): KBDocument[] {
    return this.documents;
  }
}

// Singleton instance
export const knowledgeBase = new KnowledgeBase();
