/**
 * OpenStreetMap map API proxy for address nodes and buildings.
 * Route: /api/addresses?bbox=west,south,east,north
 */

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const bbox = requestUrl.searchParams.get('bbox') || '';
  const values = bbox.split(',').map(Number);

  if (values.length !== 4 || values.some(value => !Number.isFinite(value))) {
    return new Response('Invalid bbox.', { status: 400 });
  }

  const [west, south, east, north] = values;
  if (west >= east || south >= north || east - west > 0.25 || north - south > 0.25) {
    return new Response('Bbox is too large or invalid.', { status: 400 });
  }

  const upstream = new URL('https://api.openstreetmap.org/api/0.6/map');
  upstream.searchParams.set('bbox', [west, south, east, north].join(','));

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(upstream, {
      headers: { 'User-Agent': 'BSMAP-App/2.0 (OSM address overlay)' },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return new Response('OpenStreetMap API unavailable.', { status: 502 });
    }

    return new Response(await response.arrayBuffer(), {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    return new Response('OpenStreetMap API timeout.', {
      status: 504,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
