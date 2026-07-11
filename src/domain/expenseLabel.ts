const AMOUNT_RE =
  /(\d[\d,]*\.?\d*|\d*\.\d+)\s*(usd|dollars?|bucks?|\$|riel?s?|khr|៛)?/gi;
const DATE_WORDS =
  /\b(yesterday|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/gi;
const ISO_DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/g;

export function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

/** Strip amounts, currency markers, and loose date words from free-text entry. */
export function cleanFreeTextLabel(raw: string) {
  let text = raw.trim().toLowerCase();
  text = text.replace(AMOUNT_RE, ' ');
  text = text.replace(/\$|៛/g, ' ');
  text = text.replace(DATE_WORDS, ' ');
  text = text.replace(ISO_DATE_RE, ' ');
  text = text.replace(/\b(usd|khr|riels?|dollars?)\b/gi, ' ');
  return collapseWhitespace(text.replace(/[,;]+/g, ' '));
}

/** Normalize correction / memory keys from a cleaned label. */
export function correctionKeyFromCleanLabel(cleanLabel: string) {
  return collapseWhitespace(cleanLabel.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' '));
}

/** Shared ABA / bank description cleanup for classifier features. */
export function cleanAbaDescription(details: string) {
  let text = collapseWhitespace(details);
  text = text.replace(
    /^(PURCHASE AT|FUNDS TRANSFERRED TO|FUNDS RECEIVED FROM)\s+/i,
    '',
  );
  text = text.replace(/\bON\s+\w{3}\s+\d{1,2},?\s*\d{4}.*$/i, '');
  text = text.replace(/\b(REF|PURCHASE|APV|RRN|BAKONG|CARD|AUTHORIZATION)\s*[#:]?\s*\S+/gi, '');
  text = text.replace(/ORIGINAL\s+AMOUNT\s+[\d,.]+\s+(USD|KHR)/gi, '');
  text = text.replace(/REMARK:\s*\S+.*$/i, '');
  text = text.replace(/@CYBS_TRN.*$/i, '');
  text = text.replace(/\bBANK\s+\S+(\s+Bank)?(\s+Plc)?(\s+Ltd)?\b/gi, '');
  text = text.replace(/\b\d{6,}\b/g, '');
  text = text.replace(
    /,\s*\S+,\s*\S+\s+(UNITED STATES|SWEDEN|CAMBODIA|SINGAPORE).*$/i,
    '',
  );
  text = text.replace(/\bBY\s+\S+\s+CARD#.*$/i, '');
  text = text.replace(/\bON\s+CAMBODIA\s+TIME.*$/i, '');
  text = text.replace(/[,;:\s-]+$/g, '');
  return collapseWhitespace(text.toLowerCase());
}