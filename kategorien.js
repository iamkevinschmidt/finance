// Kategorien, Bereiche und Regeln für die automatische Zuordnung von Kontoumsätzen.
// Eine Quelle für App-Import und Erstbefüllung.

export const BEREICHE = {
  einnahmen: 'Einnahmen',
  wohnen: 'Wohnen',
  vorsorge: 'Versicherung & Vorsorge',
  kredit: 'Kredit',
  auto: 'Auto',
  alltag: 'Alltag',
  freizeit: 'Freizeit & Konsum',
  einmalig: 'Einmalig & Sonstiges',
  intern: 'Umbuchung (zählt nicht)',
};

// kategorie -> bereich
export const KATEGORIEN = {
  'Gehalt Kevin': 'einnahmen',
  'Gehalt Angelika': 'einnahmen',
  'Sonstige Einnahmen': 'einnahmen',
  'Miete': 'wohnen',
  'Strom': 'wohnen',
  'Internet & Handy': 'wohnen',
  'Rundfunk': 'wohnen',
  'Haushalt': 'wohnen',
  'Versicherungen': 'vorsorge',
  'BU-Versicherungen': 'vorsorge',
  'Altersvorsorge': 'vorsorge',
  'Kredit': 'kredit',
  'Auto': 'auto',
  'Lebensmittel': 'alltag',
  'Drogerie & Gesundheit': 'alltag',
  'Haustier': 'alltag',
  'Bargeld': 'alltag',
  'Restaurants & Lieferdienst': 'freizeit',
  'Kleidung & Shopping': 'freizeit',
  'Amazon': 'freizeit',
  'Sport & Supplements': 'freizeit',
  'Abos & Streaming': 'freizeit',
  'Geschenke': 'freizeit',
  'Reisen & Urlaub': 'freizeit',
  'Studium': 'einmalig',
  'Einmalig': 'einmalig',
  'Lieferleih': 'einmalig',
  'Familie & Freunde': 'einmalig',
  'Sonstiges': 'einmalig',
  'Umbuchung': 'intern',
  'Sparen & Investieren': 'intern',
};

