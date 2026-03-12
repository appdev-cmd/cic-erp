/**
 * Tax Code Lookup Service
 * Uses free VietQR API to fetch business info by tax code (mã số thuế)
 * API Docs: https://api.vietqr.io/v2/business/{taxCode}
 */

export interface TaxLookupResult {
    id: string;              // Mã số thuế
    name: string;            // Tên doanh nghiệp
    internationalName: string | null;
    shortName: string | null;
    address: string;         // Địa chỉ
    status: string;          // Tình trạng: "NNT đang hoạt động"
}

interface VietQRResponse {
    code: string;   // "00" = success
    desc: string;
    data: TaxLookupResult | null;
}

export const TaxLookupService = {
    /**
     * Look up business information by tax code using VietQR API
     * @param taxCode - Vietnamese business tax code (mã số thuế / mã số DN)
     * @returns Business info or null if not found
     */
    lookup: async (taxCode: string): Promise<TaxLookupResult | null> => {
        const cleaned = taxCode.trim().replace(/[^0-9-]/g, '');
        if (!cleaned || cleaned.length < 10) {
            throw new Error('Mã số DN phải có ít nhất 10 ký tự');
        }

        const response = await fetch(`https://api.vietqr.io/v2/business/${cleaned}`);

        if (!response.ok) {
            throw new Error(`Lỗi kết nối API (${response.status})`);
        }

        const json: VietQRResponse = await response.json();

        if (json.code !== '00' || !json.data) {
            return null; // Not found
        }

        return json.data;
    },
};
