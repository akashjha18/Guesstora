export function validateLoginRequest(body) {
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '').trim();

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordOk = password.length >= 8;

  if (!emailOk || !passwordOk) {
    throw new Error('Valid email and password are required.');
  }

  return { email, password };
}
