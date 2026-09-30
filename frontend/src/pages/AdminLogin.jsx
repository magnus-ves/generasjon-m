import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, lagring } from "../api.js";
import { Lås } from "../components/Ikoner.jsx";

export default function AdminLogin() {
  const [kode, setKode] = useState("");
  const [feil, setFeil] = useState(false);
  const [sender, setSender] = useState(false);
  const navigate = useNavigate();

  async function loggInn(e) {
    e.preventDefault();
    setSender(true);
    const ok = await api.adminLogin(kode).catch(() => false);
    setSender(false);
    if (ok) {
      lagring.settAdminKode(kode || "åpen");
      navigate("/admin/utfordring");
    } else {
      setFeil(true);
    }
  }

  return (
    <div className="mobil" style={{ justifyContent: "center", padding: "40px 20px" }}>
      <div className="logo-plass" style={{ alignSelf: "center", width: 180, height: 60 }}>
        [Generasjon M-logo]
      </div>
      <form onSubmit={loggInn} className="kort skygge stakk" style={{ marginTop: 32, padding: 24, gap: 16 }}>
        <h1 style={{ fontSize: 24, display: "flex", alignItems: "center", gap: 8 }}>
          <Lås />Admin
        </h1>
        <div className="felt">
          <label htmlFor="kode">Skriv inn adminkode</label>
          <input
            id="kode"
            type="password"
            autoFocus
            className={`inndata${feil ? " feil" : ""}`}
            style={{ fontSize: 18, letterSpacing: "0.2em" }}
            value={kode}
            onChange={(e) => { setKode(e.target.value); setFeil(false); }}
          />
        </div>
        {feil && <div role="alert" className="melding feil">Feil kode</div>}
        <button type="submit" className="knapp" disabled={sender}>Logg inn</button>
      </form>
      <Link to="/" style={{ marginTop: 24, textAlign: "center", fontWeight: 700 }}>Tilbake til start</Link>
    </div>
  );
}
