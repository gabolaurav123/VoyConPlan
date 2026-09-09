import QRCode from 'qrcode';
import type { PdfImage, TripPdfAssets, TripPdfFonts } from './trip-pdf';

const localPath = (value: unknown): string | null =>
  typeof value === 'string' && /^\/(?!\/)/.test(value) ? value : null;

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(binary);
}

async function bytes(path: string): Promise<Uint8Array | undefined> {
  try {
    const response = await fetch(path, { cache: 'force-cache' });
    if (!response.ok) return undefined;
    const data = new Uint8Array(await response.arrayBuffer());
    return data.length ? data : undefined;
  } catch {
    return undefined;
  }
}

/** Browser-only IO stays outside the PDF builder. All artwork/font files are same-origin. */
export async function loadTripPdfAssets(destination: unknown, shareUrl?: string): Promise<{
  assets: TripPdfAssets;
  fonts?: TripPdfFonts;
}> {
  const data = destination !== null && typeof destination === 'object'
    ? destination as Record<string, unknown> : {};
  const path = localPath(data.image);
  const [logo, photo, editorial, regular, semibold] = await Promise.all([
    bytes('/brand/logo.png'),
    path ? bytes(path) : Promise.resolve(undefined),
    bytes('/brand/travel-editorial.png'),
    bytes('/fonts/pdf/Inter-Regular.ttf'),
    bytes('/fonts/pdf/Inter-Semibold.ttf'),
  ]);
  const image = (value: Uint8Array | undefined, format: 'PNG' | 'JPEG', credit?: string): PdfImage | undefined =>
    value ? { data: value, format, credit } : undefined;
  const assets: TripPdfAssets = {
    logo: image(logo, 'PNG'),
    destination: image(photo, path?.toLowerCase().endsWith('.png') ? 'PNG' : 'JPEG',
      typeof data.author === 'string' && data.author ? `Fotografía: ${data.author} / Unsplash` : undefined),
    editorial: image(editorial, 'PNG', 'Imagen editorial generada para VoyConPlan.'),
  };
  if (shareUrl && /^https?:\/\//i.test(shareUrl)) {
    try {
      assets.qr = {
        data: await QRCode.toDataURL(shareUrl, { width: 240, margin: 1, color: { dark: '#173F35', light: '#F7F6EE' } }),
        format: 'PNG',
      };
    } catch { /* A missing optional QR must not prevent exporting the trip. */ }
  }
  return { assets, fonts: regular && semibold ? { regular: base64(regular), semibold: base64(semibold) } : undefined };
}
