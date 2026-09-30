import { useEffect, useState } from "react";
import { api } from "../api.js";

function Formel({ tittel, formel }) {
  const [kopiert, setKopiert] = useState(false);

  async function kopier() {
    try {
      await navigator.clipboard.writeText(formel);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    } catch {
      // Utklippstavlen er ikke tilgjengelig - brukeren kan markere teksten selv
    }
  }

  return (
    <div className="kort stakk">
      <h2 style={{ fontSize: 20 }}>{tittel}</h2>
      <div className="rad" style={{ flexWrap: "nowrap" }}>
        <input className="inndata" readOnly value={formel} aria-label={`Formel for ${tittel}`}
          onFocus={(e) => e.target.select()} style={{ fontFamily: "ui-monospace, monospace", fontSize: 14 }} />
        <button type="button" className="knapp" onClick={kopier} style={{ flexShrink: 0 }}>
          {kopiert ? "Kopiert!" : "Kopier"}
        </button>
      </div>
    </div>
  );
}

export default function GoogleSheets() {
  const [info, setInfo] = useState(null);
  const [feil, setFeil] = useState("");

  useEffect(() => {
    api.eksport().then(setInfo).catch((e) => setFeil(e.message));
  }, []);

  const lenke = (navn) =>
    `${window.location.origin}/api/eksport/${navn}.csv?nokkel=${encodeURIComponent(info.nokkel)}`;

  return (
    <>
      <div>
        <h1 style={{ fontSize: 32 }}>Google Sheets</h1>
        <p className="ingress">
          Hent dataene fra appen rett inn i et Google-regneark. Arket oppdaterer seg selv automatisk (omtrent hver time).
        </p>
      </div>
      {feil && <div role="alert" className="melding feil">{feil}</div>}
      {info && !info.aktiv && (
        <div className="kort stakk">
          <h2 style={{ fontSize: 20 }}>Eksport er ikke skrudd på</h2>
          <p className="hjelp">
            Legg inn miljøvariabelen <strong>EKSPORT_NOKKEL</strong> i Vercel (Settings → Environment Variables) med en
            lang, tilfeldig verdi, og deploy på nytt. Nøkkelen står i lenkene under, så bare de som har lenken får se dataene.
          </p>
        </div>
      )}
      {info?.aktiv && (
        <>
          <div className="kort stakk">
            <h2 style={{ fontSize: 20 }}>Slik gjør du</h2>
            <ol style={{ margin: 0, paddingLeft: 22, lineHeight: 1.7, fontSize: 16 }}>
              <li>Åpne et Google-regneark (eller lag et nytt på sheets.new).</li>
              <li>Lag én fane per tabell du vil ha, f.eks. «Besøk».</li>
              <li>Kopier formelen under og lim den inn i celle A1 i fanen.</li>
              <li>Første gang kan Google be deg klikke «Tillat tilgang».</li>
            </ol>
            <p className="hjelp">
              Del ikke formlene med andre enn de som skal se tallene – lenken gir lesetilgang til dataene.
            </p>
          </div>
          {info.datasett.map((d) => (
            <Formel key={d.navn} tittel={d.tittel} formel={`=IMPORTDATA("${lenke(d.navn)}")`} />
          ))}
        </>
      )}
    </>
  );
}
