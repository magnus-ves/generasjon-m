"""CSV-eksport som Google Sheets kan hente med =IMPORTDATA("<lenke>").

Google Sheets kan ikke sende egne headere, så nøkkelen står i lenken
(?nokkel=...). Uten EKSPORT_NOKKEL er eksporten skrudd av."""
import csv
import io
import os
import secrets

from sqlalchemy.orm import Session

import logic
import models

EKSPORT_NOKKEL = os.environ.get("EKSPORT_NOKKEL", "")

MAAL_TEKST = {"ja": "Ja", "delvis": "Delvis", "nei": "Nei", "": ""}


def nokkel_ok(nokkel: str) -> bool:
    return bool(EKSPORT_NOKKEL) and secrets.compare_digest(nokkel or "", EKSPORT_NOKKEL)


def _csv(rader: list[list]) -> str:
    ut = io.StringIO()
    csv.writer(ut).writerows(rader)
    return ut.getvalue()


def besok(db: Session) -> str:
    rader = [[
        "Dato", "År", "Uke", "Institusjon", "Deltakere", "M-venner", "Aktivitet",
        "Stemning (1-5)", "Stemning", "Mål", "Mål nådd", "Teller på utfordring",
    ]]
    for b in db.query(models.Besok).order_by(models.Besok.dato.desc(), models.Besok.id.desc()):
        aar, uke = logic.iso_uke(b.dato)
        rader.append([
            b.dato.isoformat(), aar, uke, b.institusjon.navn, b.deltakere, b.mvenner,
            b.aktivitet or "", b.stemning, logic.STEMNING_NAVN.get(b.stemning, ""),
            b.maal or "", MAAL_TEKST.get(b.maal_oppnadd or "", ""), b.utfordring_bidrag,
        ])
    return _csv(rader)


def utfordringer(db: Session) -> str:
    rader = [["År", "Uke", "Institusjon", "Antall", "Fremgang", "Fullført", "Status", "Tekst", "Begrunnelse"]]
    liste = (
        db.query(models.Utfordring)
        .order_by(models.Utfordring.aar.desc(), models.Utfordring.uke.desc())
        .all()
    )
    for u in liste:
        fremgang = logic.fremgang(db, u)
        rader.append([
            u.aar, u.uke, u.institusjon.navn, u.antall, fremgang,
            "Ja" if fremgang >= u.antall else "Nei", u.status, u.tekst, u.begrunnelse,
        ])
    return _csv(rader)


def institusjoner(db: Session, uker: int = 52) -> str:
    data = logic.dashboard(db, None, uker)
    rader = [[
        "Institusjon", "Beboere", f"Besøk (siste {uker} uker)", "Deltakere per besøk",
        "Deltakelsesgrad", "Snittstemning", "Mål oppnådd", "Utfordringer fullført",
    ]]
    beboere = {i.id: i.antall_beboere for i in db.query(models.Institusjon).all()}
    for r in data["rader"]:
        rader.append([
            r["navn"], beboere.get(r["id"], ""), r["besok"], r["dpb"], r["grad"],
            r["stemning"], r["maal"], r["utf"],
        ])
    return _csv(rader)


DATASETT = {
    "besok": ("Alle besøk", besok),
    "institusjoner": ("Nøkkeltall per institusjon", institusjoner),
    "utfordringer": ("Ukas utfordringer", utfordringer),
}
