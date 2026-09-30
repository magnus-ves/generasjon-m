const BASE_URL = import.meta.env.VITE_API_URL || "/api";

const ADMIN_KEY = "genm_admin_code";
const INST_KEY = "genm_institusjon";

function les(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function skriv(key, verdi) {
  try {
    if (verdi == null) localStorage.removeItem(key);
    else localStorage.setItem(key, verdi);
  } catch {
    // ignorer (privat nettlesing o.l.)
  }
}

export const lagring = {
  adminKode: () => les(ADMIN_KEY) || "",
  settAdminKode: (k) => skriv(ADMIN_KEY, k),
  institusjon: () => {
    const v = les(INST_KEY);
    return v ? Number(v) : null;
  },
  settInstitusjon: (id) => skriv(INST_KEY, id == null ? null : String(id)),
};

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Code": lagring.adminKode(),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401 && path.startsWith("/admin/")) {
    lagring.settAdminKode(null);
    window.dispatchEvent(new CustomEvent("admin:utlogget"));
    throw new Error("Feil kode");
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(
      typeof detail.detail === "string" ? detail.detail : `Feil (${res.status})`
    );
  }
  return res.json();
}

const post = (path, body) =>
  request(path, { method: "POST", body: JSON.stringify(body) });
const put = (path, body) =>
  request(path, { method: "PUT", body: JSON.stringify(body) });
const del = (path) => request(path, { method: "DELETE" });
const qs = (params) => {
  const q = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== "" && v != null)
  ).toString();
  return q ? `?${q}` : "";
};

export const api = {
  helse: () => request("/health"),
  institusjoner: () => request("/institusjoner"),
  ukasUtfordring: (instId) => request(`/institusjoner/${instId}/utfordring`),

  adminLogin: async (kode) => {
    const res = await fetch(`${BASE_URL}/admin/login`, {
      method: "POST",
      headers: { "X-Admin-Code": kode },
    });
    return res.ok;
  },
  nyInstitusjon: (data) => post("/admin/institusjoner", data),
  endreInstitusjon: (id, data) => put(`/admin/institusjoner/${id}`, data),
  slettInstitusjon: (id) => del(`/admin/institusjoner/${id}`),
  maler: () => request("/admin/maler"),
  nyMal: (data) => post("/admin/maler", data),
  endreMal: (id, data) => put(`/admin/maler/${id}`, data),
  slettMal: (id) => del(`/admin/maler/${id}`),
  uker: () => request("/admin/uker"),
  utfordringer: (aar, uke) => request(`/admin/utfordringer${qs({ aar, uke })}`),
  generer: (data) => post("/admin/utfordringer/generer", data),
  endreUtfordring: (id, data) => put(`/admin/utfordringer/${id}`, data),
  publiser: (data) => post("/admin/utfordringer/publiser", data),
  besokstall: () => request("/admin/besokstall"),
  slettBesokstall: (id) => del(`/admin/besokstall/${id}`),
  importerBesokstall: (fil) =>
    request("/admin/besokstall/import", {
      method: "POST",
      body: fil,
      headers: { "Content-Type": "text/csv" },
    }),
  lastNedMal: async () => {
    const res = await fetch(`${BASE_URL}/admin/besokstall/mal.csv`, {
      headers: { "X-Admin-Code": lagring.adminKode() },
    });
    if (!res.ok) throw new Error(`Feil (${res.status})`);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = "besokstall-mal.csv";
    a.click();
    URL.revokeObjectURL(url);
  },
  eksport: () => request("/admin/eksport"),
};
