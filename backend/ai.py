"""AI-tekster via Claude. Uten ANTHROPIC_API_KEY brukes enkle maler i stedet,
så appen fungerer fullt ut også uten AI."""
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


def utfordringstekst(mal_tekst: str, antall: int, kontekst: str = "") -> str:
    grunn = mal_tekst.replace("{antall}", str(antall))
    bakgrunn = (
        f" Bakgrunn om institusjonen (bruk den til å treffe tonen, ikke gjengi tallene): {kontekst}"
        if kontekst else ""
    )
    tekst = _spor(
        SYSTEM,
        "Skriv én oppmuntrende setning (maks 25 ord) til M-vennene om ukas utfordring. "
        f"Utfordringen er: «{grunn}». Tallet {antall} MÅ stå med siffer og kan ikke endres, "
        "og ingen andre tall skal stå i teksten." + bakgrunn,
        max_tokens=1000,
    )
    # AI skal aldri endre tallet: forkast teksten hvis tallene ikke stemmer
    if tekst and re.findall(r"\d+", tekst) == [str(antall)]:
        return tekst.strip("«»\"")
    return grunn + "!"
