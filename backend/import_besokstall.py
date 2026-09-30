"""Import av besøkstall fra CSV (Excel: «Lagre som CSV», Google Sheets:
«Last ned → CSV»).

Hver rad er enten en uke (Uke + År) eller ett besøk (Dato). Rader for samme
institusjon og uke slås sammen, og en ny opplasting av samme uke erstatter
de gamle tallene, så det er trygt å laste opp samme fil flere ganger.

Kolonner (store/små bokstaver spiller ingen rolle):
  Institusjon (påkrevd), Deltakere (påkrevd),
  Uke + År  eller  Dato,
  Besøk (valgfri, standard 1 per rad),
  Klarte utfordringen (valgfri: ja/nei).
"""
import csv
import io
import re
from datetime import date, datetime

from sqlalchemy.orm import Session

import logic
import models

ALIASER = {
    "institusjon": {"institusjon", "sykehjem", "sted"},
    "deltakere": {"deltakere", "deltok", "beboere som deltok", "antall deltakere", "antall beboere som deltok"},
    "uke": {"uke", "ukenummer", "week"},
    "aar": {"år", "aar", "year"},
    "dato": {"dato", "date"},
    "besok": {"besøk", "besok", "antall besøk", "antall besok"},
    "klart": {"klarte utfordringen", "utfordring klart", "klart", "klarte"},
}


def _normaliser(navn: str) -> str:
    return re.sub(r"\s+", " ", (navn or "").strip().lower().lstrip("﻿"))


def _heltall(verdi: str, felt: str) -> int:
    v = (verdi or "").strip().replace(" ", "")
    if not re.fullmatch(r"\d+", v):
        raise ValueError(f"«{felt}» må være et heltall (fikk «{verdi}»)")
    return int(v)


def _dato(verdi: str) -> date:
    v = (verdi or "").strip()
    for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%d/%m/%Y", "%d.%m.%y"):
        try:
            return datetime.strptime(v, fmt).date()
        except ValueError:
            pass
    raise ValueError(f"ukjent datoformat «{verdi}» (bruk f.eks. 30.09.2026)")


def les(innhold: bytes) -> tuple[list[dict], list[str]]:
    """Returnerer (rader, feil). Hver rad: institusjon, aar, uke, besok, deltakere, klart."""
    try:
        tekst = innhold.decode("utf-8-sig")
    except UnicodeDecodeError:
        tekst = innhold.decode("cp1252")  # eldre Excel på Windows
    if not tekst.strip():
        return [], ["Filen er tom."]
    try:
        dialekt = csv.Sniffer().sniff(tekst.splitlines()[0], delimiters=";,\t")
    except csv.Error:
        dialekt = csv.excel
    leser = csv.reader(io.StringIO(tekst), dialekt)
    overskrifter = [_normaliser(h) for h in next(leser, [])]

    kolonne = {}
    for felt, navn in ALIASER.items():
        for i, h in enumerate(overskrifter):
            if h in navn:
                kolonne[felt] = i
                break
    mangler = [f for f in ("institusjon", "deltakere") if f not in kolonne]
    if "dato" not in kolonne and "uke" not in kolonne:
        mangler.append("uke eller dato")
    if mangler:
        return [], [
            "Fant ikke kolonnen " + ", ".join(f"«{m}»" for m in mangler)
            + ". Første rad må være overskrifter, f.eks. Institusjon;År;Uke;Besøk;Deltakere."
        ]

    rader, feil = [], []
    for linjenr, rad in enumerate(leser, start=2):
        if not any(c.strip() for c in rad):
            continue
        hent = lambda felt: rad[kolonne[felt]] if felt in kolonne and kolonne[felt] < len(rad) else ""
        try:
            navn = hent("institusjon").strip()
            if not navn:
                raise ValueError("institusjon mangler")
            if "dato" in kolonne and hent("dato").strip():
                aar, uke = logic.iso_uke(_dato(hent("dato")))
            else:
                uke = _heltall(hent("uke"), "Uke")
                aar = _heltall(hent("aar"), "År") if hent("aar").strip() else date.today().isocalendar()[0]
                logic.uke_start(aar, uke)  # sjekker at uka finnes
            besok = _heltall(hent("besok"), "Besøk") if hent("besok").strip() else 1
            klart_tekst = _normaliser(hent("klart"))
            klart = {"ja": True, "j": True, "yes": True, "nei": False, "n": False, "no": False}.get(klart_tekst)
            if klart_tekst and klart is None:
                raise ValueError(f"«Klarte utfordringen» må være ja eller nei (fikk «{hent('klart')}»)")
            rader.append({
                "institusjon": navn, "aar": aar, "uke": uke, "besok": besok,
                "deltakere": _heltall(hent("deltakere"), "Deltakere"), "klart": klart,
            })
        except ValueError as e:
            feil.append(f"Linje {linjenr}: {e}")
    return rader, feil


def lagre(db: Session, rader: list[dict]) -> dict:
    institusjoner = {_normaliser(i.navn): i for i in db.query(models.Institusjon).all()}
    ukjente, uker = set(), {}
    for r in rader:
        inst = institusjoner.get(_normaliser(r["institusjon"]))
        if not inst:
            ukjente.add(r["institusjon"])
            continue
        nokkel = (inst.id, r["aar"], r["uke"])
        samlet = uker.setdefault(nokkel, {"besok": 0, "deltakere": 0, "klart": None})
        samlet["besok"] += r["besok"]
        samlet["deltakere"] += r["deltakere"]
        if r["klart"] is not None:
            samlet["klart"] = r["klart"]

    nye = oppdaterte = vurderte = 0
    for (iid, aar, uke), tall in uker.items():
        eksisterende = db.query(models.Besokstall).filter_by(institusjon_id=iid, aar=aar, uke=uke).first()
        if eksisterende:
            eksisterende.besok, eksisterende.deltakere = tall["besok"], tall["deltakere"]
            oppdaterte += 1
        else:
            db.add(models.Besokstall(institusjon_id=iid, aar=aar, uke=uke, besok=tall["besok"], deltakere=tall["deltakere"]))
            nye += 1
        if tall["klart"] is not None:
            u = (
                db.query(models.Utfordring)
                .filter_by(institusjon_id=iid, aar=aar, uke=uke, status="publisert")
                .first()
            )
            if u:
                u.fullfort = tall["klart"]
                vurderte += 1
    db.commit()
    return {
        "nye": nye,
        "oppdaterte": oppdaterte,
        "utfordringer_vurdert": vurderte,
        "ukjente_institusjoner": sorted(ukjente),
    }


MAL_CSV = (
    "Institusjon;År;Uke;Besøk;Deltakere;Klarte utfordringen\n"
    "Lier sykehjem;2026;39;2;11;ja\n"
    "Lier sykehjem;2026;40;1;6;nei\n"
)
