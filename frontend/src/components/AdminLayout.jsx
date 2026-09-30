import { useEffect } from "react";
import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import { lagring } from "../api.js";

export default function AdminLayout() {
  const navigate = useNavigate();

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
        <button type="button" className="knapp sekundar" style={{ marginTop: 20 }} onClick={loggUt}>
          Logg ut
        </button>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
