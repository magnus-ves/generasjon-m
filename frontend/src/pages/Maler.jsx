import { useEffect, useState } from "react";
import { api } from "../api.js";

function MalRad({ mal, onEndret }) {
  const [tekst, setTekst] = useState(mal.tekst);
  const [basis, setBasis] = useState(mal.basis);
  const [feil, setFeil] = useState("");
  const endret = tekst !== mal.tekst || basis !== mal.basis;

  async function lagre() {
    try { await api.endreMal(mal.id, { tekst, basis }); setFeil(""); onEndret(); } catch (e) { setFeil(e.message); }
  }
  async function slett() {
    if (!window.confirm("Slette denne malen?")) return;
    await api.slettMal(mal.id); onEndret();
  }

  return (
    <div className="kort stakk">
      <div className="utkast-grid" style={{ marginTop: 0, gridTemplateColumns: "1fr 110px" }}>
        <div className="felt">
          <label htmlFor={`mt-${mal.id}`}>Tekst</label>
          <input id={`mt-${mal.id}`} className="inndata" value={tekst} onChange={(e) => setTekst(e.target.value)} />
        </div>
        <div className="felt">
          <label htmlFor={`mb-${mal.id}`}>Basis</label>
          <input id={`mb-${mal.id}`} className="inndata" inputMode="numeric" value={basis}
            onChange={(e) => setBasis(Math.max(1, parseInt(e.target.value.replace(/\D/g, ""), 10) || 1))} />
        </div>
      </div>
      {feil && <div role="alert" className="melding feil">{feil}</div>}
      <div className="rad">
        {endret && <button type="button" className="knapp" onClick={lagre}>Lagre</button>}
        <button type="button" className="knapp fare" onClick={slett}>Slett</button>
      </div>
    </div>
  );
}

export default function Maler() {
  const [maler, setMaler] = useState([]);
  const [tekst, setTekst] = useState("");
  const [basis, setBasis] = useState(3);
  const [feil, setFeil] = useState("");

  const last = () => api.maler().then(setMaler).catch((e) => setFeil(e.message));
  useEffect(() => { last(); }, []);

  async function ny(e) {
    e.preventDefault();
    try {
      await api.nyMal({ tekst, basis });
      setTekst(""); setBasis(3); setFeil("");
      last();
    } catch (err) { setFeil(err.message); }
  }

  return (
    <>
      <div>
        <h1 style={{ fontSize: 32 }}>Utfordringsmaler</h1>
        <p className="ingress">
          Skriv <strong>{"{antall}"}</strong> der tallet skal stå. Basis er antallet for en gjennomsnittlig institusjon – det justeres automatisk per institusjon.
        </p>
      </div>
      {maler.map((m) => <MalRad key={`${m.id}-${m.tekst}-${m.basis}`} mal={m} onEndret={last} />)}
      <form onSubmit={ny} className="kort stakk">
        <h2 style={{ fontSize: 20 }}>Ny mal</h2>
        <div className="utkast-grid" style={{ marginTop: 0, gridTemplateColumns: "1fr 110px" }}>
          <div className="felt">
            <label htmlFor="ny-tekst">Tekst</label>
            <input id="ny-tekst" className="inndata" required placeholder="Syng {antall} sanger sammen med beboerne"
              value={tekst} onChange={(e) => setTekst(e.target.value)} />
          </div>
          <div className="felt">
            <label htmlFor="ny-basis">Basis</label>
            <input id="ny-basis" className="inndata" inputMode="numeric" value={basis}
              onChange={(e) => setBasis(Math.max(1, parseInt(e.target.value.replace(/\D/g, ""), 10) || 1))} />
          </div>
        </div>
        {feil && <div role="alert" className="melding feil">{feil}</div>}
        <div><button type="submit" className="knapp">Legg til mal</button></div>
      </form>
    </>
  );
}
