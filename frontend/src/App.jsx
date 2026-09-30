import { Navigate, Route, Routes } from "react-router-dom";
import Start from "./pages/Start.jsx";
import MVenn from "./pages/MVenn.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import AdminLayout from "./components/AdminLayout.jsx";
import AdminUtfordring from "./pages/AdminUtfordring.jsx";
import Maler from "./pages/Maler.jsx";
import Institusjoner from "./pages/Institusjoner.jsx";
import GoogleSheets from "./pages/GoogleSheets.jsx";
import Besokstall from "./pages/Besokstall.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Start />} />
      <Route path="/mvenn" element={<MVenn />} />
      <Route path="/admin/logg-inn" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="utfordring" replace />} />
        <Route path="utfordring" element={<AdminUtfordring />} />
        <Route path="maler" element={<Maler />} />
        <Route path="institusjoner" element={<Institusjoner />} />
        <Route path="besokstall" element={<Besokstall />} />
        <Route path="google-sheets" element={<GoogleSheets />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
