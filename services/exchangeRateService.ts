/**
 * Exchange Rate Service
 * Fetches VCB (Vietcombank) exchange rates via Supabase Edge Function proxy.
 * Caches rates for 30 minutes to minimize API calls.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/exchange-rates`;

export interface ExchangeRate {
    currency: string;
    name: string;
    buy: number;      // Mua tiền mặt
    transfer: number; // Mua chuyển khoản
    sell: number;     // Bán
}

interface CachedRates {
    rates: ExchangeRate[];
    updatedAt: string;
    cachedAt: number;
}

// Common currencies to show first
export const COMMON_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'SGD', 'CAD', 'CHF', 'CNY', 'KRW'];

let cache: CachedRates | null = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export const ExchangeRateService = {
    /**
     * Fetch exchange rates from VCB via Edge Function.
     * Returns cached data if still fresh.
     */
    getRates: async (): Promise<{ rates: ExchangeRate[]; updatedAt: string }> => {
        // Return cache if fresh
        if (cache && Date.now() - cache.cachedAt < CACHE_DURATION) {
            return { rates: cache.rates, updatedAt: cache.updatedAt };
        }

        try {
            const res = await fetch(EDGE_FUNCTION_URL);
            const data = await res.json();

            if (data.success && data.rates?.length > 0) {
                cache = {
                    rates: data.rates,
                    updatedAt: data.updatedAt,
                    cachedAt: Date.now(),
                };
                return { rates: data.rates, updatedAt: data.updatedAt };
            }

            // If API fails but we have stale cache, use it
            if (cache) {
                return { rates: cache.rates, updatedAt: cache.updatedAt };
            }

            throw new Error(data.error || 'No rates available');
        } catch (error) {
            // Fallback to cache if available
            if (cache) {
                return { rates: cache.rates, updatedAt: cache.updatedAt };
            }
            console.error('[ExchangeRateService] Failed to fetch rates:', error);
            return { rates: [], updatedAt: '' };
        }
    },

    /**
     * Get sell rate for a specific currency (used for calculating VND cost).
     * Returns 0 if currency not found.
     */
    getRate: async (currencyCode: string): Promise<number> => {
        const { rates } = await ExchangeRateService.getRates();
        const rate = rates.find(r => r.currency === currencyCode);
        return rate?.sell || rate?.transfer || 0;
    },

    /**
     * Sort rates: common currencies first, then alphabetical.
     */
    sortRates: (rates: ExchangeRate[]): ExchangeRate[] => {
        return [...rates].sort((a, b) => {
            const aIdx = COMMON_CURRENCIES.indexOf(a.currency);
            const bIdx = COMMON_CURRENCIES.indexOf(b.currency);
            if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
            if (aIdx >= 0) return -1;
            if (bIdx >= 0) return 1;
            return a.currency.localeCompare(b.currency);
        });
    },
};
