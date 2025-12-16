import { describe, it, expect } from 'vitest';
import { generateHallucination } from '../hallucination';
import { KBSearchResult } from '../types';

describe('generateHallucination', () => {
  it('should return a hallucination for prices file', () => {
    const results: KBSearchResult[] = [
      { file: 'kb/prices.md', snippet: 'Basic Plan: $9.99/month', score: 3 },
    ];

    const hallucination = generateHallucination(results);

    expect(hallucination).toBeDefined();
    expect(hallucination.length).toBeGreaterThan(0);
    // All price hallucinations contain numbers
    expect(hallucination).toMatch(/\d/);
  });

  it('should return a hallucination for contact file', () => {
    const results: KBSearchResult[] = [
      { file: 'kb/contact.md', snippet: 'Phone: +1-555-123-4567', score: 2 },
    ];

    const hallucination = generateHallucination(results);

    expect(hallucination).toBeDefined();
    expect(hallucination).toMatch(/\d/);
  });

  it('should return a hallucination for policies file', () => {
    const results: KBSearchResult[] = [
      { file: 'kb/policies.md', snippet: '99.9% uptime guarantee', score: 2 },
    ];

    const hallucination = generateHallucination(results);

    expect(hallucination).toBeDefined();
    expect(hallucination).toMatch(/\d/);
  });

  it('should return a hallucination for billing file', () => {
    const results: KBSearchResult[] = [
      { file: 'kb/billing.md', snippet: 'Bank transfer minimum $1,000', score: 2 },
    ];

    const hallucination = generateHallucination(results);

    expect(hallucination).toBeDefined();
    expect(hallucination).toMatch(/\d/);
  });

  it('should return a hallucination for security file', () => {
    const results: KBSearchResult[] = [
      { file: 'kb/security.md', snippet: 'AES-256 encryption', score: 2 },
    ];

    const hallucination = generateHallucination(results);

    expect(hallucination).toBeDefined();
    expect(hallucination).toMatch(/\d/);
  });

  it('should return a hallucination for features file', () => {
    const results: KBSearchResult[] = [
      { file: 'kb/features.md', snippet: 'Up to 50 users per workspace', score: 2 },
    ];

    const hallucination = generateHallucination(results);

    expect(hallucination).toBeDefined();
    expect(hallucination).toMatch(/\d/);
  });

  it('should return a hallucination for faq file', () => {
    const results: KBSearchResult[] = [
      { file: 'kb/faq.md', snippet: 'Reset link via email within 5 minutes', score: 2 },
    ];

    const hallucination = generateHallucination(results);

    expect(hallucination).toBeDefined();
    expect(hallucination).toMatch(/\d/);
  });

  it('should return a hallucination for troubleshooting file', () => {
    const results: KBSearchResult[] = [
      { file: 'kb/troubleshooting.md', snippet: 'Accounts lock after 5 failed attempts', score: 2 },
    ];

    const hallucination = generateHallucination(results);

    expect(hallucination).toBeDefined();
    expect(hallucination).toMatch(/\d/);
  });

  it('should return a hallucination for getting-started file', () => {
    const results: KBSearchResult[] = [
      { file: 'kb/getting-started.md', snippet: 'Welcome to the platform', score: 2 },
    ];

    const hallucination = generateHallucination(results);

    expect(hallucination).toBeDefined();
    expect(hallucination).toMatch(/\d/);
  });

  it('should return a default hallucination for unknown file types', () => {
    const results: KBSearchResult[] = [
      { file: 'kb/random-unknown.md', snippet: 'Some content', score: 1 },
    ];

    const hallucination = generateHallucination(results);

    expect(hallucination).toBeDefined();
    expect(hallucination).toMatch(/\d/);
  });

  it('should return a default hallucination for empty results', () => {
    const hallucination = generateHallucination([]);

    expect(hallucination).toBeDefined();
    expect(hallucination).toMatch(/\d/);
  });

  it('should use top result file type when multiple results exist', () => {
    const results: KBSearchResult[] = [
      { file: 'kb/prices.md', snippet: 'Basic Plan: $9.99/month', score: 5 },
      { file: 'kb/contact.md', snippet: 'Phone: +1-555-123-4567', score: 2 },
    ];

    // Run multiple times to check randomness doesn't break things
    for (let i = 0; i < 10; i++) {
      const hallucination = generateHallucination(results);
      expect(hallucination).toBeDefined();
      expect(hallucination).toMatch(/\d/);
    }
  });
});
