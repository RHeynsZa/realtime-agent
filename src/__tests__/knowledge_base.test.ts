import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeBase, rewriteQuery } from '../knowledge_base';

describe('rewriteQuery', () => {
  it('should expand cost with price', () => {
    expect(rewriteQuery('what is the cost')).toBe('what is the cost price');
  });

  it('should expand multiple synonyms', () => {
    const result = rewriteQuery('pricing tiers');
    expect(result).toContain('pricing');
    expect(result).toContain('price');
    expect(result).toContain('tiers');
    expect(result).toContain('plan');
  });

  it('should expand phone with contact', () => {
    expect(rewriteQuery('phone number')).toBe('phone contact number');
  });

  it('should handle mixed case', () => {
    expect(rewriteQuery('What is the COST')).toBe('what is the cost price');
  });

  it('should preserve non-synonym words', () => {
    expect(rewriteQuery('hello world')).toBe('hello world');
  });

  it('should expand availability with uptime', () => {
    expect(rewriteQuery('service availability')).toBe('service availability uptime');
  });

  it('should not duplicate canonical terms', () => {
    const result = rewriteQuery('cost price');
    const priceCount = (result.match(/price/g) || []).length;
    expect(priceCount).toBe(1);
  });
});

describe('KnowledgeBase', () => {
  let kb: KnowledgeBase;

  beforeEach(async () => {
    kb = new KnowledgeBase();
    await kb.load();
  });

  describe('load', () => {
    it('should load documents from kb directory', () => {
      const docs = kb.getAllDocuments();
      expect(docs.length).toBeGreaterThan(0);
    });

    it('should load markdown files with correct paths', () => {
      const docs = kb.getAllDocuments();
      expect(docs.every(d => d.file.startsWith('kb/'))).toBe(true);
      expect(docs.every(d => d.file.endsWith('.md'))).toBe(true);
    });
  });

  describe('search', () => {
    it('should find results matching query terms', () => {
      const results = kb.search('price plan');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return results with file and snippet', () => {
      const results = kb.search('refund');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('file');
      expect(results[0]).toHaveProperty('snippet');
      expect(results[0]).toHaveProperty('score');
    });

    it('should return empty array for no matches', () => {
      const results = kb.search('xyznonexistentterm123');
      expect(results).toEqual([]);
    });

    it('should respect maxResults parameter', () => {
      const results = kb.search('plan', 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should return results sorted by score', () => {
      const results = kb.search('plan discount');
      if (results.length > 1) {
        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
        }
      }
    });

    it('should find pricing information', () => {
      const results = kb.search('Basic Plan price');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.snippet.includes('9.99'))).toBe(true);
    });

    it('should find contact information', () => {
      const results = kb.search('support phone number');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.file.includes('contact'))).toBe(true);
    });

    it('should find policy information', () => {
      const results = kb.search('uptime guarantee');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.snippet.includes('99.9%'))).toBe(true);
    });

    it('should find pricing using synonym "cost"', () => {
      const results = kb.search('basic plan cost');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.file.includes('prices'))).toBe(true);
    });

    it('should find pricing using synonym "how much"', () => {
      const results = kb.search('how much is basic');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should find contact using synonym "phone"', () => {
      const results = kb.search('phone number');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.snippet.includes('555'))).toBe(true);
    });

    it('should find refund using synonym "money back"', () => {
      const results = kb.search('money back guarantee');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.snippet.toLowerCase().includes('refund'))).toBe(true);
    });

    it('should find uptime using synonym "availability"', () => {
      const results = kb.search('service availability');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.snippet.includes('99.9%'))).toBe(true);
    });
  });
});
