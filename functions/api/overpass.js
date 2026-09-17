/**
 * Cloudflare Pages Function Proxy for Overpass API requests.
 * Route: /api/overpass
 */

export async function onRequestPost(context) {
  const { request } = context;

  try {
    const body = await request.text();

    // Перелік публічних сервісів Overpass для почергового опитування
    const endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'BSMAP-App/2.0 (Cloudflare Worker Proxy)'
          },
          body: body,
          cf: {
            cacheTtl: 3600,
            cacheEverything: true
          }
        });

        if (response.ok) {
          const data = await response.arrayBuffer();
          return new Response(data, {
            status: 200,
            headers: {
              'Content-Type': response.headers.get('content-type') || 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'public, max-age=3600'
            }
          });
        }
      } catch (e) {
        // Продовжуємо спробу на наступному дзеркалі
      }
    }

    return new Response(
      JSON.stringify({ error: 'Всі дзеркала Overpass недоступні або перевищено таймаут.' }),
      {
        status: 504,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
