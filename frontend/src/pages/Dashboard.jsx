import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Gnist } from "../components/Ikoner.jsx";

const PERIODER = [[4, "Siste 4 uker"], [12, "Siste 12 uker"], [26, "Siste 26 uker"], [52, "Siste 52 uker"]];

function Linjediagram({ linje }) {
  const B = 460, H = 230, venstre = 36, bunn = 190, topp = 10;
  const verdier = [...linje.utvalg, ...linje.alle].filter((v) => v != null);
  const maks = Math.max(3, Math.ceil(Math.max(0, ...verdier) / 3) * 3);
  const n = linje.uker.length;
  const x = (i) => venstre + 24 + (n > 1 ? (i * (B - venstre - 34)) / (n - 1) : 0);
  const y = (v) => bunn - (v / maks) * (bunn - topp);
  const sti = (liste) =>
    liste.map((v, i) => (v == null ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(" ");
  const steg = [0, 1, 2, 3].map((k) => (maks * k) / 3);
  const visEtikett = (i) => n <= 13 || i % Math.ceil(n / 12) === 0 || i === n - 1;

  return (
    <svg viewBox={`0 0 ${B} ${H}`} role="img" aria-label="Linjediagram: deltakere per besøk per uke">
      {steg.map((s) => (
        <g key={s}>
          <line x1={venstre} y1={y(s)} x2={B - 10} y2={y(s)} stroke="var(--kant)" />
          <text x={venstre - 10} y={y(s) + 4} fontSize="13" fill="var(--dempet)" textAnchor="end">
            {Number.isInteger(s) ? s : s.toFixed(1).replace(".", ",")}
          </text>
        </g>
      ))}
      <polyline points={sti(linje.alle)} fill="none" stroke="var(--aksent)" strokeWidth="2" strokeDasharray="6 4" />
      <polyline points={sti(linje.utvalg)} fill="none" stroke="var(--primar)" strokeWidth="2" />
      {linje.utvalg.map((v, i) => (
        <g key={i}>
          {v != null && <circle cx={x(i)} cy={y(v)} r="4" fill="var(--primar)" stroke="#fff" strokeWidth="2" />}
          {visEtikett(i) && (
            <text x={x(i)} y="214" fontSize="12" fill="var(--dempet)" textAnchor="middle">{linje.uker[i]}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

function Stolpediagram({ rader }) {
  const B = 460, bunn = 210, hoyde = 140;
  const maks = Math.max(0.3, ...rader.map((r) => r.grad_verdi));
  const bredde = Math.min(48, (B - 60) / Math.max(rader.length, 1) - 12);
  const avstand = (B - 60) / Math.max(rader.length, 1);
  const trinn = [0, maks / 2, maks];
  return (
    <svg viewBox={`0 0 ${B} 256`} role="img" aria-label="Stolpediagram: deltakelsesgrad per avdeling">
      {trinn.map((t) => {
        const yy = bunn - (t / maks) * hoyde;
        return (
          <g key={t}>
            <line x1="40" y1={yy} x2={B - 10} y2={yy} stroke="var(--kant)" />
            <text x="32" y={yy + 4} fontSize="13" fill="var(--dempet)" textAnchor="end">{Math.round(t * 100)} %</text>
          </g>
        );
      })}
      {rader.map((r, i) => {
        const h = (r.grad_verdi / maks) * hoyde;
        const midt = 50 + avstand * i + avstand / 2;
        return (
          <g key={r.id}>
            <rect x={midt - bredde / 2} y={bunn - h} width={bredde} height={h} rx="4" fill="var(--primar)" />
            <text x={midt} y={bunn - h - 8} fontSize="13" fontWeight="700" fill="var(--tekst)" textAnchor="middle">{r.grad}</text>
            <text x={midt} y="232" fontSize="13" fill="var(--dempet)" textAnchor="middle">
              {r.navn.length > 12 ? r.navn.slice(0, 11) + "…" : r.navn}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Dashboard() {
  const [institusjoner, setInstitusjoner] = useState([]);
  const [filter, setFilter] = useState({ institusjon_id: "", avdeling_id: "", uker: 12 });
  const [data, setData] = useState(null);
  const [feil, setFeil] = useState("");
  const [oppsummering, setOppsummering] = useState("");
  const [lagerOppsummering, setLagerOppsummering] = useState(false);

  useEffect(() => {
    api.institusjoner().then(setInstitusjoner).catch((e) => setFeil(e.message));
  }, []);

  useEffect(() => {
    setOppsummering("");
    api.dashboard(filter).then(setData).catch((e) => setFeil(e.message));
  }, [filter]);

  const inst = institusjoner.find((i) => String(i.id) === String(filter.institusjon_id));
  const avdelinger = inst ? inst.avdelinger : institusjoner.flatMap((i) => i.avdelinger);
  const valgtAvd = avdelinger.find((a) => String(a.id) === String(filter.avdeling_id));

  async function lagOppsummering() {
    setLagerOppsummering(true);
    try {
      const { tekst } = await api.oppsummering(filter);
      setOppsummering(tekst);
    } catch (e) {
      setFeil(e.message);
    } finally {
      setLagerOppsummering(false);
    }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 32 }}>Dashboard</h1>
        <button type="button" className="knapp" onClick={lagOppsummering} disabled={lagerOppsummering}>
          <Gnist />{lagerOppsummering ? "Skriver …" : "AI-oppsummering"}
        </button>
      </div>

      {feil && <div role="alert" className="melding feil">{feil}</div>}
      {oppsummering && (
        <section className="kort skygge" aria-label="AI-oppsummering">
          <p className="forslag-tittel"><Gnist />Oppsummering</p>
          <p className="ai-boks" style={{ marginTop: 8 }}>{oppsummering}</p>
        </section>
      )}

      <div className="filtre">
        <div className="felt">
          <label htmlFor="fi">Institusjon</label>
          <select id="fi" className="inndata" value={filter.institusjon_id}
            onChange={(e) => setFilter((f) => ({ ...f, institusjon_id: e.target.value, avdeling_id: "" }))}>
            <option value="">Alle</option>
            {institusjoner.map((i) => <option key={i.id} value={i.id}>{i.navn}</option>)}
          </select>
        </div>
        <div className="felt">
          <label htmlFor="fa">Avdeling</label>
          <select id="fa" className="inndata" value={filter.avdeling_id}
            onChange={(e) => setFilter((f) => ({ ...f, avdeling_id: e.target.value }))}>
            <option value="">Alle</option>
            {avdelinger.map((a) => <option key={a.id} value={a.id}>{a.navn}</option>)}
          </select>
        </div>
        <div className="felt">
          <label htmlFor="fp">Periode</label>
          <select id="fp" className="inndata" value={filter.uker}
            onChange={(e) => setFilter((f) => ({ ...f, uker: Number(e.target.value) }))}>
            {PERIODER.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>
      </div>

      {data && (
        <>
          <div className="nokkeltall">
            {data.tall.map((t) => (
              <div key={t.etikett} className="kort">
                <p className="etikett">{t.etikett}</p>
                <p className="verdi">{t.verdi}</p>
                <p className="hint">{t.hint}</p>
              </div>
            ))}
          </div>

          <div className="diagrammer">
            <section className="kort">
              <h2 style={{ fontSize: 20 }}>Deltakere per besøk over tid</h2>
              <p className="undertekst">Snitt per uke, sammenlignet med alle avdelinger</p>
              <div className="forklaring">
                <span><span style={{ width: 16, height: 3, background: "var(--primar)" }} />{valgtAvd?.navn || inst?.navn || "Utvalg"}</span>
                <span><span style={{ width: 16, height: 0, borderTop: "3px dashed var(--aksent)" }} />Alle avdelinger</span>
              </div>
              <Linjediagram linje={data.linje} />
            </section>
            <section className="kort">
              <h2 style={{ fontSize: 20 }}>Deltakelsesgrad per avdeling</h2>
              <p className="undertekst">Andel av beboerne som deltar per besøk</p>
              {data.rader.length ? <Stolpediagram rader={data.rader} /> : <p className="hjelp" style={{ marginTop: 12 }}>Ingen avdelinger ennå.</p>}
            </section>
          </div>

          <section>
            <h2 style={{ fontSize: 24 }}>Sammenligning av avdelinger</h2>
            <div className="tabell-rulle" style={{ marginTop: 12 }}>
              <table className="tabell">
                <thead>
                  <tr>
                    <th>Avdeling</th><th>Besøk</th><th>Deltakere/besøk</th><th>Deltakelsesgrad</th>
                    <th>Stemning</th><th>Mål oppnådd</th><th>Utfordringer fullført</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rader.map((r) => (
                    <tr key={r.id}>
                      <td>{r.navn}{!inst && <span style={{ fontWeight: 600, color: "var(--dempet)" }}> · {r.institusjon}</span>}</td>
                      <td>{r.besok}</td><td>{r.dpb}</td><td>{r.grad}</td>
                      <td>{r.stemning}</td><td>{r.maal}</td><td>{r.utf}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
