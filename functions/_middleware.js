/**
 * Cloudflare Pages Functions middleware.
 * Runs on every request to the site (it sits in /functions at the project
 * root, so its scope is "/*"). It requires HTTP Basic Auth before letting
 * any request through to the static files in /public.
 *
 * Credentials are read from Pages environment variables / secrets:
 *   AUTH_USER  – login
 *   AUTH_PASS  – password
 *
 * Set them with:
 *   npx wrangler pages secret put AUTH_USER
 *   npx wrangler pages secret put AUTH_PASS
 * or via the Cloudflare dashboard → Pages project → Settings → Environment variables.
 *
 * Basic Auth is sent in cleartext-equivalent (base64) but Cloudflare Pages
 * terminates TLS on every request, so credentials are protected in transit
 * as long as you don't disable HTTPS. Browsers cache the credentials for
 * the session once entered, so the user only sees the native login prompt once.
 */

export async function onRequest(context) {
  const { request, env } = context;

  const expectedUser = env.AUTH_USER;
  const expectedPass = env.AUTH_PASS;

  // Fail closed: if the secrets were never configured, block everything
  // rather than silently serving the app without protection.
  if (!expectedUser || !expectedPass) {
    return new Response(
      'Сайт не налаштовано: відсутні змінні середовища AUTH_USER / AUTH_PASS.',
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('Authorization') || '';
  const [scheme, encoded] = authHeader.split(' ');

  if (scheme === 'Basic' && encoded && (await isValid(encoded, expectedUser, expectedPass))) {
    return context.next();
  }

  return new Response('Потрібна авторизація / Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="BSMAP", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

async function isValid(encoded, expectedUser, expectedPass) {
  let decoded;
  try {
    decoded = atob(encoded);
  } catch {
    return false;
  }
  const idx = decoded.indexOf(':');
  if (idx === -1) return false;
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);

  const [userOk, passOk] = await Promise.all([
    timingSafeEqual(user, expectedUser),
    timingSafeEqual(pass, expectedPass),
  ]);
  return userOk && passOk;
}

// Constant-time string comparison (via SHA-256 digests) so response timing
// doesn't leak how many characters of the login/password were correct.
async function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const [digestA, digestB] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const bytesA = new Uint8Array(digestA);
  const bytesB = new Uint8Array(digestB);
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) diff |= bytesA[i] ^ bytesB[i];
  return diff === 0;
}
