import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, lagring } from "../api.js";
import { Gnist } from "../components/Ikoner.jsx";

function Velger({ onValgt }) {
  const [institusjoner, setInstitusjoner] = useState(null);
  const [instId, setInstId] = useState("");
  const [feil, setFeil] = useState("");

  useEffect(() => {
    api.institusjoner().then(setInstitusjoner).catch((e) => setFeil(e.message));
  }, []);

  return (
    <div className="stakk" style={{ marginTop: 24, gap: 20 }}>
      <h1 style={{ fontSize: 30 }}>Hvor er du på besøk?</h1>
      {feil && <div role="alert" className="melding feil">{feil}</div>}
      {institusjoner && institusjoner.length === 0 && (
        <p className="hjelp">Ingen institusjoner er lagt inn ennå. Be en admin legge dem inn.</p>
      )}
      <div className="felt">
        <label htmlFor="inst">Institusjon</label>
        <select id="inst" className="inndata" value={instId} onChange={(e) => setInstId(e.target.value)}>
          <option value="">Velg institusjon</option>
          {institusjoner?.map((i) => <option key={i.id} value={i.id}>{i.navn}</option>)}
        </select>
      </div>
      <button type="button" className="knapp stor" disabled={!instId} onClick={() => onValgt(Number(instId))}>
        Fortsett
      </button>
    </div>
  );
}

export default function MVenn() {
  const [instId, setInstId] = useState(lagring.institusjon());
  const [data, setData] = useState(null);
  const [feil, setFeil] = useState("");

  useEffect(() => {
    if (!instId) return;
    setData(null);
    api.ukasUtfordring(instId).then(setData).catch((e) => {
      // Institusjonen kan ha blitt slettet - be om nytt valg
      lagring.settInstitusjon(null);
      setInstId(null);
      setFeil(e.message);
    });
  }, [instId]);

  function velg(id) {
    lagring.settInstitusjon(id);
    setFeil("");
    setInstId(id);
  }

  function bytt() {
    lagring.settInstitusjon(null);
    setInstId(null);
  }

  const u = data?.utfordring;

  return (
    <div className="mobil">
      <Link to="/" className="logo-plass" style={{ width: 128, height: 36, fontSize: 12 }}>[Logo]</Link>
      {!instId ? (
        <>
          {feil && <div role="alert" className="melding feil" style={{ marginTop: 20 }}>{feil}</div>}
          <Velger onValgt={velg} />
        </>
      ) : !data ? (
        <p className="hjelp" style={{ marginTop: 24 }}>Laster …</p>
      ) : (
        <>
          <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <h1 style={{ fontSize: 30 }}>{data.institusjon.navn}</h1>
            <button type="button" className="lenkeknapp" onClick={bytt}>Bytt institusjon</button>
          </div>

          <section aria-label="Ukas utfordring" className="utfordring" style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p className="overlinje">Ukas utfordring · uke {data.uke}</p>
              <Gnist size={24} />
            </div>
            {u ? (
              <>
                <div style={{ marginTop: 8, display: "flex", alignItems: "flex-end", gap: 14 }}>
                  <span className="tall">{u.antall}</span>
                  <span style={{ paddingBottom: 12, fontSize: 18, fontWeight: 700 }}>beboere</span>
                </div>
                <p style={{ marginTop: 12, fontSize: 20, fontWeight: 700, lineHeight: 1.35 }}>{u.tekst}</p>
              </>
            ) : (
              <p style={{ marginTop: 12, fontSize: 20, fontWeight: 700, lineHeight: 1.35 }}>
                Ingen utfordring er publisert for denne uken ennå.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
