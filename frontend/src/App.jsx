import { Navigate, Route, Routes } from "react-router-dom";
import Start from "./pages/Start.jsx";
import MVenn from "./pages/MVenn.jsx";
import Registrer from "./pages/Registrer.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import AdminLayout from "./components/AdminLayout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import AdminUtfordring from "./pages/AdminUtfordring.jsx";
import Maler from "./pages/Maler.jsx";
import Institusjoner from "./pages/Institusjoner.jsx";
import GoogleSheets from "./pages/GoogleSheets.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Start />} />
      <Route path="/mvenn" element={<MVenn />} />
      <Route path="/mvenn/registrer" element={<Registrer />} />
      <Route path="/admin/logg-inn" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="utfordring" element={<AdminUtfordring />} />
        <Route path="maler" element={<Maler />} />
        <Route path="institusjoner" element={<Institusjoner />} />
        <Route path="google-sheets" element={<GoogleSheets />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
