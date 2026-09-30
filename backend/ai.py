"""AI-tekster via Claude. Uten ANTHROPIC_API_KEY brukes enkle maler i stedet,
så appen fungerer fullt ut også uten AI."""
import json
import os
import re
from typing import Optional

MODEL = os.environ.get("CLAUDE_MODEL", "claude-opus-5-5")

try:
    import anthropic

    _client = anthropic.Anthropic() if os.environ.get("ANTHROPIC_API_KEY") else None
except Exception:  # pakken mangler eller feil oppsett
    anthropic = None
    _client = None


def ai_tilgjengelig() -> bool:
    return _client is not None


def _spor(system: str, bruker: str, max_tokens: int = 2000) -> Optional[str]:
    if not _client:
        return None
    try:
        svar = _client.beta.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            output_config={"effort": "low"},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            system=system,
            messages=[{"role": "user", "content": bruker}],
        )
    except anthropic.APIError:
        return None
    if svar.stop_reason == "refusal":
        return None
    tekst = "".join(b.text for b in svar.content if b.type == "text").strip()
    return tekst or None


SYSTEM = (
    "Du skriver korte, varme og konkrete tekster på norsk bokmål for Generasjon M, "
    "der frivillige M-venner besøker beboere på sykehjem og institusjoner. "
    "Skriv aldri navn eller helseopplysninger om beboere. Svar kun med selve teksten."
)


def utfordringstekst(mal_tekst: str, antall: int) -> str:
    grunn = mal_tekst.replace("{antall}", str(antall))
    tekst = _spor(
        SYSTEM,
        "Skriv én oppmuntrende setning (maks 25 ord) til M-vennene om ukas utfordring. "
        f"Utfordringen er: «{grunn}». Tallet {antall} MÅ stå med siffer og kan ikke endres.",
        max_tokens=1000,
    )
    # AI skal aldri endre tallet: forkast teksten hvis tallene ikke stemmer
    if tekst and re.findall(r"\d+", tekst) == [str(antall)]:
        return tekst.strip("«»\"")
    return grunn + "!"


def konkret_maal(maal: str, aktivitet: str, deltakere: int) -> Optional[str]:
    """Foreslår et mer konkret mål hvis målet mangler tall/tid. None = målet er fint."""
    maal = (maal or "").strip()
    if not maal or re.search(r"\d", maal):
        return None
    tekst = _spor(
        SYSTEM,
        "Gjør dette målet for et besøk konkret og målbart (hva, hvor mange og hvor lenge), "
        f"maks 15 ord. Mål: «{maal}». Aktivitet: «{aktivitet or 'ukjent'}». "
        f"Omtrent {deltakere} beboere pleier å delta.",
        max_tokens=1000,
    )
    if tekst:
        return tekst.strip("«»\"")
    antall = max(2, deltakere or 3)
    akt = (aktivitet or "aktiviteten").lower()
    return f"Få minst {antall} beboere med på {akt} i 15 minutter"


def oppsummering(data: dict) -> str:
    tekst = _spor(
        SYSTEM,
        "Skriv en kort oppsummering (3–5 setninger) av tallene under for en koordinator. "
        "Pek på hva som går bra, hvilke avdelinger som trenger oppfølging, og ett konkret råd. "
        "Ikke finn på tall som ikke står her.\n\n" + json.dumps(data, ensure_ascii=False),
        max_tokens=3000,
    )
    if tekst:
        return tekst
    rader = [r for r in data.get("rader", []) if r["besok"]]
    if not rader:
        return "Det er ikke registrert besøk i perioden ennå."
    best = max(rader, key=lambda r: r["grad_verdi"])
    svak = min(rader, key=lambda r: r["grad_verdi"])
    t = {x["etikett"]: x["verdi"] for x in data["tall"]}
    ut = (
        f"I perioden var det i snitt {t['Deltakere per besøk']} deltakere per besøk, "
        f"og snittstemningen var {t['Snittstemning']} av 5. "
        f"{best['navn']} har høyest deltakelsesgrad ({best['grad']})."
    )
    if svak is not best:
        ut += f" {svak['navn']} har lavest ({svak['grad']}) og kan trenge ekstra oppfølging."
    return ut
