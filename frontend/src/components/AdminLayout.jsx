import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import { api, lagring } from "../api.js";

export default function AdminLayout() {
  const navigate = useNavigate();
  const [helse, setHelse] = useState(null);

  useEffect(() => {
    api.helse().then(setHelse).catch(() => setHelse({ feil: "Får ikke kontakt med serveren." }));
  }, []);

  useEffect(() => {
    const ut = () => navigate("/admin/logg-inn");
    window.addEventListener("admin:utlogget", ut);
    return () => window.removeEventListener("admin:utlogget", ut);
  }, [navigate]);

  if (!lagring.adminKode()) return <Navigate to="/admin/logg-inn" replace />;

  function loggUt() {
    lagring.settAdminKode(null);
    navigate("/");
  }

  return (
    <div className="admin">
      <nav aria-label="Adminmeny">
        <div className="logo-plass" style={{ width: 150, height: 40, fontSize: 12, marginBottom: 20 }}>[Logo]</div>
        <NavLink to="/admin/dashboard">Dashboard</NavLink>
        <NavLink to="/admin/utfordring">Ukas utfordring</NavLink>
        <NavLink to="/admin/maler">Utfordringsmaler</NavLink>
        <NavLink to="/admin/institusjoner">Institusjoner</NavLink>
        <NavLink to="/admin/google-sheets">Google Sheets</NavLink>
        <button type="button" className="knapp sekundar" style={{ marginTop: 20 }} onClick={loggUt}>
          Logg ut
        </button>
      </nav>
      <main>
        {helse?.feil && (
          <div role="alert" className="melding feil">Databasen virker ikke: {helse.feil}</div>
        )}
        {helse?.midlertidig_database && (
          <div role="status" className="melding feil">
            Ingen database er koblet til, så alt lagres midlertidig og kan forsvinne. Koble en Postgres-database
            til Vercel-prosjektet (Storage → Create Database) og deploy på nytt.
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
