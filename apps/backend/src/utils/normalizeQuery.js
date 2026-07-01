/**
 * Normalizes user queries by trimming, lowercasing, and stripping trailing punctuation.
 * Matches frontend normalization implementation for canned responses and RAG retrieval.
 * @param {string} text
 * @returns {string}
 */
export function normalizeQuery(text) {
  return text?.trim().toLowerCase().replace(/[?!.]+$/, "") || "";
}
