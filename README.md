# Finanzen Fam. Schmidt

Private Finanz-App für Kevin und Angelika: Konten, Monatsbudget, Szenario-Rechner, Ziele und Maßnahmen, Kontoumsätze.

- Statische Web-App ohne Build-Schritt (HTML, CSS, JavaScript), gehostet auf Vercel, aufs iPhone als Startbildschirm-App.
- Daten in Supabase, Projekt `Trainingsplan` (Frankfurt), Tabellen mit Präfix `fin_`. Schema: `supabase/schema.sql`.
- Zugriff nur für Personen in `fin_mitglieder` (Row Level Security). Kevin `admin` (schreiben), Angelika `lesen`.
- Kontoauszüge: CSV-Export der Sparkasse unter „Mehr“ einlesen; Regeln für die Kategorien in `kategorien.js`.
- Szenario-Rechner: `rechner.js` (reine Funktion).
- `.github/workflows/keepalive.yml` pingt die Datenbank alle zwei Tage, damit das kostenlose Projekt nicht schläft.
