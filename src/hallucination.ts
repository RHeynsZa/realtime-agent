import { KBSearchResult } from './types';
import { createLogger } from './logger';

const log = createLogger('hallucination');

/**
 * Hallucination templates keyed by KB filename (without extension).
 * Each template generates a fake number/stat that won't be in the KB.
 */
const HALLUCINATION_TEMPLATES: Record<string, string[]> = {
  prices: [
    ' There is also a hidden Starter Plan at $4.99/month for limited use.',
    ' Additionally, a 35% loyalty discount is available for customers over 2 years.',
    ' The Enterprise Plan includes a $500 setup fee.',
    ' Black Friday special: 45% off all plans.',
  ],
  contact: [
    ' You can also reach us at our backup number: +1-555-999-0000.',
    ' Our Sydney office is available at +61-2-5555-1234.',
    ' Emergency support is available 24/7 at extension 999.',
    ' Live chat support responds within 2 minutes on average.',
  ],
  policies: [
    ' Extended refunds up to 90 days are available on request.',
    ' Our uptime guarantee is actually 99.99% for Enterprise customers.',
    ' Premium support response time is 30 minutes for critical issues.',
    ' Data is retained for 180 days after account cancellation.',
  ],
  billing: [
    ' Quarterly billing is available with a 10% discount.',
    ' Late payment fee is $25 after 14 days overdue.',
    ' Cryptocurrency payments accepted with 5% discount.',
    ' Wire transfers over $10,000 receive a 3% rebate.',
  ],
  security: [
    ' We use AES-512 encryption for premium accounts.',
    ' Passwords must be changed every 60 days.',
    ' Audit logs are retained for 5 years on Enterprise.',
    ' Session timeout can be extended to 72 hours.',
  ],
  features: [
    ' Pro plan now supports up to 100 users per workspace.',
    ' File sharing limit increased to 10GB per file.',
    ' Basic plan includes 25GB storage as of this month.',
    ' Real-time collaboration supports up to 75 concurrent users.',
  ],
  faq: [
    ' Password reset links expire after 15 minutes.',
    ' Storage warnings are sent at 70% and 90% capacity.',
    ' Data exports are available for 60 days after generation.',
    ' You can have up to 5 email addresses per account.',
  ],
  troubleshooting: [
    ' Accounts unlock automatically after 10 minutes.',
    ' Minimum internet speed required is 10 Mbps.',
    ' API rate limit for Plus tier is 5,000 requests per minute.',
    ' App requires iOS 15.0 or Android 9.0 minimum.',
  ],
  'getting-started': [
    ' Free trial extended to 30 days for new signups.',
    ' Onboarding takes approximately 15 minutes.',
    ' Setup wizard completes 95% of configuration automatically.',
    ' First 500MB of storage is free forever.',
  ],
};

const DEFAULT_HALLUCINATIONS = [
  ' This feature has a 99.5% satisfaction rate.',
  ' Average response time is 2.3 seconds.',
  ' Over 50,000 customers use this feature daily.',
  ' Last updated 45 days ago.',
];

/**
 * Extract filename without path and extension.
 * e.g., "kb/prices.md" -> "prices"
 */
function extractFilename(filepath: string): string {
  const filename = filepath.split('/').pop() || '';
  return filename.replace(/\.md$/, '');
}

/**
 * Pick a random element from an array.
 */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a contextual hallucination based on KB search results.
 * Returns a single hallucination string appropriate for the top result's file type.
 */
export function generateHallucination(searchResults: KBSearchResult[]): string {
  if (searchResults.length === 0) {
    log.debug('No search results, using default hallucination');
    return pickRandom(DEFAULT_HALLUCINATIONS);
  }

  const topResult = searchResults[0];
  const filename = extractFilename(topResult.file);
  const templates = HALLUCINATION_TEMPLATES[filename] || DEFAULT_HALLUCINATIONS;

  log.debug('Generating hallucination', { file: topResult.file, filename });

  const hallucination = pickRandom(templates);

  log.info('Hallucination generated', {
    filename,
    hallucinationLength: hallucination.length,
  });

  return hallucination;
}
