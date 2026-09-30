# Generasjon M – M-venn-appen

App for M-venner som besøker beboere på institusjoner, bygget etter designet
«Generasjon M – M-venn-appen».

- **M-venn (mobil):** velg institusjon, se ukas utfordring med
  fremgang, og registrer besøk (deltakere, M-venner, aktivitet, stemning, mål
  og om målet ble nådd). Er målet vagt, foreslås et mer konkret mål.
- **Admin (desktop):** dashboard med nøkkeltall, grafer og sammenligning av
  institusjoner (+ AI-oppsummering), generering og publisering av ukas utfordring,
  utfordringsmaler og institusjoner.

Antallet i ukas utfordring beregnes i kode (`backend/logic.py`) ut fra
institusjonens størrelse, deltakelse de siste 6 ukene og om de to forrige
utfordringene ble fullført. AI skriver bare teksten – en AI-tekst som ikke
inneholder nøyaktig det beregnede tallet forkastes.

## Kjøre lokalt

```bash
cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000
cd frontend && npm install && npm run dev   # http://localhost:5173
```

## Miljøvariabler (backend)

| Variabel | Hva |
|---|---|
| `ADMIN_CODE` | Adminkoden. **Uten den er admin-delen åpen** – sett den før appen deles. |
| `ANTHROPIC_API_KEY` | Slår på AI-tekster (Claude). Uten den brukes enkle maltekster. |
| `EKSPORT_NOKKEL` | Slår på eksport til Google Sheets. En lang, tilfeldig tekst – den står i eksport-lenkene. |
| `CLAUDE_MODEL` | Valgfritt, standard `claude-opus-5-5`. |
| `DATABASE_URL` / `POSTGRES_URL` | Postgres i produksjon (settes automatisk av Supabase/Neon-integrasjonen i Vercel). Tabellene legges i skjemaet `generasjon_m` (kan endres med `DB_SCHEMA`), så de ikke kolliderer med andre tabeller. Lokalt brukes SQLite. |

## Publisere (Vercel)

Importer repoet i Vercel (Root Directory = repo-roten). `vercel.json` bygger frontend og backend som to
tjenester på samme domene. Koble til en Postgres-database og sett variablene
over.

## Google Sheets

Appen leverer tre CSV-tabeller som Google Sheets henter med
`=IMPORTDATA("…")`: alle besøk, nøkkeltall per institusjon og ukas
utfordringer. Arket oppdaterer seg selv (Google henter på nytt omtrent hver
time). Sett `EKSPORT_NOKKEL`, og kopier ferdige formler fra
**Admin → Google Sheets**.
