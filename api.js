// Schlanker Supabase-Client ohne Abhängigkeiten: Login, Datenbank (PostgREST), Passwort.
export const SUPABASE_URL = 'https://ggkvvsjornrzzmoxbcsn.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_vmJt7J9xVB7ovyQcOxZPRA__STAIpy6';
const STORE = 'finanzen.session';

let session = null;
try { session = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { session = null; }

function save(s) {
  session = s;
  try { s ? localStorage.setItem(STORE, JSON.stringify(s)) : localStorage.removeItem(STORE); } catch (e) { /* privat */ }
}

export const auth = {
  get user() { return session && session.user; },
  get eingeloggt() { return !!session; },
  async login(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error_description === 'Invalid login credentials' || j.msg === 'Invalid login credentials'
      ? 'E-Mail oder Passwort stimmt nicht.' : (j.error_description || j.msg || 'Anmeldung fehlgeschlagen.'));
    save({ ...j, expires_at: Math.floor(Date.now() / 1000) + j.expires_in });
  },
  async refresh() {
    if (!session) return;
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!r.ok) { save(null); throw new Error('Bitte erneut anmelden.'); }
    const j = await r.json();
    save({ ...j, expires_at: Math.floor(Date.now() / 1000) + j.expires_in });
  },
  async token() {
    if (!session) throw new Error('Nicht angemeldet.');
    if (session.expires_at - 60 < Date.now() / 1000) await this.refresh();
    return session.access_token;
  },
  async passwortAendern(neu) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: neu }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.msg || j.error_description || 'Passwort konnte nicht geändert werden.');
  },
  logout() { save(null); },
};

async function call(method, path, body, prefer) {
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${await auth.token()}`, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  let r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401) {
    await auth.refresh();
    headers.Authorization = `Bearer ${await auth.token()}`;
    r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  }
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.message || `Fehler ${r.status}`);
  }
  if (r.status === 204) return null;
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

export const db = {
  select: (table, query = 'select=*') => call('GET', `${table}?${query}`),
  insert: (table, rows) => call('POST', table, rows, 'return=representation'),
  upsertIgnore: (table, rows, conflict) => call('POST', `${table}?on_conflict=${conflict}`, rows, 'return=representation,resolution=ignore-duplicates'),
  update: (table, id, values) => call('PATCH', `${table}?id=eq.${id}`, values, 'return=representation'),
  remove: (table, id) => call('DELETE', `${table}?id=eq.${id}`),
  upsertKey: (table, rows) => call('POST', table, rows, 'return=representation,resolution=merge-duplicates'),
};

// Datenbank-Funktionen (RPC)
export async function rpc(name, body) {
  const headers = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.token()}` };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error((j && j.message) || `Fehler ${r.status}`);
  return j;
}
