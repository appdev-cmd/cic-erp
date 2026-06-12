/**
 * Nạp ảnh tĩnh (logo) thành dataURL + kích thước gốc để nhúng vào jsPDF.
 */
export interface ImageAsset {
    dataUrl: string;
    width: number;
    height: number;
}

const _cache = new Map<string, ImageAsset>();

export async function loadImageAsset(url: string): Promise<ImageAsset> {
    const cached = _cache.get(url);
    if (cached) return cached;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Không tải được ảnh ${url}: ${response.status}`);
    const blob = await response.blob();

    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    });

    const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = reject;
        img.src = dataUrl;
    });

    const asset = { dataUrl, width, height };
    _cache.set(url, asset);
    return asset;
}
