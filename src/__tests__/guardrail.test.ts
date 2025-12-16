import { describe, it, expect } from 'vitest';
import {
  normalizeNumber,
  extractNumbers,
  numberExistsInCitations,
  verifyResponse,
  generateUnverifiedNumbersResponse,
  generateNoSourcesResponse,
} from '../guardrail';
import { Citation } from '../types';

describe('normalizeNumber', () => {
  it('should treat comma and period as equivalent', () => {
    expect(normalizeNumber('12,5')).toBe('12.5');
    expect(normalizeNumber('12.5')).toBe('12.5');
  });

  it('should remove spaces from phone numbers', () => {
    expect(normalizeNumber('+46 123 456')).toBe('+46123456');
  });

  it('should handle integers unchanged', () => {
    expect(normalizeNumber('123')).toBe('123');
  });
});

describe('extractNumbers', () => {
  it('should extract integers', () => {
    expect(extractNumbers('The price is 100 dollars')).toContain('100');
  });

  it('should extract decimals with period', () => {
    expect(extractNumbers('Price: $12.99')).toContain('12.99');
  });

  it('should extract decimals with comma', () => {
    const numbers = extractNumbers('Price: 12,99 EUR');
    expect(numbers.some(n => n === '12.99')).toBe(true);
  });

  it('should extract percentages', () => {
    expect(extractNumbers('20% discount')).toContain('20%');
  });

  it('should extract dates', () => {
    const numbers = extractNumbers('Date: 2025-12-12');
    expect(numbers).toContain('2025');
    expect(numbers).toContain('12');
  });

  it('should extract phone numbers', () => {
    const numbers = extractNumbers('Call +1-555-123-4567');
    expect(numbers.some(n => n.includes('+1'))).toBe(true);
  });

  it('should return empty array for text without numbers', () => {
    expect(extractNumbers('No numbers here')).toEqual([]);
  });
});

describe('numberExistsInCitations', () => {
  const citations: Citation[] = [
    { file: 'kb/prices.md', snippet: 'Basic Plan: $9.99/month' },
    { file: 'kb/policies.md', snippet: '30 day refund policy' },
  ];

  it('should find exact number match', () => {
    expect(numberExistsInCitations('9.99', citations)).toBe(true);
    expect(numberExistsInCitations('30', citations)).toBe(true);
  });

  it('should match with normalized decimals', () => {
    expect(numberExistsInCitations('9,99', citations)).toBe(true);
  });

  it('should return false for numbers not in citations', () => {
    expect(numberExistsInCitations('99.99', citations)).toBe(false);
    expect(numberExistsInCitations('50', citations)).toBe(false);
  });
});

describe('verifyResponse', () => {
  const citations: Citation[] = [
    { file: 'kb/prices.md', snippet: 'Pro Plan: $29.99/month' },
    { file: 'kb/policies.md', snippet: '99.9% uptime guarantee' },
  ];

  it('should pass when all numbers are in citations', () => {
    const result = verifyResponse('The Pro Plan costs $29.99 with 99.9% uptime', citations);
    expect(result.valid).toBe(true);
    expect(result.unverifiedNumbers).toEqual([]);
  });

  it('should fail when response contains unverified numbers', () => {
    const result = verifyResponse('The price increased by 50%', citations);
    expect(result.valid).toBe(false);
    expect(result.unverifiedNumbers).toContain('50%');
  });

  it('should pass for text without numbers', () => {
    const result = verifyResponse('This plan is great', citations);
    expect(result.valid).toBe(true);
  });

  it('should identify multiple unverified numbers', () => {
    const result = verifyResponse('Costs 100 dollars with 75% discount', citations);
    expect(result.valid).toBe(false);
    expect(result.unverifiedNumbers).toContain('100');
    expect(result.unverifiedNumbers).toContain('75%');
  });
});

describe('generateUnverifiedNumbersResponse', () => {
  it('should include unverified numbers in response', () => {
    const citations: Citation[] = [{ file: 'kb/test.md', snippet: 'test' }];
    const result = generateUnverifiedNumbersResponse(['50', '99.99'], citations);

    expect(result.text).toContain('50');
    expect(result.text).toContain('99.99');
    expect(result.text).toContain('cannot verify');
    expect(result.citations).toBe(citations);
  });
});

describe('generateNoSourcesResponse', () => {
  it('should return appropriate message with empty citations', () => {
    const result = generateNoSourcesResponse();

    expect(result.text).toContain("couldn't find");
    expect(result.citations).toEqual([]);
  });
});