// [kategorie, regex auf "empfänger|verwendungszweck|iban|buchungstext"]
export const REGELN = [
  ['Umbuchung', /DE07120300001075755130|DE57414500750100570514|^Von Sparkasse|Gemeinsames Konto|Tagesgeldkonto/],
  ['Sparen & Investieren', /Trade Republic|DE02100123450114045401/i],
  ['Kredit', /Darl\.-Leistung|easybank/],
  ['Gehalt Kevin', /Lohn-Gehalt|VILOR GMBH.*LOHN|LOHN\s+GEHALT.*vilor/i],
  ['Gehalt Angelika', /Verdienstabrechnung|Saatveredelung/i],
  ['Sonstige Einnahmen', /vilor|STEUERVERWALTUNG|KFZ-Steuer Erstattung|Schmidt & Wuckert|Qonto|ADD TO BALANCE|PP\.8984\.PP\/ABBUCHUNG|Bundesagentur f.r Arbeit|Familienkasse/i],
  ['Sonstige Einnahmen', /^PAYPAL\|/],
  ['Lieferleih', /Lieferleih|DE70100110012570569946|Jimdo|Neumann/],
  ['Einmalig', /Wladimir Lemle|Uni-Polster|Swiss Life Select|FOM Hochschule/],
  ['Miete', /Dervis Ostaoglu|Grundmiete/],
  ['Strom', /GENO Energie|Abschlag Strom/],
  ['Internet & Handy', /Vodafone|klarmobil|Telekom|o2 /i],
  ['Rundfunk', /Rundfunk/],
  ['Altersvorsorge', /VOLKSWOHL/],
  ['BU-Versicherungen', /Canada Life/],
  ['Versicherungen', /Nurnberger|NUERNBERGER|ARAG|AXA|VHV|HAFTPFLICHT|Hausrat/i],
  ['Auto', /BavariaDirekt|VW Leasing|Volkswagen Autovers|Kfz-Steuer|Bandel|Filterexperte|Autopflege|HEM Tankstelle|^HEM|JET |^JET|ARAL|SHELL|AVIA|Westfalen TS|eDalnice|MOL\.|Gasolineras|PARKEN|PAYBYPHONE|Parkhaus|EasyPark|P\. Lippstadt|Gottfried Schultz|Remscheid|Raiffeisen|Kreis Warendorf|Kreis Soest|BAT HH|Datgen|Tankstelle|ESSO|TOTAL/i],
  ['Studium', /SRH Fernhochschule/i],
  ['Abos & Streaming', /spotify|netflix|disney|rtl|youtube|apple services|sky marketing|openai|chat gpt|amazon digital|prime ?video|worldpay|sony interactive|nintendo|strato|grammarly|Ballspielverein|smartsteuer|Entgeltabrechnung|Kred-Zins|Abrechnung \d\d\.\d\d\.\d{4}/i],
  ['Haushalt', /heunert|toom|jysk|ikea|bauhaus|obi |hornbach|baumarkt/i],
  ['Haustier', /zooplus|fressnapf|tierarzt|Kleintiere/i],
  ['Lebensmittel', /kaufland|rewe|aldi|lidl|edeka|picnic|hit |^HIT|netto|mercadona|alcampo|supermercado|koro|getr.nkeland|unibev|fleischmarkt|issam|brotfee|b.ckerei|backerei|SOEST 10|E\.S\. LA ZENIA|penny|marktkauf|feinkost/i],
  ['Drogerie & Gesundheit', /drogerie|^dm|dm\.dekuje|rossmann|apotheke|DOKTORABC|friseur|hair|barber|docmorris|female company|ditzi|mueller sagt|rituals|ringana|AaeA/i],
  ['Sport & Supplements', /fitmart|decathlon|intersport/i],
  ['Bargeld', /^GA NR|BARGELD|SB-EINZAHLUNG|GS 037/i],
  ['Reisen & Urlaub', /\/ES\/|\/ES$|ORIHUELA|LA ZENIA|ZENIA|ALICANTE|Praha|PRAHA|CZK|Ryanair|Airbnb|Flughafen|Airport|AEROPUERTO|Winterberg|SKILIFTE|PULLMAN|Uber|Starbucks|Taxibetrieb|Butik|Alla Schmidt|TERRASSA|Rogue kitchen|BASSUS/i],
  ['Restaurants & Lieferdienst', /hosselmann|mcdonalds|mc donalds|burger|doner|döner|doener|kebab|glovo|takeaway|lieferando|sushi|steak|restaurant|cafe|kaffee|brauhaus|beef club|asia|kaishi|frittenlabor|brunch|bistro|barraca|pint depot|appetit|housen|PS M Schmitz|Junkers|Fromme|SUPER POP|FAVOLA|Popeyes|trdelnik|Peran Ali|moenchshof|mönchshof|krafin|Melissa|Kroka/i],
  ['Kleidung & Shopping', /h\+m|hm es|zara|pull and bear|bershka|stradivarius|lefties|nike|foot locker|new yorker|vero moda|zalando|shein|infinite styles|otto|goldkindchen|little dutch|reisenthel|action|tedi|nanu nana|miele|alehop|rebuy|momox|polinesia|mangopay|klarna|riverty|tabak|cineplex|Rudolf-Weber|FKP SCORPIO|CentrO|Schulte Maerter|Deutsche Post|GrussGruss|Venue|Rpm\.Service|DPP\.Tramv|DPCZN|SB\.Mustek|PLK\.PRAHA|WH SMITH|Drahtseile/i],
  ['Amazon', /amazon|amzn/i],
  ['Geschenke', /blumen|flora-point|JGA|smyths/i],
  ['Familie & Freunde', /WUCKERT|EDUARD UND ALLA|Eduard und Alla|Florian Markus|Phillip Lehmann|SWETLANA MARKUS|Anastasios Roumis|Serhan Demirtas|Stadt Soest|Kevin Schmidt$|KEVIN SCHMIDT/i],
];

export const PERSONEN = { gemeinsam: 'Gemeinsam', kevin: 'Kevin', angelika: 'Angelika' };
// Ausgaben, die nur eine Person betreffen
export const PERSON_REGELN = [
  ['kevin', /DOKTORABC|Lohn-Gehalt/i],
  ['angelika', /Verdienstabrechnung|Saatveredelung/i],
];
export function personFuer({ empfaenger = '', zweck = '' }) {
  const hay = `${empfaenger}|${zweck}`;
  for (const [p, rx] of PERSON_REGELN) if (rx.test(hay)) return p;
  return 'gemeinsam';
}

