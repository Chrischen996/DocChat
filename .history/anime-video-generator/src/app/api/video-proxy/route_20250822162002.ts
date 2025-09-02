import { NextRequest } from 'next/server';

// Simple streaming proxy for external video URLs (supports Range passthrough)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const encodedUrl = searchParams.get('url');
    if (!encodedUrl) {
      return new Response('Missing url param', { status: 400 });
    }

    const targetUrl = decodeURIComponent(encodedUrl);

    const range = request.headers.get('range') || undefined;
    const upstreamResponse = await fetch(targetUrl, {
      headers: range ? { Range: range } : undefined,
    });

    // Pass-through status and headers relevant for media streaming
    const headers = new Headers();
    // Content headers
    const contentType = upstreamResponse.headers.get('content-type') || 'video/mp4';
    headers.set('Content-Type', contentType);
    const contentLength = upstreamResponse.headers.get('content-length');
    if (contentLength) headers.set('Content-Length', contentLength);
    const acceptRanges = upstreamResponse.headers.get('accept-ranges');
    if (acceptRanges) headers.set('Accept-Ranges', acceptRanges);
    const contentRange = upstreamResponse.headers.get('content-range');
    if (contentRange) headers.set('Content-Range', contentRange);
    // Caching disabled to respect signed URLs
    headers.set('Cache-Control', 'no-store');
    // CORS for client playback
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers,
    });
  } catch (error: any) {
    return new Response(error?.message || 'Proxy error', { status: 502 });
  }
}


