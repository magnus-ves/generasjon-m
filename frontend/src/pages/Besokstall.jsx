import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

export default function Besokstall() {
  const [liste, setListe] = useState([]);
  const [resultat, setResultat] = useState(null);
  const [feil, setFeil] = useState("");
  const [laster, setLaster] = useState(false);
  const filRef = useRef(null);

  const last = () => api.besokstall().then(setListe).catch((e) => setFeil(e.message));
  useEffect(() => { last(); }, []);

  async function lastOpp(e) {
    const fil = e.target.files?.[0];
    if (!fil) return;
    setLaster(true); setFeil(""); setResultat(null);
    try {
      setResultat(await api.importerBesokstall(fil));
      last();
    } catch (err) {
      setFeil(err.message);
    } finally {
      setLaster(false);
      e.target.value = "";
    }
  }

  async function slett(b) {
    if (!window.confirm(`Slette tallene for ${b.institusjon}, uke ${b.uke} ${b.aar}?`)) return;
    await api.slettBesokstall(b.id);
    last();
  }

  const lagret = resultat ? resultat.nye + resultat.oppdaterte : 0;

  return (
    <>
      <div>
        <h1 style={{ fontSize: 32 }}>Besøkstall</h1>
        <p className="ingress">
          Last opp hvor mange beboere som deltok, per institusjon og uke. Tallene brukes når ukas utfordring beregnes,
          og som bakgrunn når AI skriver teksten. Jo flere uker med tall, jo bedre treffer utfordringene.
        </p>
      </div>

      <div className="kort stakk">
        <h2 style={{ fontSize: 20 }}>Last opp fil</h2>
        <p className="hjelp">
          CSV-fil fra Excel («Lagre som → CSV») eller Google Sheets («Fil → Last ned → CSV»). Første rad må være
          overskrifter: <strong>Institusjon</strong>, <strong>År</strong>, <strong>Uke</strong>, <strong>Besøk</strong>,{" "}
          <strong>Deltakere</strong> – og eventuelt <strong>Klarte utfordringen</strong> (ja/nei). I stedet for År og
          Uke kan du ha en <strong>Dato</strong>-kolonne med én rad per besøk. Institusjonsnavnene må være de samme som
          i appen. Ikke skriv navn eller helseopplysninger om beboere.
        </p>
        <p className="hjelp">Laster du opp samme uke på nytt, erstattes de gamle tallene.</p>
        <div className="rad">
          <input ref={filRef} type="file" accept=".csv,text/csv,text/plain" onChange={lastOpp}
            style={{ display: "none" }} id="besokstall-fil" />
          <button type="button" className="knapp" disabled={laster} onClick={() => filRef.current?.click()}>
            {laster ? "Laster opp …" : "Velg fil og last opp"}
          </button>
          <button type="button" className="knapp sekundar" onClick={() => api.lastNedMal().catch((e) => setFeil(e.message))}>
            Last ned mal
          </button>
        </div>
      </div>

      {feil && <div role="alert" className="melding feil">{feil}</div>}
      {resultat && (
        <div role="status" className={`melding ${lagret && !resultat.antall_feil ? "ok" : "feil"}`}>
          <p>
            {lagret
              ? `Lagret ${lagret} uke${lagret === 1 ? "" : "r"} med tall (${resultat.nye} nye, ${resultat.oppdaterte} oppdatert).`
              : "Ingen tall ble lagret."}
            {resultat.utfordringer_vurdert > 0 && ` ${resultat.utfordringer_vurdert} utfordringer ble markert som klart/ikke klart.`}
          </p>
          {resultat.ukjente_institusjoner.length > 0 && (
            <p style={{ marginTop: 8 }}>
              Fant ikke disse institusjonene i appen: {resultat.ukjente_institusjoner.join(", ")}. Legg dem inn under
              Institusjoner (eller rett navnet i filen) og last opp på nytt.
            </p>
          )}
          {resultat.feil.length > 0 && (
            <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
              {resultat.feil.map((f) => <li key={f}>{f}</li>)}
              {resultat.antall_feil > resultat.feil.length && <li>… og {resultat.antall_feil - resultat.feil.length} til</li>}
            </ul>
          )}
        </div>
      )}

      <section>
        <h2 style={{ fontSize: 24 }}>Lagrede tall</h2>
        {liste.length === 0 ? (
          <p className="hjelp" style={{ marginTop: 8 }}>Ingen besøkstall er lastet opp ennå.</p>
        ) : (
          <div className="tabell-rulle" style={{ marginTop: 12 }}>
            <table className="tabell">
              <thead>
                <tr><th>Uke</th><th>Institusjon</th><th>Besøk</th><th>Deltakere</th><th>Per besøk</th><th /></tr>
              </thead>
              <tbody>
                {liste.map((b) => (
                  <tr key={b.id}>
                    <td>Uke {b.uke} {b.aar}</td>
                    <td style={{ fontWeight: 600 }}>{b.institusjon}</td>
                    <td>{b.besok}</td>
                    <td>{b.deltakere}</td>
                    <td>{b.besok ? (b.deltakere / b.besok).toFixed(1).replace(".", ",") : "–"}</td>
                    <td style={{ width: 110 }}>
                      <button type="button" className="knapp fare" onClick={() => slett(b)}
                        aria-label={`Slett ${b.institusjon} uke ${b.uke}`}>Slett</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
