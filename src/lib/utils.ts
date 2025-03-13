import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generates search tokens for a given text, optimized for CJK (Chinese, Japanese, Korean) and Latin characters
 * @param text The text to generate tokens from
 * @returns Array of search tokens
 */
export function generateSearchTokens(text: string): string[] {
  const tokens = new Set<string>();
  const normalized = text.toLowerCase().trim();
  
  // Add full text for exact matches
  tokens.add(normalized);
  
  // Split by whitespace for word-level tokens
  const words = normalized.split(/\s+/).filter(Boolean);
  words.forEach(word => {
    // Add each word
    tokens.add(word);
    
    // For non-CJK words longer than 3 characters, add partial matches
    if (!/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\u3400-\u4dbf]/.test(word) && word.length > 3) {
      // Add prefixes for partial matching (e.g., "ramen" -> "ram", "rame")
      for (let i = 3; i < word.length; i++) {
        tokens.add(word.slice(0, i));
      }
    }
  });
  
  // Add consecutive word combinations
  for (let i = 0; i < words.length - 1; i++) {
    tokens.add(words[i] + words[i + 1]);
  }
  
  // For CJK characters
  const cjkText = words.join('');
  if (/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\u3400-\u4dbf]/.test(cjkText)) {
    // Single characters
    for (let i = 0; i < cjkText.length; i++) {
      tokens.add(cjkText[i]);
    }
    
    // Pairs of characters (useful for compound words)
    for (let i = 0; i < cjkText.length - 1; i++) {
      tokens.add(cjkText.slice(i, i + 2));
    }
    
    // Triplets of characters
    for (let i = 0; i < cjkText.length - 2; i++) {
      tokens.add(cjkText.slice(i, i + 3));
    }
  }
  
  return Array.from(tokens);
}

/**
 * Prepares shop data for search functionality
 * @param name Shop name
 * @returns Object containing search-related fields
 */
export function prepareShopSearchFields(name: string) {
  return {
    name_lower: name.toLowerCase(),
    searchTokens: generateSearchTokens(name)
  };
}
