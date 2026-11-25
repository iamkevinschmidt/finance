import { auth, db } from './api.js';
import { BEREICHE, KATEGORIEN, parseCsv } from './kategorien.js';
import { simulieren, restschuld, monatPlus } from './rechner.js';

// ---------- Hilfen ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const h = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eurF = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eurF2 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const eur = (x) => eurF.format(Math.round(Number(x) || 0));
const eur2 = (x) => eurF2.format(Number(x) || 0);
const num = (x) => { const n = parseFloat(String(x ?? '').replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MONL = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const ymNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const ymLang = (ym) => (ym ? `${MONL[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}` : '–');
const ymKurz = (ym) => (ym ? `${MON[+ym.slice(5, 7) - 1]} ${ym.slice(2, 4)}` : '–');
const dt = (s) => (s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : '');
const ZAEHLT = (k) => KATEGORIEN[k] && KATEGORIEN[k] !== 'intern';

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2600);
}

// ---------- Daten ----------
const S = { ich: null, konten: [], posten: [], buchungen: [], ziele: [], massnahmen: [], szenarien: [], einst: {}, geladen: false };
const istAdmin = () => S.ich?.rolle === 'admin';

async function laden() {
  const [ich, konten, posten, buchungen, ziele, massnahmen, szenarien, einst] = await Promise.all([
    db.select('fin_mitglieder', `select=*&user_id=eq.${auth.user.id}`),
    db.select('fin_konten', 'select=*&order=sort'),
    db.select('fin_posten', 'select=*&order=sort'),
    db.select('fin_buchungen', 'select=id,datum,konto,empfaenger,zweck,betrag,kategorie&order=datum.desc&limit=5000'),
    db.select('fin_ziele', 'select=*&order=sort'),
    db.select('fin_massnahmen', 'select=*&order=monat.asc.nullslast,erstellt'),
    db.select('fin_szenarien', 'select=*&order=erstellt.desc'),
    db.select('fin_einstellungen', 'select=*'),
  ]);
  S.ich = ich[0] || null;
  Object.assign(S, { konten, posten, buchungen, ziele, massnahmen, szenarien, einst: Object.fromEntries(einst.map((e) => [e.schluessel, e.wert])), geladen: true });
}

// ---------- Kennzahlen ----------
const ngZiel = () => Number(S.einst.notgroschen_ziel) || 10000;
const kredit = () => S.konten.find((k) => k.art === 'kredit');
function kreditHeute() {
  const k = kredit(); if (!k) return 0;
  const heute = new Date();
  // Rate wird zum Monatsende fällig: bis zum letzten abgeschlossenen Monat rechnen
  const bis = heute.getDate() >= 30 ? ymNow() : monatPlus(ymNow(), -1);
  return restschuld(Math.abs(Number(k.saldo)), k.stand.slice(0, 7), bis, Number(k.zins) || 0, Number(k.rate) || 0);
}
const ruecklage = () => S.konten.filter((k) => k.zaehlt_als_notgroschen).reduce((s, k) => s + Number(k.saldo), 0);
const vermoegen = () => S.konten.filter((k) => k.art !== 'kredit').reduce((s, k) => s + Number(k.saldo), 0) - kreditHeute();
const aktivePosten = (typ) => S.posten.filter((p) => p.aktiv && p.typ === typ);
const summe = (l, f = 'betrag') => l.reduce((s, p) => s + Number(p[f] ?? p.betrag ?? 0), 0);
function plan(feld = 'betrag') {
  const ein = summe(aktivePosten('einnahme'));
  const aus = aktivePosten('ausgabe').reduce((s, p) => s + Number(feld === 'ziel' && p.ziel != null ? p.ziel : p.betrag), 0);
  const spar = summe(aktivePosten('sparen'));
  return { ein, aus, spar, frei: ein - aus };
}
// Ist je Kategorie in einem Monat (Ausgaben positiv)
function istMonat(ym) {
  const m = {};
  for (const b of S.buchungen) if (b.datum.startsWith(ym) && ZAEHLT(b.kategorie)) m[b.kategorie] = (m[b.kategorie] || 0) - Number(b.betrag);
  return m;
}
function monatsreihe(n) {
  const letzte = S.buchungen[0]?.datum?.slice(0, 7) || ymNow();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const ym = monatPlus(letzte, -i);
    let ein = 0, aus = 0;
    for (const b of S.buchungen) if (b.datum.startsWith(ym) && ZAEHLT(b.kategorie)) { if (KATEGORIEN[b.kategorie] === 'einnahmen') ein += Number(b.betrag); else aus -= Number(b.betrag); }
    out.push({ ym, ein, aus });
  }
  return out;
}

