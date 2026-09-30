import { useEffect, useState } from "react";
import { api } from "../api.js";

function AvdelingRad({ avd, onEndret }) {
  const [navn, setNavn] = useState(avd.navn);
  const [beboere, setBeboere] = useState(avd.antall_beboere);
  const endret = navn !== avd.navn || beboere !== avd.antall_beboere;

  async function lagre() {
    await api.endreAvdeling(avd.id, { navn, antall_beboere: beboere, institusjon_id: avd.institusjon_id });
    onEndret();
  }
  async function slett() {
    if (!window.confirm(`Slette ${avd.navn}? Alle besøk og utfordringer for avdelingen slettes også.`)) return;
    await api.slettAvdeling(avd.id);
    onEndret();
  }

  return (
    <tr>
      <td>
        <label htmlFor={`an-${avd.id}`} style={{ position: "absolute", left: -9999 }}>Navn</label>
        <input id={`an-${avd.id}`} className="inndata" value={navn} onChange={(e) => setNavn(e.target.value)} />
      </td>
      <td style={{ width: 140 }}>
        <label htmlFor={`ab-${avd.id}`} style={{ position: "absolute", left: -9999 }}>Antall beboere</label>
        <input id={`ab-${avd.id}`} className="inndata" inputMode="numeric" value={beboere}
          onChange={(e) => setBeboere(Math.max(1, parseInt(e.target.value.replace(/\D/g, ""), 10) || 1))} />
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

function Institusjon({ inst, onEndret }) {
  const [navn, setNavn] = useState(inst.navn);
  const [nyNavn, setNyNavn] = useState("");
  const [nyBeboere, setNyBeboere] = useState(12);

  async function lagreNavn() {
    await api.endreInstitusjon(inst.id, { navn });
    onEndret();
  }
  async function slett() {
    if (!window.confirm(`Slette ${inst.navn} med alle avdelinger, besøk og utfordringer?`)) return;
    await api.slettInstitusjon(inst.id);
    onEndret();
  }
  async function nyAvdeling(e) {
    e.preventDefault();
    await api.nyAvdeling({ navn: nyNavn, antall_beboere: nyBeboere, institusjon_id: inst.id });
    setNyNavn(""); setNyBeboere(12);
    onEndret();
  }

  return (
    <section className="kort stakk">
      <div className="rad">
        <label htmlFor={`in-${inst.id}`} style={{ position: "absolute", left: -9999 }}>Navn på institusjon</label>
        <input id={`in-${inst.id}`} className="inndata" style={{ fontWeight: 800, fontSize: 18, flex: 1, minWidth: 200 }}
          value={navn} onChange={(e) => setNavn(e.target.value)} />
        {navn !== inst.navn && <button type="button" className="knapp" onClick={lagreNavn}>Lagre</button>}
        <button type="button" className="knapp fare" onClick={slett}>Slett institusjon</button>
      </div>
      <div className="tabell-rulle">
        <table className="tabell">
          <thead><tr><th>Avdeling</th><th>Beboere</th><th /></tr></thead>
          <tbody>
            {inst.avdelinger.map((a) => (
              <AvdelingRad key={`${a.id}-${a.navn}-${a.antall_beboere}`} avd={a} onEndret={onEndret} />
            ))}
          </tbody>
        </table>
      </div>
      <form onSubmit={nyAvdeling} className="rad" style={{ alignItems: "flex-end" }}>
        <div className="felt" style={{ flex: 1, minWidth: 200 }}>
          <label htmlFor={`na-${inst.id}`}>Ny avdeling</label>
          <input id={`na-${inst.id}`} className="inndata" required value={nyNavn} onChange={(e) => setNyNavn(e.target.value)} />
        </div>
        <div className="felt" style={{ width: 140 }}>
          <label htmlFor={`nb-${inst.id}`}>Beboere</label>
          <input id={`nb-${inst.id}`} className="inndata" inputMode="numeric" value={nyBeboere}
            onChange={(e) => setNyBeboere(Math.max(1, parseInt(e.target.value.replace(/\D/g, ""), 10) || 1))} />
        </div>
        <button type="submit" className="knapp sekundar">Legg til avdeling</button>
      </form>
    </section>
  );
}

export default function Institusjoner() {
  const [liste, setListe] = useState([]);
  const [navn, setNavn] = useState("");
  const [feil, setFeil] = useState("");

  const last = () => api.institusjoner().then(setListe).catch((e) => setFeil(e.message));
  useEffect(() => { last(); }, []);

  async function ny(e) {
    e.preventDefault();
    try { await api.nyInstitusjon({ navn }); setNavn(""); last(); } catch (err) { setFeil(err.message); }
  }

  return (
    <>
      <div>
        <h1 style={{ fontSize: 32 }}>Institusjoner og avdelinger</h1>
        <p className="ingress">Antall beboere brukes til å beregne deltakelsesgrad og størrelsen på ukas utfordring.</p>
      </div>
      {feil && <div role="alert" className="melding feil">{feil}</div>}
      {liste.map((i) => <Institusjon key={`${i.id}-${i.navn}`} inst={i} onEndret={last} />)}
      <form onSubmit={ny} className="kort rad" style={{ alignItems: "flex-end" }}>
        <div className="felt" style={{ flex: 1, minWidth: 200 }}>
          <label htmlFor="ny-inst">Ny institusjon</label>
          <input id="ny-inst" className="inndata" required value={navn} onChange={(e) => setNavn(e.target.value)} />
        </div>
        <button type="submit" className="knapp">Legg til institusjon</button>
      </form>
    </>
  );
}