export function kategorisieren({ empfaenger = '', zweck = '', iban = '', text = '' }) {
  const hay = `${empfaenger}|${zweck}|${iban}|${text}`;
  for (const [kat, rx] of REGELN) if (rx.test(hay)) return kat;
  return 'Sonstiges';
}

// ---------- CSV ----------
function zeilen(text, sep) {
  const out = []; let row = []; let f = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f); f = ''; if (row.some((x) => x !== '')) out.push(row); row = [];
    } else f += c;
  }
  if (f !== '' || row.length) { row.push(f); if (row.some((x) => x !== '')) out.push(row); }
  return out;
}
const zahl = (s) => { const n = parseFloat(String(s || '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const datum = (s) => { const m = String(s || '').match(/(\d{2})\.(\d{2})\.(\d{2,4})/); if (!m) return null; const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2]}-${m[1]}`; };
const sauber = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// Ein PayPal-Umsatz trägt den Händler im Verwendungszweck
function paypalName(name, zweck) {
  if (!/paypal/i.test(name)) return name;
  const m = zweck.match(/\. (.*?), Ihr Einkauf bei/);
  return m && m[1].trim() ? `PayPal: ${m[1].trim()}` : 'PayPal';
}

// Erkennt Sparkasse (CSV-CAMT) und DKB; gibt Umsätze zurück
export function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = zeilen(text, ';');
  const kopfIdx = rows.findIndex((r) => r.includes('Buchungstag') || r.includes('Buchungsdatum'));
  if (kopfIdx < 0) throw new Error('Unbekanntes Format. Bitte den CSV-Export der Sparkasse oder DKB nehmen.');
  const kopf = rows[kopfIdx].map(sauber);
  const col = (n) => kopf.indexOf(n);
  const out = [];
  if (kopf.includes('Buchungstag')) {
    const konto = 'Sparkasse';
    for (const r of rows.slice(kopfIdx + 1)) {
      const d = datum(r[col('Buchungstag')]); if (!d) continue;
      if (/vorgemerkt/i.test(r[col('Info')] || '')) continue; // nur gebuchte Umsätze
      const zweck = sauber(r[col('Verwendungszweck')]);
      const name = paypalName(sauber(r[col('Beguenstigter/Zahlungspflichtiger')]), zweck);
      const betrag = zahl(r[col('Betrag')]);
      const text = sauber(r[col('Buchungstext')]);
      if (betrag === 0) continue;
      out.push({ datum: d, konto, empfaenger: name || text, zweck, iban: sauber(r[col('Kontonummer/IBAN')]), text, betrag });
    }
  } else {
    const konto = 'DKB';
    for (const r of rows.slice(kopfIdx + 1)) {
      const d = datum(r[col('Buchungsdatum')]); if (!d) continue;
      const betrag = zahl(r[col('Betrag (€)')]); if (betrag === 0) continue;
      let name = sauber(betrag < 0 ? r[col('Zahlungsempfänger*in')] : r[col('Zahlungspflichtige*r')]);
      if (name === 'ISSUER') name = sauber(r[col('Zahlungsempfänger*in')]);
      if (sauber(r[col('Zahlungsempfänger*in')]) === 'Tagesgeldkonto') name = 'Von Sparkasse';
      out.push({ datum: d, konto, empfaenger: name, zweck: sauber(r[col('Verwendungszweck')]), iban: sauber(r[col('IBAN')]), text: sauber(r[col('Umsatztyp')]), betrag });
    }
  }
  // Doppelte gleiche Umsätze am selben Tag behalten: laufende Nummer in den Schlüssel
  const zaehler = new Map();
  return out.map((u) => {
    const basis = `${u.konto}|${u.datum}|${u.betrag.toFixed(2)}|${u.empfaenger}|${u.zweck.slice(0, 60)}`;
    const n = (zaehler.get(basis) || 0) + 1; zaehler.set(basis, n);
    const kategorie = kategorisieren(u);
    return { ...u, schluessel: `${basis}|${n}`, kategorie, person: personFuer(u) };
  });
}
