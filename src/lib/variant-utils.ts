/**
 * Parse variant string into name and code components
 * Format: "variant_name - product_code"
 * Example: "Size M - N152" → { name: "Size M", code: "N152" }
 */
export const parseVariant = (variant: string | null | undefined): { name: string; code: string } => {
  if (!variant || variant.trim() === '') {
    return { name: '', code: '' };
  }
  
  const trimmed = variant.trim();
  
  // Format: "variant_name - product_code"
  if (trimmed.includes(' - ')) {
    const parts = trimmed.split(' - ');
    if (parts.length >= 2) {
      return {
        name: parts[0].trim(),
        code: parts.slice(1).join(' - ').trim() // Handle edge case: "2-in-1 - N152"
      };
    }
  }
  
  // Format: "- product_code" (no variant name)
  if (trimmed.startsWith('- ')) {
    return {
      name: '',
      code: trimmed.substring(2).trim()
    };
  }
  
  // Old format: just variant name (backward compatibility)
  return {
    name: trimmed,
    code: ''
  };
};

/**
 * Format variant string from name and code
 */
export const formatVariant = (name: string | null | undefined, code: string): string => {
  const trimmedName = name?.trim() || '';
  const trimmedCode = code.trim();
  
  if (!trimmedName && !trimmedCode) return '';
  if (!trimmedName) return `- ${trimmedCode}`;
  return `${trimmedName} - ${trimmedCode}`;
};

/**
 * Get only the variant name part (before " - ")
 * If no " - " exists (old data), return full string
 */
export const getVariantName = (variant: string | null | undefined): string => {
  return parseVariant(variant).name;
};

/**
 * Get only the variant code part (after " - ")
 */
export const getVariantCode = (variant: string | null | undefined): string => {
  return parseVariant(variant).code;
};

/**
 * Extract base product code from a variant code
 * Examples:
 * - "LQU114L" → "LQU114"
 * - "N152M" → "N152"
 * - "L800XS" → "L800"
 * Pattern: L/N + alphanumeric + numbers + letters at end
 */
export const extractBaseCode = (variantCode: string): string | null => {
  if (!variantCode || variantCode.trim() === '') {
    return null;
  }
  
  const trimmed = variantCode.trim();
  
  // Pattern: ^([LN]\w*\d+)[A-Z]+\d*$
  // Matches: L/N prefix + any chars + digits + capital letters at end (+ optional digits)
  const match = trimmed.match(/^([LN]\w*\d+)[A-Z]+\d*$/);
  
  if (match && match[1]) {
    return match[1];
  }
  
  return null;
};

/**
 * Check if a product code is a variant code
 * Returns true if code ends with capital letters after numbers
 * Examples:
 * - "LQU114L" → true
 * - "N152M" → true
 * - "LQU114" → false
 * - "N152" → false
 */
export const isVariantCode = (productCode: string): boolean => {
  if (!productCode || productCode.trim() === '') {
    return false;
  }
  
  // Pattern: ^[LN]\w*\d+[A-Z]+\d*$
  return /^[LN]\w*\d+[A-Z]+\d*$/.test(productCode.trim());
};
