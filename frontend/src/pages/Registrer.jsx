import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api, lagring } from "../api.js";
import { Fjes, Gnist, Tilbake } from "../components/Ikoner.jsx";

const STEMNINGER = ["Tung", "Litt lav", "Helt ok", "God", "Strålende"];
const MAAL_VALG = [["ja", "Ja"], ["delvis", "Delvis"], ["nei", "Nei"]];

function iDag() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function Teller({ id, label, verdi, onChange, min = 0, hjelp }) {
  const sett = (v) => onChange(Math.max(min, Number.isFinite(v) ? v : min));
  return (
    <div className="felt">
      <label htmlFor={id}>{label}</label>
      {hjelp && <p className="hjelp">{hjelp}</p>}
      <div className="teller">
        <button type="button" aria-label={`Færre – ${label}`} onClick={() => sett(verdi - 1)}>−</button>
        <input
          id={id}
          className="inndata"
          inputMode="numeric"
          value={verdi}
          onChange={(e) => sett(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)}
        />
        <button type="button" aria-label={`Flere – ${label}`} onClick={() => sett(verdi + 1)}>+</button>
      </div>
    </div>
  );
}

export default function Registrer() {
  const instId = lagring.institusjon();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [skjema, setSkjema] = useState({
    dato: iDag(),
    deltakere: 0,
    mvenner: 1,
    aktivitet: "",
    stemning: 0,
    maal: "",
    maal_oppnadd: "",
    utfordring_bidrag: 0,
  });
  const [forslag, setForslag] = useState(null);
  const [avvistForslag, setAvvistForslag] = useState("");
  const [feil, setFeil] = useState("");
  const [sender, setSender] = useState(false);

  useEffect(() => {
    if (instId) api.ukasUtfordring(instId).then(setInfo).catch(() => {});
  }, [instId]);

  if (!instId) return <Navigate to="/mvenn" replace />;

  const sett = (felt) => (verdi) => setSkjema((s) => ({ ...s, [felt]: verdi }));

  async function hentForslag() {
    const maal = skjema.maal.trim();
    if (!maal || maal === avvistForslag) {
      setForslag(null);
      return;
    }
    try {
      const { forslag } = await api.maalforslag({
        maal,
        aktivitet: skjema.aktivitet,
        deltakere: skjema.deltakere,
      });
      setForslag(forslag);
    } catch {
      setForslag(null);
    }
  }

  async function send(e) {
    e.preventDefault();
    if (!skjema.stemning) {
      setFeil("Velg hvordan stemningen var.");
      return;
    }
    setSender(true);
    setFeil("");
    try {
      await api.registrerBesok({ ...skjema, institusjon_id: instId });
      navigate("/mvenn", { state: { registrert: true } });
    } catch (err) {
      setFeil(err.message);
      setSender(false);
    }
  }

  const u = info?.utfordring;

  return (
    <form className="mobil" style={{ gap: 26 }} onSubmit={send}>
      <div>
        <Link to="/mvenn" className="tilbake"><Tilbake />Tilbake</Link>
        <h1 style={{ marginTop: 4, fontSize: 30 }}>Registrer besøk</h1>
        {info && (
          <p style={{ marginTop: 4, fontSize: 18, color: "var(--dempet)" }}>
            {info.institusjon.navn}
          </p>
        )}
      </div>

      <div className="felt">
        <label htmlFor="dato">Dato</label>
        <input id="dato" type="date" className="inndata" required max={iDag()} value={skjema.dato}
          onChange={(e) => sett("dato")(e.target.value)} />
      </div>

      <Teller id="deltok" label="Beboere som deltok" verdi={skjema.deltakere} onChange={sett("deltakere")} />
      <Teller id="mv" label="M-venner på besøket" verdi={skjema.mvenner} onChange={sett("mvenner")} min={1} />

      <div className="felt">
        <label htmlFor="akt">Aktivitet</label>
        <input id="akt" className="inndata" placeholder="F.eks. allsang og vafler" value={skjema.aktivitet}
          onChange={(e) => sett("aktivitet")(e.target.value)} />
      </div>

      <fieldset>
        <legend className="etikett" style={{ marginBottom: 6 }}>Hvordan var stemningen?</legend>
        <div className="stemninger">
          {STEMNINGER.map((navn, i) => (
            <button key={navn} type="button" className="stemning" aria-pressed={skjema.stemning === i + 1}
              onClick={() => sett("stemning")(i + 1)}>
              <Fjes verdi={i + 1} />
              <span>{navn}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="felt">
        <label htmlFor="maal">Mål for besøket</label>
        <input id="maal" className="inndata" placeholder="F.eks. få 5 beboere med på allsang i 15 min"
          value={skjema.maal}
          onChange={(e) => { sett("maal")(e.target.value); setForslag(null); }}
          onBlur={hentForslag} />
        <p className="hjelp">
          Gjør målet konkret: hva, hvor mange og hvor lenge. Ikke skriv navn eller helseopplysninger om beboere.
        </p>
        {forslag && (
          <div role="status" className="forslag">
            <p className="forslag-tittel"><Gnist />Forslag til et mer konkret mål</p>
            <p style={{ marginTop: 8, fontSize: 18 }}>«{forslag}»</p>
            <p className="hjelp" style={{ marginTop: 4 }}>Med tall og tid er det lettere å se hva dere fikk til.</p>
            <div className="rad" style={{ marginTop: 12 }}>
              <button type="button" className="knapp" onClick={() => {
                sett("maal")(forslag);
                setAvvistForslag(forslag);
                setForslag(null);
              }}>Bruk forslaget</button>
              <button type="button" className="knapp sekundar" onClick={() => {
                setAvvistForslag(skjema.maal.trim());
                setForslag(null);
              }}>Behold mitt</button>
            </div>
          </div>
        )}
      </div>

      <fieldset>
        <legend className="etikett" style={{ marginBottom: 6 }}>Nådde dere målet?</legend>
        <div className="valg3">
          {MAAL_VALG.map(([verdi, tekst]) => (
            <button key={verdi} type="button" className="valg" aria-pressed={skjema.maal_oppnadd === verdi}
              onClick={() => sett("maal_oppnadd")(skjema.maal_oppnadd === verdi ? "" : verdi)}>
              {tekst}
            </button>
          ))}
        </div>
      </fieldset>

      {u && (
        <Teller
          id="bidrag"
          label="Teller på ukas utfordring"
          hjelp={`${u.tekst} Hvor mange fikk dere til på dette besøket?`}
          verdi={skjema.utfordring_bidrag}
          onChange={sett("utfordring_bidrag")}
        />
      )}

      {feil && <div role="alert" className="melding feil">{feil}</div>}

      <button type="submit" className="knapp stor" disabled={sender}>
        {sender ? "Registrerer …" : "Registrer besøk"}
      </button>
    </form>
  );
}
