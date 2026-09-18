/**
 * Cloudflare Pages Function Proxy for Overpass API requests.
 * Route: /api/overpass
 */

export async function onRequestPost(context) {
  const { request } = context;

  try {
    const incoming = await request.text();
    const params = new URLSearchParams(incoming);
    const query = params.get('data') || incoming;
    if (!query || query.length > 100000 || !query.includes('[out:json]')) {
      return jsonResponse({ error: 'Некоректний або надто великий запит Overpass.' }, 400);
    }
    const body = 'data=' + encodeURIComponent(query);

    // Опитуємо mirrors паралельно: повільний сервіс не повинен блокувати всі інші.
    const endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.osm.ch/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.private.coffee/api/interpreter'
    ];
    const requests = endpoints.map(function(endpoint){
      const controller = new AbortController();
      const timeout = setTimeout(function(){ controller.abort(); }, 9000);
      return fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'BSMAP-App/2.0 (Cloudflare Pages; OSM address overlay)'
        },
        body: body,
        signal: controller.signal
      }).then(async function(response){
        clearTimeout(timeout);
        if (!response.ok) throw new Error('http ' + response.status);
        const data = await response.arrayBuffer();
        const parsed = JSON.parse(new TextDecoder().decode(data));
        if (!Array.isArray(parsed.elements)) throw new Error('invalid Overpass response');
        return { data: data, count: parsed.elements.length };
      }).catch(function(error){
        clearTimeout(timeout);
        throw error;
      });
    });

    const result = await firstUseful(requests);
    return new Response(result.data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      }
    });
  } catch (err) {
    return jsonResponse({ error: 'Сервіси адрес тимчасово недоступні. Спробуйте ще раз.' }, 504);
  }
}

async function firstUseful(promises) {
  const results = await Promise.allSettled(promises);
  const successful = results.filter(function(result){ return result.status === 'fulfilled'; });
  if (!successful.length) throw new Error('all Overpass mirrors failed');
  const useful = successful.find(function(result){ return result.value.count > 0; });
  return (useful || successful[0]).value;
}

function jsonResponse(value, status) {
  return new Response(JSON.stringify(value), {
    status: status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
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