// ---------- Rahmen ----------
const ROUTEN = { '': start, budget, szenarien, plan: planSeite, buchungen, mehr };
function tabs(akt) {
  const n = $('#tabs'); n.hidden = false;
  $$('a', n).forEach((a) => a.setAttribute('aria-current', a.dataset.tab === akt ? 'page' : 'false'));
}
function seite(tab, titel, sub, inhalt) {
  tabs(tab);
  $('#app').innerHTML = `<div class="wrap"><header class="top"><div><h1>${h(titel)}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${istAdmin() ? '' : '<span class="pill">Nur lesen</span>'}</header>${inhalt}</div>`;
  window.scrollTo(0, 0);
}
async function route() {
  if (!auth.eingeloggt) return login();
  try { if (!S.geladen) await laden(); } catch (e) { return fehler(e); }
  if (!S.ich) return keinZugang();
  const [pfad, arg] = location.hash.replace(/^#\/?/, '').split('/');
  (ROUTEN[pfad] || start)(arg);
}
window.addEventListener('hashchange', route);
function fehler(e) {
  $('#tabs').hidden = true;
  $('#app').innerHTML = `<div class="wrap"><div class="card"><h2>Laden hat nicht geklappt</h2><p>${h(e.message)}</p><button class="btn" id="nochmal">Nochmal versuchen</button> <button class="btn ghost" id="aus">Abmelden</button></div></div>`;
  $('#nochmal').onclick = () => route();
  $('#aus').onclick = () => { auth.logout(); S.geladen = false; route(); };
}
function keinZugang() {
  $('#tabs').hidden = true;
  $('#app').innerHTML = `<div class="wrap"><div class="card"><h2>Kein Zugang</h2><p>Dein Konto ist angemeldet, aber noch nicht für die Finanzen freigeschaltet. Kevin kann das für dich erledigen.</p><button class="btn ghost" id="aus">Abmelden</button></div></div>`;
  $('#aus').onclick = () => { auth.logout(); S.geladen = false; route(); };
}
function login() {
  $('#tabs').hidden = true;
  $('#app').innerHTML = `<div class="login"><div class="mark">€</div><h1>Finanzen</h1><p class="sub">Familie Schmidt</p>
  <form id="lf" class="card form"><label>E-Mail<input id="em" type="email" autocomplete="username" required></label>
  <label>Passwort<input id="pw" type="password" autocomplete="current-password" required></label>
  <button class="btn" type="submit">Anmelden</button><p class="err" id="err" hidden></p></form></div>`;
  $('#lf').onsubmit = async (ev) => {
    ev.preventDefault(); const err = $('#err'); err.hidden = true;
    try { await auth.login($('#em').value, $('#pw').value); S.geladen = false; route(); } catch (e) { err.textContent = e.message; err.hidden = false; }
  };
}

// ---------- Bausteine ----------
const kpi = (l, v, s = '', cls = '') => `<div class="kpi ${cls}"><div class="l">${l}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
const balken = (wert, max, cls = '') => `<div class="bar ${cls}"><span style="width:${Math.max(0, Math.min(100, (wert / (max || 1)) * 100)).toFixed(1)}%"></span></div>`;
function sheet(titel, inhalt, onSave, onDelete) {
  const d = document.createElement('dialog'); d.className = 'sheet';
  d.innerHTML = `<form method="dialog" class="form"><div class="sheet-head"><h2>${h(titel)}</h2><button value="x" class="x" aria-label="Schließen">✕</button></div>${inhalt}
  <div class="actions">${onDelete ? '<button type="button" class="btn ghost danger" id="del">Löschen</button>' : ''}<button type="submit" class="btn" id="ok" value="ok">Speichern</button></div></form>`;
  document.body.appendChild(d); d.showModal();
  d.addEventListener('close', () => d.remove());
  $('form', d).onsubmit = async (ev) => {
    if (ev.submitter?.value === 'x') return;
    ev.preventDefault();
    try { await onSave(d); d.close(); } catch (e) { toast(e.message); }
  };
  if (onDelete) $('#del', d).onclick = async () => { if ($('#del', d).dataset.sicher) { try { await onDelete(); d.close(); } catch (e) { toast(e.message); } } else { $('#del', d).dataset.sicher = 1; $('#del', d).textContent = 'Wirklich löschen?'; } };
  return d;
}
const feld = (id, label, wert = '', typ = 'text', extra = '') => `<label>${label}<input id="${id}" type="${typ}" value="${h(wert)}" ${extra}></label>`;
const auswahl = (id, label, opts, wert) => `<label>${label}<select id="${id}">${opts.map(([v, t]) => `<option value="${h(v)}"${String(v) === String(wert) ? ' selected' : ''}>${h(t)}</option>`).join('')}</select></label>`;

// ---------- Übersicht ----------
function start() {
  const rl = ruecklage(), ziel = ngZiel(), ks = kreditHeute(), k = kredit(), p = plan();
  const sim = simulieren(basisParameter());
  const reihe = monatsreihe(6);
  const maxM = Math.max(...reihe.map((r) => Math.max(r.ein, r.aus)), 1);
  const letzter = S.buchungen[0]?.datum;
  const ym = letzter ? letzter.slice(0, 7) : ymNow();
  const ist = istMonat(ym);
  const flex = aktivePosten('ausgabe').filter((x) => x.ziel != null).map((x) => ({ ...x, ist: ist[x.kategorie] || 0 }));
  seite('start', 'Finanzen', `Stand ${dt(new Date().toISOString().slice(0, 10))}`, `
  <div class="kpis">
    ${kpi('Vermögen netto', eur(vermoegen()), 'Konten + Depot − Kredit', 'hero')}
    ${kpi('Notgroschen', eur(rl), `${Math.round((rl / ziel) * 100)} % von ${eur(ziel)}`)}
    ${kpi('Kredit offen', eur(ks), k ? `${eur(k.rate)}/Monat, ${String(k.zins).replace('.', ',')} %` : '')}
    ${kpi('Plan pro Monat', eur(p.frei), 'übrig nach allen Ausgaben')}
    ${kpi('Notgroschen voll', ymKurz(sim.ngVoll), sim.kreditFrei ? `Kredit frei ${ymKurz(sim.kreditFrei)}` : 'Kredit frei nach 2032')}
  </div>
  <section class="card"><h2>Notgroschen</h2>${balken(rl, ziel, 'ok')}<div class="row2"><span>${eur(rl)}</span><span class="muted">Ziel ${eur(ziel)}</span></div></section>
  <section class="card"><h2>Ein und aus pro Monat</h2><p class="note">Aus euren Kontoumsätzen. Umbuchungen und ETF-Käufe zählen nicht.</p>
    <div class="months">${reihe.map((r) => `<div class="mcol"><div class="mbars"><span class="in" style="height:${(r.ein / maxM) * 100}%"></span><span class="out" style="height:${(r.aus / maxM) * 100}%"></span></div><div class="ml">${MON[+r.ym.slice(5) - 1]}</div><div class="mv ${r.ein - r.aus < 0 ? 'neg' : 'pos'}">${eur(r.ein - r.aus)}</div></div>`).join('')}</div>
    <div class="legend"><span><i class="in"></i>Einnahmen</span><span><i class="out"></i>Ausgaben</span></div></section>
  <section class="card"><h2>Budget ${ymLang(ym)}</h2><p class="note">Flexible Posten: Ist gegen Ziel.${letzter ? ` Umsätze bis ${dt(letzter)}.` : ''}</p>
    <div class="list">${flex.map((x) => `<div class="brow"><div class="bt"><span>${h(x.kategorie)}</span><span class="${x.ist > x.ziel ? 'neg' : 'muted'}">${eur(x.ist)} / ${eur(x.ziel)}</span></div>${balken(x.ist, x.ziel, x.ist > x.ziel ? 'bad' : 'ok')}</div>`).join('') || '<p class="muted">Noch keine Budgetziele.</p>'}</div></section>
  <section class="card"><h2>Konten</h2><div class="list">${S.konten.map((k2) => `<div class="row"><div class="main"><div class="t">${h(k2.name)}</div><div class="m">Stand ${dt(k2.stand)}${k2.zaehlt_als_notgroschen ? ' · Notgroschen' : ''}</div></div><div class="r ${k2.art === 'kredit' ? 'neg' : ''}">${eur2(k2.art === 'kredit' ? -kreditHeute() : k2.saldo)}</div></div>`).join('')}</div>
    ${istAdmin() ? '<a class="link" href="#/mehr">Kontostände aktualisieren</a>' : ''}</section>`);
}

// ---------- Budget ----------
function budget() {
  const p = plan(), pz = plan('ziel');
  // Ø der letzten drei vollen Monate mit Umsätzen
  const letzter = S.buchungen[0]?.datum?.slice(0, 7);
  const monate = letzter ? [1, 2, 3].map((i) => monatPlus(letzter, -i)) : [];
  const schnitt = {};
  for (const ym of monate) for (const [k, v] of Object.entries(istMonat(ym))) schnitt[k] = (schnitt[k] || 0) + v / monate.length;
  const gruppen = {};
  for (const x of S.posten) (gruppen[x.typ === 'einnahme' ? 'einnahmen' : x.typ === 'sparen' ? 'sparen' : KATEGORIEN[x.kategorie] || 'einmalig'] ||= []).push(x);
  const reihenfolge = ['einnahmen', 'wohnen', 'vorsorge', 'kredit', 'auto', 'alltag', 'freizeit', 'einmalig', 'sparen'];
  seite('budget', 'Budget', 'Euer Monatsplan', `
  <div class="kpis">
    ${kpi('Einnahmen', eur(p.ein))}${kpi('Ausgaben', eur(p.aus))}
    ${kpi('Übrig', eur(p.frei), `davon ETF-Sparplan ${eur(p.spar)}`)}${kpi('Mit Budgetzielen', eur(pz.frei), `${pz.frei - p.frei >= 0 ? '+' : ''}${eur(pz.frei - p.frei)} pro Monat`)}
  </div>
  ${reihenfolge.filter((g) => gruppen[g]).map((g) => `<section class="card"><h2>${g === 'sparen' ? 'Sparen' : h(BEREICHE[g])}</h2>
    <div class="list">${gruppen[g].map((x) => `<button class="row as-btn" data-id="${x.id}" ${istAdmin() ? '' : 'disabled'}>
      <div class="main"><div class="t">${h(x.name)}${x.aktiv ? '' : ' <span class="pill">pausiert</span>'}</div><div class="m">${h(x.kategorie)}${schnitt[x.kategorie] != null && x.typ === 'ausgabe' ? ` · Ist Ø 3 Mon. ${eur(schnitt[x.kategorie])}` : ''}${x.notiz ? ` · ${h(x.notiz)}` : ''}</div></div>
      <div class="r">${eur(x.betrag)}${x.ziel != null && x.ziel !== x.betrag ? `<div class="m ok">Ziel ${eur(x.ziel)}</div>` : ''}</div></button>`).join('')}</div>
    <div class="row2 total"><span>Summe</span><span>${eur(summe(gruppen[g].filter((x) => x.aktiv)))}</span></div></section>`).join('')}
  ${istAdmin() ? '<button class="btn ghost" id="neu">Posten hinzufügen</button>' : ''}`);
  $$('[data-id]').forEach((b) => { b.onclick = () => postenBearbeiten(S.posten.find((x) => String(x.id) === b.dataset.id)); });
  if ($('#neu')) $('#neu').onclick = () => postenBearbeiten(null);
}
function postenBearbeiten(x) {
  const kats = Object.keys(KATEGORIEN).filter((k) => KATEGORIEN[k] !== 'intern' || k === 'Sparen & Investieren');
  sheet(x ? x.name : 'Neuer Posten', `
    ${feld('p-name', 'Bezeichnung', x?.name || '')}
    ${auswahl('p-typ', 'Art', [['ausgabe', 'Ausgabe'], ['einnahme', 'Einnahme'], ['sparen', 'Sparen']], x?.typ || 'ausgabe')}
    ${auswahl('p-kat', 'Kategorie', kats.map((k) => [k, k]), x?.kategorie || 'Sonstiges')}
    <div class="two">${feld('p-betrag', 'Betrag pro Monat', x ? String(x.betrag).replace('.', ',') : '', 'text', 'inputmode="decimal"')}
    ${feld('p-ziel', 'Budgetziel (optional)', x?.ziel != null ? String(x.ziel).replace('.', ',') : '', 'text', 'inputmode="decimal"')}</div>
    ${feld('p-notiz', 'Notiz', x?.notiz || '')}
    <label class="check"><input id="p-aktiv" type="checkbox" ${x?.aktiv === false ? '' : 'checked'}> Aktiv (zählt im Plan)</label>`,
  async (d) => {
    const v = { name: $('#p-name', d).value.trim(), typ: $('#p-typ', d).value, kategorie: $('#p-kat', d).value, betrag: num($('#p-betrag', d).value), ziel: $('#p-ziel', d).value.trim() ? num($('#p-ziel', d).value) : null, notiz: $('#p-notiz', d).value.trim() || null, aktiv: $('#p-aktiv', d).checked };
    if (!v.name) throw new Error('Bitte eine Bezeichnung eingeben.');
    if (x) Object.assign(x, (await db.update('fin_posten', x.id, v))[0]); else S.posten.push((await db.insert('fin_posten', [{ ...v, sort: S.posten.length * 10 }]))[0]);
    toast('Gespeichert'); budget();
  }, x ? async () => { await db.remove('fin_posten', x.id); S.posten = S.posten.filter((y) => y.id !== x.id); toast('Gelöscht'); budget(); } : null);
}

// ---------- Szenarien ----------
const postenBetrag = (kat) => summe(S.posten.filter((p) => p.aktiv && p.kategorie === kat));
function basisParameter() {
  const p = plan();
  return {
    start: monatPlus(ymNow(), 1), monate: 72,
    ruecklage: ruecklage(), ngZiel: ngZiel(),
    schuld: kreditHeute(), zins: Number(kredit()?.zins) || 0, rate: Number(kredit()?.rate) || 0,
    einnahmen: p.ein, ausgaben: p.aus - postenBetrag('Kredit'),
    phasen: [], einmal: [], sondertilgung: true,
  };
}
const VORLAGEN = {
  heute: { name: 'Wie heute', kevin: null, angelika: null, sonst: 0, ab: null, aus: 0, einmal: 0, einmalMonat: null, budget: false },
  budget: { name: 'Mit Budgetzielen', budget: true },
  jobweg: { name: 'Job endet, Arbeitslosengeld', kevin: 1800, ab: '2027-01', notiz: 'ALG I grob geschätzt, genauen Betrag bei der Agentur für Arbeit erfragen' },
  neu4: { name: 'Neuer Job 4.000 € netto', kevin: 4000, ab: '2027-02', budget: true },
};
function szenarien() {
  const b = basisParameter();
  const kevin0 = postenBetrag('Gehalt Kevin'), ang0 = postenBetrag('Gehalt Angelika');
  let w = { kevin: kevin0, angelika: ang0, sonst: 0, ab: b.start, aus: 0, einmal: 0, einmalMonat: b.start, budget: false, sondertilgung: true };
  try { const g = JSON.parse(sessionStorage.getItem('fin.szenario') || 'null'); if (g) w = { ...w, ...g }; } catch (e) { /* egal */ }
  const monate = Array.from({ length: 36 }, (_, i) => monatPlus(b.start, i));
  seite('szenarien', 'Szenarien', 'Was wäre, wenn …', `
  <div class="chips" id="vorlagen">${Object.entries(VORLAGEN).map(([k, v]) => `<button data-v="${k}">${h(v.name)}</button>`).join('')}
    ${S.szenarien.map((s) => `<button data-s="${s.id}">★ ${h(s.name)}</button>`).join('')}</div>
  <section class="card form" id="eingaben">
    <div class="two">${feld('s-kevin', 'Netto Kevin', Math.round(w.kevin), 'number', 'step="50" inputmode="numeric"')}
    ${feld('s-ang', 'Netto Angelika', Math.round(w.angelika), 'number', 'step="50" inputmode="numeric"')}</div>
    <div class="two">${auswahl('s-ab', 'Gehaltsänderung ab', monate.map((m) => [m, ymLang(m)]), w.ab)}
    ${feld('s-sonst', 'Weitere Einnahmen/Monat', w.sonst, 'number', 'step="50" inputmode="numeric"')}</div>
    <div class="two">${feld('s-aus', 'Ausgaben ändern um €/Monat', w.aus, 'number', 'step="25" inputmode="numeric"')}
    <label class="check"><input id="s-budget" type="checkbox" ${w.budget ? 'checked' : ''}> Budgetziele einhalten</label></div>
    <div class="two">${feld('s-einmal', 'Einmalzahlung (+ Abfindung / − Kauf)', w.einmal, 'number', 'step="100" inputmode="numeric"')}
    ${auswahl('s-einmalm', 'im Monat', monate.map((m) => [m, ymLang(m)]), w.einmalMonat)}</div>
    <label class="check"><input id="s-st" type="checkbox" ${w.sondertilgung ? 'checked' : ''}> Überschuss nach vollem Notgroschen in den Kredit</label>
  </section>
  <div id="ergebnis"></div>
  ${istAdmin() ? '<button class="btn ghost" id="speichern">Szenario speichern</button>' : ''}`);
  const lesen = () => ({
    kevin: num($('#s-kevin').value), angelika: num($('#s-ang').value), ab: $('#s-ab').value, sonst: num($('#s-sonst').value),
    aus: num($('#s-aus').value), budget: $('#s-budget').checked, einmal: num($('#s-einmal').value), einmalMonat: $('#s-einmalm').value, sondertilgung: $('#s-st').checked,
  });
  const rechnen = () => {
    const v = lesen();
    try { sessionStorage.setItem('fin.szenario', JSON.stringify(v)); } catch (e) { /* egal */ }
    const pz = plan('ziel');
    const p = {
      ...b, sondertilgung: v.sondertilgung,
      ausgaben: (v.budget ? pz.aus : plan().aus) - postenBetrag('Kredit') + v.aus,
      phasen: [{ ab: v.ab, einnahmenDelta: (v.kevin - kevin0) + (v.angelika - ang0) + v.sonst }],
      einmal: v.einmal ? [{ monat: v.einmalMonat, betrag: v.einmal }] : [],
    };
    const heute = simulieren({ ...b });
    const r = simulieren(p);
    const ab = r.reihe.find((x) => x.monat === v.ab) || r.reihe[0];
    const ueb = ab.ueberschuss;
    const reichweite = ueb < 0 ? Math.max(0, Math.floor((r.reihe[r.reihe.indexOf(ab) - 1]?.ruecklage ?? b.ruecklage) / -ueb)) : null;
    $('#ergebnis').innerHTML = `
      <div class="kpis">
        ${kpi(`Übrig pro Monat ab ${ymKurz(v.ab)}`, eur(ueb), ueb < 0 ? 'Ihr zehrt von der Rücklage' : 'inkl. ETF-Sparplan', ueb < 0 ? 'hero bad' : 'hero')}
        ${kpi('Notgroschen voll', ymKurz(r.ngVoll), heute.ngVoll && r.ngVoll !== heute.ngVoll ? `heute: ${ymKurz(heute.ngVoll)}` : '')}
        ${kpi('Kredit frei', r.kreditFrei ? ymKurz(r.kreditFrei) : 'nach 2032', heute.kreditFrei && r.kreditFrei !== heute.kreditFrei ? `heute: ${ymKurz(heute.kreditFrei)}` : 'mit Rate 282 €: Aug 32')}
        ${reichweite != null ? kpi('Rücklage reicht', `${reichweite} Monate`, r.ersterMinus ? `leer ab ${ymLang(r.ersterMinus)}` : '') : kpi('In 3 Jahren', eur(r.reihe[35].ruecklage + r.reihe[35].eigenkapital - r.reihe[35].schuld), 'Rücklage + Eigenkapital − Kredit')}
      </div>
      <section class="card"><h2>Verlauf</h2><p class="note">Rücklage (grün), Kredit (rot) und Eigenkapital (blau) über drei Jahre.</p>${chart(r.reihe.slice(0, 36))}</section>
      ${r.ersterMinus ? `<section class="card warn"><h2>Achtung</h2><p>In diesem Szenario ist die Rücklage ab ${ymLang(r.ersterMinus)} aufgebraucht. Dann bräuchtet ihr ${eur(-ueb)} pro Monat weniger Ausgaben oder mehr Einnahmen.</p></section>` : ''}`;
  };
  $('#eingaben').addEventListener('input', rechnen);
  $('#eingaben').addEventListener('change', rechnen);
  const setzen = (v) => {
    const w2 = { kevin: kevin0, angelika: ang0, sonst: 0, ab: b.start, aus: 0, einmal: 0, einmalMonat: b.start, budget: false, sondertilgung: true, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x != null)) };
    $('#s-kevin').value = Math.round(w2.kevin); $('#s-ang').value = Math.round(w2.angelika); $('#s-sonst').value = w2.sonst; $('#s-aus').value = w2.aus;
    $('#s-budget').checked = !!w2.budget; $('#s-einmal').value = w2.einmal; $('#s-st').checked = w2.sondertilgung !== false;
    if (monate.includes(w2.ab)) $('#s-ab').value = w2.ab; if (monate.includes(w2.einmalMonat)) $('#s-einmalm').value = w2.einmalMonat;
    rechnen(); if (v.notiz) toast(v.notiz);
  };
  $$('#vorlagen [data-v]').forEach((btn) => { btn.onclick = () => setzen(VORLAGEN[btn.dataset.v]); });
  $$('#vorlagen [data-s]').forEach((btn) => { btn.onclick = () => setzen(S.szenarien.find((s) => String(s.id) === btn.dataset.s).werte); });
  if ($('#speichern')) $('#speichern').onclick = () => sheet('Szenario speichern', feld('sz-name', 'Name', ''), async (d) => {
    const name = $('#sz-name', d).value.trim(); if (!name) throw new Error('Bitte einen Namen eingeben.');
    S.szenarien.unshift((await db.insert('fin_szenarien', [{ name, werte: lesen() }]))[0]); toast('Gespeichert'); szenarien();
  });
  rechnen();
}
function chart(reihe) {
  const W = 640, H = 220, L = 46, R = 8, T = 10, B = 24;
  const max = Math.max(...reihe.map((r) => Math.max(r.ruecklage, r.schuld, r.eigenkapital)), 1000);
  const min = Math.min(0, ...reihe.map((r) => r.ruecklage));
  const x = (i) => L + (i / (reihe.length - 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const pfad = (f) => reihe.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r[f]).toFixed(1)}`).join('');
  const ticks = [min, 0, max / 2, max].filter((v, i, a) => a.indexOf(v) === i);
  const k = (v) => `${Math.round(v / 1000)} T€`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Verlauf von Rücklage, Kredit und Eigenkapital">
    ${ticks.map((t) => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${k(t)}</text>`).join('')}
    ${reihe.map((r, i) => (r.monat.endsWith('-01') ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${r.monat.slice(0, 4)}</text>` : '')).join('')}
    <line x1="${L}" x2="${W - R}" y1="${y(ngZiel())}" y2="${y(ngZiel())}" class="ref"/>
    <path d="${pfad('schuld')}" class="l-bad"/><path d="${pfad('eigenkapital')}" class="l-info"/><path d="${pfad('ruecklage')}" class="l-ok"/></svg>`;
}

// ---------- Plan ----------
const ZSTATUS = { offen: 'Später', aktiv: 'Läuft', erreicht: 'Erreicht' };
function planSeite() {
  const offen = S.massnahmen.filter((m) => m.status === 'offen'), fertig = S.massnahmen.filter((m) => m.status === 'erledigt');
  const wirkung = offen.reduce((s, m) => s + (Number(m.wirkung) || 0), 0);
  seite('plan', 'Plan', 'Ziele und Maßnahmen', `
  <section class="card"><h2>Ziele</h2><div class="list">${S.ziele.map((z) => `<button class="row as-btn" data-z="${z.id}" ${istAdmin() ? '' : 'disabled'}><div class="main"><div class="t">${h(z.name)}</div><div class="m">${z.zielbetrag ? eur(z.zielbetrag) : ''}${z.zieldatum ? ` · bis ${dt(z.zieldatum)}` : ''}${z.notiz ? ` · ${h(z.notiz)}` : ''}</div></div><span class="pill z-${z.status}">${ZSTATUS[z.status]}</span></button>`).join('')}</div>
  ${istAdmin() ? '<button class="link as-link" id="zneu">Ziel hinzufügen</button>' : ''}</section>
  <section class="card"><h2>Maßnahmen</h2>${wirkung ? `<p class="note">Offene Maßnahmen bringen zusammen ${eur(wirkung)} pro Monat.</p>` : ''}
    <div class="list">${offen.map(massnahmeZeile).join('') || '<p class="muted">Nichts offen.</p>'}</div>
    ${istAdmin() ? '<button class="link as-link" id="mneu">Maßnahme hinzufügen</button>' : ''}</section>
  ${fertig.length ? `<section class="card"><h2>Erledigt</h2><div class="list">${fertig.map(massnahmeZeile).join('')}</div></section>` : ''}`);
  $$('[data-z]').forEach((b) => { b.onclick = () => zielBearbeiten(S.ziele.find((z) => String(z.id) === b.dataset.z)); });
  $$('[data-m]').forEach((b) => { b.onclick = () => massnahmeBearbeiten(S.massnahmen.find((z) => String(z.id) === b.dataset.m)); });
  $$('[data-hak]').forEach((b) => { b.onclick = async (ev) => {
    ev.stopPropagation(); if (!istAdmin()) return;
    const m = S.massnahmen.find((z) => String(z.id) === b.dataset.hak);
    Object.assign(m, (await db.update('fin_massnahmen', m.id, { status: m.status === 'offen' ? 'erledigt' : 'offen' }))[0]); planSeite();
  }; });
  if ($('#zneu')) $('#zneu').onclick = () => zielBearbeiten(null);
  if ($('#mneu')) $('#mneu').onclick = () => massnahmeBearbeiten(null);
}
const massnahmeZeile = (m) => `<div class="row"><button class="hak ${m.status === 'erledigt' ? 'an' : ''}" data-hak="${m.id}" aria-label="Erledigt umschalten">${m.status === 'erledigt' ? '✓' : ''}</button>
  <button class="main as-btn plain" data-m="${m.id}" ${istAdmin() ? '' : 'disabled'}><div class="t">${h(m.titel)}</div><div class="m">${m.monat ? ymLang(m.monat) : 'ohne Termin'}${m.wirkung ? ` · ${eur(m.wirkung)}/Monat` : ''}${m.notiz ? ` · ${h(m.notiz)}` : ''}</div></button></div>`;
function zielBearbeiten(z) {
  sheet(z ? z.name : 'Neues Ziel', `${feld('z-name', 'Ziel', z?.name || '')}
    <div class="two">${feld('z-betrag', 'Betrag (optional)', z?.zielbetrag ?? '', 'number', 'inputmode="numeric"')}${feld('z-datum', 'Bis (optional)', z?.zieldatum || '', 'date')}</div>
    ${auswahl('z-status', 'Status', Object.entries(ZSTATUS), z?.status || 'offen')}${feld('z-notiz', 'Notiz', z?.notiz || '')}`,
  async (d) => {
    const v = { name: $('#z-name', d).value.trim(), zielbetrag: $('#z-betrag', d).value ? num($('#z-betrag', d).value) : null, zieldatum: $('#z-datum', d).value || null, status: $('#z-status', d).value, notiz: $('#z-notiz', d).value.trim() || null };
    if (!v.name) throw new Error('Bitte das Ziel benennen.');
    if (z) Object.assign(z, (await db.update('fin_ziele', z.id, v))[0]); else S.ziele.push((await db.insert('fin_ziele', [{ ...v, sort: S.ziele.length * 10 }]))[0]);
    planSeite();
  }, z ? async () => { await db.remove('fin_ziele', z.id); S.ziele = S.ziele.filter((x) => x.id !== z.id); planSeite(); } : null);
}
function massnahmeBearbeiten(m) {
  const monate = Array.from({ length: 24 }, (_, i) => monatPlus(monatPlus(ymNow(), -1), i));
  sheet(m ? 'Maßnahme' : 'Neue Maßnahme', `${feld('m-titel', 'Was', m?.titel || '')}
    <div class="two">${auswahl('m-monat', 'Wann', [['', 'ohne Termin'], ...monate.map((x) => [x, ymLang(x)])], m?.monat || '')}
    ${feld('m-wirkung', 'Wirkung €/Monat (optional)', m?.wirkung ?? '', 'number', 'inputmode="numeric"')}</div>${feld('m-notiz', 'Notiz', m?.notiz || '')}`,
  async (d) => {
    const v = { titel: $('#m-titel', d).value.trim(), monat: $('#m-monat', d).value || null, wirkung: $('#m-wirkung', d).value ? num($('#m-wirkung', d).value) : null, notiz: $('#m-notiz', d).value.trim() || null };
    if (!v.titel) throw new Error('Bitte beschreiben, was zu tun ist.');
    if (m) Object.assign(m, (await db.update('fin_massnahmen', m.id, v))[0]); else S.massnahmen.push((await db.insert('fin_massnahmen', [v]))[0]);
    planSeite();
  }, m ? async () => { await db.remove('fin_massnahmen', m.id); S.massnahmen = S.massnahmen.filter((x) => x.id !== m.id); planSeite(); } : null);
}

// ---------- Buchungen ----------
let filter = { monat: '', kat: '', q: '' };
function buchungen() {
  const monate = [...new Set(S.buchungen.map((b) => b.datum.slice(0, 7)))];
  if (!filter.monat && monate[0]) filter.monat = monate[0];
  seite('mehr', 'Umsätze', `${S.buchungen.length.toLocaleString('de-DE')} Buchungen`, `
  <section class="card form"><div class="two">${auswahl('f-monat', 'Monat', [['', 'Alle'], ...monate.map((m) => [m, ymLang(m)])], filter.monat)}
    ${auswahl('f-kat', 'Kategorie', [['', 'Alle'], ...Object.keys(KATEGORIEN).map((k) => [k, k])], filter.kat)}</div>
    ${feld('f-q', 'Suchen', filter.q, 'search', 'placeholder="z. B. Rewe, Tankstelle"')}</section>
  <section class="card"><div id="kopf" class="row2 total"></div><div class="list" id="liste"></div></section>`);
  const zeichnen = () => {
    filter = { monat: $('#f-monat').value, kat: $('#f-kat').value, q: $('#f-q').value.trim().toLowerCase() };
    const l = S.buchungen.filter((b) => (!filter.monat || b.datum.startsWith(filter.monat)) && (!filter.kat || b.kategorie === filter.kat) && (!filter.q || `${b.empfaenger} ${b.zweck} ${b.kategorie}`.toLowerCase().includes(filter.q)));
    const zaehlend = l.filter((b) => ZAEHLT(b.kategorie));
    const ein = zaehlend.filter((b) => b.betrag > 0).reduce((s, b) => s + Number(b.betrag), 0), aus = zaehlend.filter((b) => b.betrag < 0).reduce((s, b) => s + Number(b.betrag), 0);
    $('#kopf').innerHTML = `<span>${l.length} Umsätze</span><span><span class="pos">${eur(ein)}</span> · <span class="neg">${eur(aus)}</span></span>`;
    $('#liste').innerHTML = l.slice(0, 300).map((b) => `<button class="row as-btn" data-b="${b.id}" ${istAdmin() ? '' : 'disabled'}><div class="main"><div class="t">${h(b.empfaenger || '–')}</div><div class="m">${dt(b.datum)} · ${h(b.kategorie)} · ${h(b.konto)}</div></div><div class="r ${b.betrag < 0 ? '' : 'pos'}">${eur2(b.betrag)}</div></button>`).join('') + (l.length > 300 ? '<p class="muted">Die ersten 300 angezeigt. Filter nutzen für mehr.</p>' : '');
    $$('[data-b]').forEach((btn) => { btn.onclick = () => buchungBearbeiten(S.buchungen.find((b) => String(b.id) === btn.dataset.b)); });
  };
  ['#f-monat', '#f-kat', '#f-q'].forEach((s) => $(s).addEventListener('input', zeichnen));
  zeichnen();
}
function buchungBearbeiten(b) {
  sheet('Umsatz', `<p><b>${h(b.empfaenger)}</b><br><span class="muted">${dt(b.datum)} · ${h(b.konto)} · ${eur2(b.betrag)}</span></p>${b.zweck ? `<p class="muted small">${h(b.zweck)}</p>` : ''}
    ${auswahl('b-kat', 'Kategorie', Object.keys(KATEGORIEN).map((k) => [k, `${k} (${BEREICHE[KATEGORIEN[k]]})`]), b.kategorie)}`,
  async (d) => { Object.assign(b, (await db.update('fin_buchungen', b.id, { kategorie: $('#b-kat', d).value, manuell: true }))[0]); toast('Kategorie geändert'); buchungen(); });
}

// ---------- Mehr ----------
function mehr() {
  seite('mehr', 'Mehr', h(S.ich.name), `
  <section class="card"><a class="row" href="#/buchungen"><div class="main"><div class="t">Alle Umsätze</div><div class="m">${S.buchungen.length.toLocaleString('de-DE')} Buchungen, suchen und zuordnen</div></div><div class="r">›</div></a></section>
  ${istAdmin() ? `<section class="card"><h2>Kontoauszug einlesen</h2><p class="note">CSV-Export der Sparkasse (oder DKB). Bereits vorhandene Umsätze werden übersprungen, neue automatisch einsortiert.</p>
    <label class="btn file">CSV-Datei wählen<input id="csv" type="file" accept=".csv,text/csv" hidden></label><div id="import"></div></section>
  <section class="card"><h2>Kontostände</h2><p class="note">Tippen zum Aktualisieren.</p><div class="list">${S.konten.map((k) => `<button class="row as-btn" data-k="${k.id}"><div class="main"><div class="t">${h(k.name)}</div><div class="m">Stand ${dt(k.stand)}${k.notiz ? ` · ${h(k.notiz)}` : ''}</div></div><div class="r">${eur2(k.saldo)}</div></button>`).join('')}</div>
    <button class="link as-link" id="kneu">Konto hinzufügen</button></section>
  <section class="card form"><h2>Notgroschen-Ziel</h2>${feld('ngz', 'Ziel in €', ngZiel(), 'number', 'step="500" inputmode="numeric"')}<button class="btn ghost" id="ngzs">Speichern</button></section>` : ''}
  <section class="card"><h2>Konto</h2><p class="muted">${h(auth.user.email)} · ${istAdmin() ? 'Verwalter' : 'Nur lesen'}</p>
    <div class="actions"><button class="btn ghost" id="pw">Passwort ändern</button><button class="btn ghost" id="neuladen">Neu laden</button><button class="btn ghost" id="aus">Abmelden</button></div></section>`);
  $('#aus').onclick = () => { auth.logout(); S.geladen = false; route(); };
  $('#neuladen').onclick = async () => { S.geladen = false; await route(); toast('Aktualisiert'); };
  $('#pw').onclick = () => sheet('Passwort ändern', feld('npw', 'Neues Passwort (mind. 8 Zeichen)', '', 'password', 'autocomplete="new-password" minlength="8"'), async (d) => { await auth.passwortAendern($('#npw', d).value); toast('Passwort geändert'); });
  if (!istAdmin()) return;
  $('#csv').onchange = (ev) => importieren(ev.target.files[0]);
  $$('[data-k]').forEach((b) => { b.onclick = () => kontoBearbeiten(S.konten.find((k) => String(k.id) === b.dataset.k)); });
  $('#kneu').onclick = () => kontoBearbeiten(null);
  $('#ngzs').onclick = async () => { const w = num($('#ngz').value); await db.upsertKey('fin_einstellungen', [{ schluessel: 'notgroschen_ziel', wert: w }]); S.einst.notgroschen_ziel = w; toast('Gespeichert'); };
}
const ARTEN = { giro: 'Girokonto', tagesgeld: 'Tagesgeld / Cash', depot: 'Depot', kredit: 'Kredit', sonstiges: 'Sonstiges' };
function kontoBearbeiten(k) {
  sheet(k ? k.name : 'Neues Konto', `${feld('k-name', 'Name', k?.name || '')}${auswahl('k-art', 'Art', Object.entries(ARTEN), k?.art || 'giro')}
    <div class="two">${feld('k-saldo', k?.art === 'kredit' ? 'Restschuld (negativ)' : 'Kontostand', k ? String(k.saldo).replace('.', ',') : '', 'text', 'inputmode="decimal"')}${feld('k-stand', 'Stand vom', k?.stand || new Date().toISOString().slice(0, 10), 'date')}</div>
    <div class="two">${feld('k-zins', 'Zins % p. a.', k?.zins ?? '', 'text', 'inputmode="decimal"')}${feld('k-rate', 'Monatsrate (Kredit)', k?.rate ?? '', 'text', 'inputmode="decimal"')}</div>
    <label class="check"><input id="k-ng" type="checkbox" ${k?.zaehlt_als_notgroschen ? 'checked' : ''}> Zählt zum Notgroschen</label>${feld('k-notiz', 'Notiz', k?.notiz || '')}`,
  async (d) => {
    const v = { name: $('#k-name', d).value.trim(), art: $('#k-art', d).value, saldo: num($('#k-saldo', d).value), stand: $('#k-stand', d).value, zins: $('#k-zins', d).value ? num($('#k-zins', d).value) : null, rate: $('#k-rate', d).value ? num($('#k-rate', d).value) : null, zaehlt_als_notgroschen: $('#k-ng', d).checked, notiz: $('#k-notiz', d).value.trim() || null };
    if (!v.name) throw new Error('Bitte einen Namen eingeben.');
    if (k) Object.assign(k, (await db.update('fin_konten', k.id, v))[0]); else S.konten.push((await db.insert('fin_konten', [{ ...v, sort: S.konten.length * 10 }]))[0]);
    toast('Gespeichert'); mehr();
  }, k ? async () => { await db.remove('fin_konten', k.id); S.konten = S.konten.filter((x) => x.id !== k.id); mehr(); } : null);
}
async function importieren(datei) {
  const box = $('#import'); if (!datei) return;
  box.innerHTML = '<p class="muted">Lese Datei …</p>';
  try {
    const buf = await datei.arrayBuffer();
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf); // Sparkasse exportiert in Latin-1
    const umsaetze = parseCsv(text);
    const zeilen = umsaetze.map((u) => ({ schluessel: u.schluessel, datum: u.datum, konto: u.konto, empfaenger: u.empfaenger, zweck: u.zweck, betrag: u.betrag, kategorie: u.kategorie }));
    let neu = [];
    for (let i = 0; i < zeilen.length; i += 500) neu = neu.concat(await db.upsertIgnore('fin_buchungen', zeilen.slice(i, i + 500), 'schluessel'));
    const sonst = neu.filter((n) => n.kategorie === 'Sonstiges').length;
    box.innerHTML = `<p><b>${neu.length} neue Umsätze</b> übernommen, ${zeilen.length - neu.length} waren schon da.${sonst ? ` ${sonst} davon unter „Sonstiges“, bitte kurz zuordnen.` : ''}</p>${sonst ? '<a class="link" href="#/buchungen" id="zuordnen">Jetzt zuordnen</a>' : ''}`;
    S.geladen = false; await laden();
    if ($('#zuordnen')) $('#zuordnen').onclick = () => { filter = { monat: '', kat: 'Sonstiges', q: '' }; };
  } catch (e) { box.innerHTML = `<p class="err">${h(e.message)}</p>`; }
}

route();
