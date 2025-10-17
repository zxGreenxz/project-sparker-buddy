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
 * Extract base product code from variant code
 * Examples:
 * - LQU114L → LQU114
 * - N152MS → N152
 * - L800XD30 → L800
 */
export function extractBaseCode(variantCode: string): string | null {
  if (!variantCode) return null;
  
  // Pattern: L/N + numbers + letters at end
  const match = variantCode.match(/^([LN]\w*?\d+)[A-Z]+\d*$/);
  return match ? match[1] : null;
}

/**
 * Check if product code is a variant (has letters after numbers)
 */
export function isVariantCode(productCode: string): boolean {
  if (!productCode) return false;
  return /^[LN]\w*?\d+[A-Z]+\d*$/.test(productCode);
}
