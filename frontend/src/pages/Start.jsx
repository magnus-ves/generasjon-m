import { Link } from "react-router-dom";

export default function Start() {
  return (
    <div className="mobil" style={{ justifyContent: "center" }}>
      <div className="logo-plass" style={{ width: 200, height: 72 }}>
        [Generasjon M-logo]
      </div>
      <h1 style={{ marginTop: 32, fontSize: 34, lineHeight: 1.1 }}>Hei, Besøksleder!</h1>
      <p style={{ marginTop: 12, fontSize: 18, lineHeight: 1.55, color: "var(--dempet)" }}>
        Her ser du ukas utfordring. Ta den med deg på besøket!
      </p>
      <div className="stakk" style={{ marginTop: 40 }}>
        <Link to="/mvenn" className="knapp stor">Gå inn som M-venn</Link>
        <Link to="/admin" className="knapp stor sekundar">Gå inn som admin</Link>
      </div>
    </div>
  );
}
