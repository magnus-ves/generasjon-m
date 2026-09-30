import { useEffect, useState } from "react";
import { api } from "../api.js";

const tall = (v) => Math.max(1, parseInt(String(v).replace(/\D/g, ""), 10) || 1);

function InstitusjonRad({ inst, onEndret }) {
  const [navn, setNavn] = useState(inst.navn);
  const [beboere, setBeboere] = useState(inst.antall_beboere);
  const endret = navn !== inst.navn || beboere !== inst.antall_beboere;

  async function lagre() {
    await api.endreInstitusjon(inst.id, { navn, antall_beboere: beboere });
    onEndret();
  }
  async function slett() {
    if (!window.confirm(`Slette ${inst.navn}? Alle besøk og utfordringer for institusjonen slettes også.`)) return;
    await api.slettInstitusjon(inst.id);
    onEndret();
  }

  return (
    <tr>
      <td>
        <label htmlFor={`in-${inst.id}`} style={{ position: "absolute", left: -9999 }}>Navn</label>
        <input id={`in-${inst.id}`} className="inndata" value={navn} onChange={(e) => setNavn(e.target.value)} />
      </td>
      <td style={{ width: 140 }}>
        <label htmlFor={`ib-${inst.id}`} style={{ position: "absolute", left: -9999 }}>Antall beboere</label>
        <input id={`ib-${inst.id}`} className="inndata" inputMode="numeric" value={beboere}
          onChange={(e) => setBeboere(tall(e.target.value))} />
      </td>
      <td style={{ width: 220 }}>
        <div className="rad">
          {endret && <button type="button" className="knapp" onClick={lagre}>Lagre</button>}
          <button type="button" className="knapp fare" onClick={slett}>Slett</button>
        </div>
      </td>
    </tr>
  );
}

export default function Institusjoner() {
  const [liste, setListe] = useState([]);
  const [navn, setNavn] = useState("");
  const [beboere, setBeboere] = useState(12);
  const [feil, setFeil] = useState("");

  const last = () => api.institusjoner().then(setListe).catch((e) => setFeil(e.message));
  useEffect(() => { last(); }, []);

  async function ny(e) {
    e.preventDefault();
    try {
      await api.nyInstitusjon({ navn, antall_beboere: beboere });
      setNavn(""); setBeboere(12); setFeil("");
      last();
    } catch (err) { setFeil(err.message); }
  }

  return (
    <>
      <div>
        <h1 style={{ fontSize: 32 }}>Institusjoner</h1>
        <p className="ingress">Antall beboere brukes til å beregne deltakelsesgrad og størrelsen på ukas utfordring.</p>
      </div>
      {feil && <div role="alert" className="melding feil">{feil}</div>}
      {liste.length > 0 && (
        <div className="tabell-rulle">
          <table className="tabell">
            <thead><tr><th>Institusjon</th><th>Beboere</th><th /></tr></thead>
            <tbody>
              {liste.map((i) => (
                <InstitusjonRad key={`${i.id}-${i.navn}-${i.antall_beboere}`} inst={i} onEndret={last} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form onSubmit={ny} className="kort rad" style={{ alignItems: "flex-end" }}>
        <div className="felt" style={{ flex: 1, minWidth: 200 }}>
          <label htmlFor="ny-inst">Ny institusjon</label>
          <input id="ny-inst" className="inndata" required value={navn} onChange={(e) => setNavn(e.target.value)} />
        </div>
        <div className="felt" style={{ width: 140 }}>
          <label htmlFor="ny-beboere">Beboere</label>
          <input id="ny-beboere" className="inndata" inputMode="numeric" value={beboere}
            onChange={(e) => setBeboere(tall(e.target.value))} />
        </div>
        <button type="submit" className="knapp">Legg til institusjon</button>
      </form>
    </>
  );
}
