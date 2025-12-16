import { Citation } from './types';

// Matches numbers including integers, decimals, percentages, dates, phone numbers
// Examples: 12, 12.5, 12,5, 50%, 2025-12-12, +46123456789
const NUMBER_PATTERN = /[\d]+(?:[.,]\d+)*%?|\+\d[\d\s-]*/g;

/**
 * Normalize a number string by treating . and , as equivalent decimal separators
 */
export function normalizeNumber(num: string): string {
  return num.replace(/,/g, '.').replace(/\s/g, '');
}

/**
 * Extract all numbers from a text string
 */
export function extractNumbers(text: string): string[] {
  const matches = text.match(NUMBER_PATTERN) || [];
  return matches.map(normalizeNumber);
}

/**
 * Check if a number exists in any of the cited snippets
 */
export function numberExistsInCitations(num: string, citations: Citation[]): boolean {
  const normalizedNum = normalizeNumber(num);

  for (const citation of citations) {
    const snippetNumbers = extractNumbers(citation.snippet);
    if (snippetNumbers.some(sn => normalizeNumber(sn) === normalizedNum)) {
      return true;
    }
  }

  return false;
}

/**
 * Verify that all numbers in the response text exist in the cited snippets.
 * Returns an object with verification result and any unverified numbers.
 */
export function verifyResponse(
  responseText: string,
  citations: Citation[]
): { valid: boolean; unverifiedNumbers: string[] } {
  const responseNumbers = extractNumbers(responseText);
  const unverifiedNumbers: string[] = [];

  for (const num of responseNumbers) {
    if (!numberExistsInCitations(num, citations)) {
      unverifiedNumbers.push(num);
    }
  }

  return {
    valid: unverifiedNumbers.length === 0,
    unverifiedNumbers,
  };
}

/**
 * Generate a guarded response when unverified numbers are detected
 */
export function generateUnverifiedNumbersResponse(
  unverifiedNumbers: string[],
  citations: Citation[]
): { text: string; citations: Citation[] } {
  const numberList = unverifiedNumbers.join(', ');
  return {
    text: `I cannot verify that information. The following numbers could not be found in the knowledge base: ${numberList}`,
    citations,
  };
}

/**
 * Generate response when no sources are found
 */
export function generateNoSourcesResponse(): { text: string; citations: Citation[] } {
  return {
    text: "I couldn't find any references to this in the knowledge base.",
    citations: [],
  };
}
