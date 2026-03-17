/**
 * Safely evaluate a math expression string.
 * Supports: +, -, *, /, (), %, and decimal numbers.
 * Percentage: 70% → (70/100), so 1000*70% = 700
 * Returns NaN if invalid.
 */
export function safeEval(expr: string): number {
    // Remove whitespace and replace commas with dots for decimals
    let cleaned = expr.replace(/\s/g, '').replace(/,/g, '.');
    // Only allow math characters: digits, dots, +, -, *, /, (, ), %
    if (!/^[0-9.+\-*/()%]+$/.test(cleaned)) return NaN;
    // Reject empty or invalid patterns
    if (!cleaned || cleaned.length === 0) return NaN;
    // Convert percentage: number% → (number/100)
    // Handles patterns like 70%, 12.5%, (100+50)%
    cleaned = cleaned.replace(/([0-9.]+)%/g, '($1/100)');
    // Also handle parenthesized expressions followed by %: (expr)%
    cleaned = cleaned.replace(/(\([^)]+\))%/g, '($1/100)');
    try {
        // Use Function constructor (safer than eval, no access to scope)
        const result = new Function(`"use strict"; return (${cleaned});`)();
        if (typeof result !== 'number' || !isFinite(result)) return NaN;
        return result;
    } catch {
        return NaN;
    }
}

/**
 * Check if expression contains operators (is a formula vs plain number)
 */
export function isFormula(expr: string): boolean {
    return /[+\-*/(%)]+/.test(expr);
}
