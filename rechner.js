// Szenario-Rechner: rechnet Monat für Monat Rücklage, Kredit und Eigenkapital hoch.
// Reine Funktion ohne DOM, damit sie testbar bleibt.

export const monatPlus = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/**
 * p = {
 *   start: 'YYYY-MM' (erster simulierter Monat),
 *   monate: Anzahl,
 *   ruecklage: € heute (Notgroschen-Töpfe),
 *   ngZiel: € Ziel Notgroschen,
 *   schuld: € Restschuld heute, zins: % p. a., rate: € Monatsrate,
 *   einnahmen: € pro Monat (ohne Kevin/Angelika-Änderung),
 *   ausgaben: € pro Monat OHNE Kreditrate,
 *   phasen: [{ ab: 'YYYY-MM', einnahmenDelta: €, ausgabenDelta: € }]   (ab diesem Monat dauerhaft)
 *   einmal: [{ monat: 'YYYY-MM', betrag: € }]  (+ Abfindung, − Anschaffung)
 *   sondertilgung: true/false (Überschuss nach vollem Notgroschen in den Kredit)
 * }
 */
export function simulieren(p) {
  let ng = p.ruecklage, schuld = Math.max(0, p.schuld || 0), ek = 0;
  const zm = (p.zins || 0) / 100 / 12;
  const reihe = [];
  let ngVoll = ng >= p.ngZiel ? p.start : null, kreditFrei = schuld <= 0 ? p.start : null, ersterMinus = null, tiefster = ng;
  for (let i = 0; i < p.monate; i++) {
    const monat = monatPlus(p.start, i);
    let ein = p.einnahmen, aus = p.ausgaben;
    for (const ph of p.phasen || []) if (ph.ab && monat >= ph.ab) { ein += ph.einnahmenDelta || 0; aus += ph.ausgabenDelta || 0; }
    let rate = 0;
    if (schuld > 0) {
      const zinsen = schuld * zm;
      rate = Math.min(p.rate, schuld + zinsen);
      schuld = Math.max(0, schuld - (rate - zinsen));
    }
    let ueberschuss = ein - aus - rate;
    for (const e of p.einmal || []) if (e.monat === monat) ueberschuss += e.betrag;
    if (ueberschuss < 0 || ng < p.ngZiel) {
      ng += ueberschuss;
      if (ng > p.ngZiel) { const rest = ng - p.ngZiel; ng = p.ngZiel; if (p.sondertilgung && schuld > 0) { const t = Math.min(rest, schuld); schuld -= t; ek += rest - t; } else ek += rest; }
    } else if (p.sondertilgung && schuld > 0) {
      const t = Math.min(ueberschuss, schuld); schuld -= t; ek += ueberschuss - t;
    } else ek += ueberschuss;
    if (ng < 0 && ek > 0) { const t = Math.min(ek, -ng); ek -= t; ng += t; }
    if (!ngVoll && ng >= p.ngZiel - 0.5) ngVoll = monat;
    if (!kreditFrei && schuld <= 0.5) { kreditFrei = monat; schuld = 0; }
    if (!ersterMinus && ng < 0) ersterMinus = monat;
    tiefster = Math.min(tiefster, ng);
    reihe.push({ monat, einnahmen: ein, ausgaben: aus + rate, ueberschuss, ruecklage: ng, schuld, eigenkapital: ek });
  }
  const erster = reihe[0] || { ueberschuss: 0 };
  return {
    reihe, ngVoll, kreditFrei, ersterMinus, tiefster,
    ueberschussStart: erster.ueberschuss,
    // Wie viele Monate reicht die Rücklage, wenn der Startmonat-Überschuss negativ ist?
    reichweite: erster.ueberschuss < 0 ? Math.floor(p.ruecklage / -erster.ueberschuss) : null,
  };
}

// Restschuld eines Annuitätenkredits zu einem Monat, ausgehend von einem bekannten Stand
export function restschuld(saldo, standMonat, zielMonat, zinsProzent, rate) {
  let s = saldo; const zm = zinsProzent / 100 / 12; let m = standMonat;
  while (m < zielMonat && s > 0) { m = monatPlus(m, 1); s = Math.max(0, s - (rate - s * zm)); }
  return s;
}
