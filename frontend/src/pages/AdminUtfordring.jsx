import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

function Utkast({ u, onLagret }) {
  const [antall, setAntall] = useState(u.antall);
  const [tekst, setTekst] = useState(u.tekst);
  const endret = antall !== u.antall || tekst !== u.tekst;

  useEffect(() => { setAntall(u.antall); setTekst(u.tekst); }, [u]);

  async function lagre() {
    onLagret(await api.endreUtfordring(u.id, { antall, tekst }));
  }

  return (
    <article className="kort skygge">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{u.institusjon}</h3>
        <span className={`merke ${u.status}`}>{u.status}</span>
      </div>
      <div className="utkast-grid">
        <div className="felt">
          <label htmlFor={`antall-${u.id}`}>Antall</label>
          <input id={`antall-${u.id}`} className="inndata antall" inputMode="numeric" value={antall}
            onChange={(e) => setAntall(Math.max(1, parseInt(e.target.value.replace(/\D/g, ""), 10) || 1))} />
        </div>
        <div className="felt">
          <label htmlFor={`tekst-${u.id}`}>Tekst til M-vennene</label>
          <textarea id={`tekst-${u.id}`} className="inndata" rows={2} value={tekst} onChange={(e) => setTekst(e.target.value)} />
        </div>
      </div>
      <p className="hjelp" style={{ marginTop: 12 }}>
        <strong style={{ color: "var(--tekst)" }}>Begrunnelse:</strong> {u.begrunnelse}
        {u.status === "publisert" && ` · Fremgang: ${u.fremgang} av ${u.antall}`}
      </p>
      {endret && (
        <div className="rad" style={{ marginTop: 12 }}>
          <button type="button" className="knapp" onClick={lagre}>Lagre endring</button>
          <button type="button" className="knapp sekundar" onClick={() => { setAntall(u.antall); setTekst(u.tekst); }}>Angre</button>
        </div>
      )}
    </article>
  );
}

export default function AdminUtfordring() {
  const [uker, setUker] = useState(null);
  const [fane, setFane] = useState("neste");
  const [maler, setMaler] = useState([]);
  const [malId, setMalId] = useState("");
  const [liste, setListe] = useState([]);
  const [status, setStatus] = useState("");
  const [feil, setFeil] = useState("");
  const [jobber, setJobber] = useState(false);

  useEffect(() => {
    api.uker().then(setUker).catch((e) => setFeil(e.message));
    api.maler().then((m) => { setMaler(m); if (m[0]) setMalId(String(m[0].id)); }).catch((e) => setFeil(e.message));
  }, []);

  const valgt = uker?.[fane];

  useEffect(() => {
    if (!valgt) return;
    setStatus("");
    api.utfordringer(valgt.aar, valgt.uke).then(setListe).catch((e) => setFeil(e.message));
  }, [valgt?.aar, valgt?.uke]);

  async function generer() {
    setJobber(true); setFeil(""); setStatus("");
    try {
      setListe(await api.generer({ mal_id: Number(malId), ...valgt }));
      setStatus("Utkast er laget. Se over og publiser når du er fornøyd.");
    } catch (e) { setFeil(e.message); } finally { setJobber(false); }
  }

  async function publiser() {
    setJobber(true); setFeil("");
    try {
      const { publisert } = await api.publiser(valgt);
      setListe(await api.utfordringer(valgt.aar, valgt.uke));
      setStatus(`${publisert} utfordringer er publisert for uke ${valgt.uke}.`);
    } catch (e) { setFeil(e.message); } finally { setJobber(false); }
  }

  const antallUtkast = liste.filter((u) => u.status === "utkast").length;

  return (
    <>
      <div>
        <h1 style={{ fontSize: 32 }}>Ukas utfordring</h1>
        <p className="ingress">
          Antallet beregnes i kode ut fra størrelse, deltakelse de siste 6 ukene og historikk. AI skriver teksten, men endrer aldri tallet.
        </p>
      </div>

      {uker && (
        <>
          <div className="kort" style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="felt" style={{ flexGrow: 1, minWidth: 240 }}>
              <label htmlFor="mal">Mal</label>
              <select id="mal" className="inndata" value={malId} onChange={(e) => setMalId(e.target.value)}>
                {maler.map((m) => <option key={m.id} value={m.id}>{m.tekst} (basis {m.basis})</option>)}
              </select>
            </div>
            <button type="button" className="knapp" disabled={!malId || jobber} onClick={generer}>
              {jobber ? "Jobber …" : `Generer for ${fane === "neste" ? "neste uke" : "denne uken"} (uke ${valgt.uke})`}
            </button>
          </div>
          {!maler.length && <p className="hjelp">Lag en mal under <Link to="/admin/maler">Utfordringsmaler</Link> først.</p>}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div role="tablist" className="faner">
              <button type="button" role="tab" aria-selected={fane === "denne"} onClick={() => setFane("denne")}>Denne uken ({uker.denne.uke})</button>
              <button type="button" role="tab" aria-selected={fane === "neste"} onClick={() => setFane("neste")}>Neste uke ({uker.neste.uke})</button>
            </div>
            <button type="button" className="knapp" disabled={!antallUtkast || jobber} onClick={publiser}>
              Publiser ({antallUtkast})
            </button>
          </div>
        </>
      )}

      {feil && <div role="alert" className="melding feil">{feil}</div>}
      {status && <div role="status" className="melding ok">{status}</div>}

      {uker && !liste.length && (
        <p className="hjelp">Ingen utfordringer for uke {valgt.uke} ennå. Velg en mal og trykk «Generer».</p>
      )}
      {liste.map((u) => (
        <Utkast key={u.id} u={u} onLagret={(ny) => setListe((l) => l.map((x) => (x.id === ny.id ? ny : x)))} />
      ))}
    </>
  );
}
