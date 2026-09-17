export async function onRequest(context) {
  const { request, env } = context;

  const user = env.AUTH_USER;
  const pass = env.AUTH_PASS;
  const adminUser = env.AUTH_ADMIN;
  const adminPass = env.AUTH_ADPASS;

  // Блокуємо сайт, якщо змінні оточення взагалі не налаштовані
  if ((!user || !pass) && (!adminUser || !adminPass)) {
    return new Response(
      'Сайт не налаштовано: відсутні змінні середовища для авторизації.',
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('Authorization') || '';
  const [scheme, encoded] = authHeader.split(' ');

  if (scheme === 'Basic' && encoded) {
    const isUserValid = user && pass && (await isValid(encoded, user, pass));
    const isAdminValid = adminUser && adminPass && (await isValid(encoded, adminUser, adminPass));

    if (isUserValid || isAdminValid) {
      // Можна передавати роль далі в запит (наприклад, для API або бекенду)
      const newHeaders = new Headers(request.headers);
      newHeaders.set('X-Auth-Role', isAdminValid ? 'admin' : 'user');

      return context.next(new Request(request, { headers: newHeaders }));
    }
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

async function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const [digestA, digestB] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const bytesA = new Uint8Array(digestA);
  const bytesB = new Uint8Array(digestB);
  
  if (bytesA.length !== bytesB.length) return false;
  
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) diff |= bytesA[i] ^ bytesB[i];
  return diff === 0;
}
