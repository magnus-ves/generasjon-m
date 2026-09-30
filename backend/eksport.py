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


def nokkel_ok(nokkel: str) -> bool:
    return bool(EKSPORT_NOKKEL) and secrets.compare_digest(nokkel or "", EKSPORT_NOKKEL)


def _csv(rader: list[list]) -> str:
    ut = io.StringIO()
    csv.writer(ut).writerows(rader)
    return ut.getvalue()


def besokstall(db: Session) -> str:
    rader = [["År", "Uke", "Institusjon", "Besøk", "Deltakere", "Deltakere per besøk"]]
    liste = (
        db.query(models.Besokstall)
        .order_by(models.Besokstall.aar.desc(), models.Besokstall.uke.desc())
        .all()
    )
    for b in liste:
        snitt = f"{b.deltakere / b.besok:.1f}".replace(".", ",") if b.besok else ""
        rader.append([b.aar, b.uke, b.institusjon.navn, b.besok, b.deltakere, snitt])
    return _csv(rader)


def _klart(u: models.Utfordring) -> str:
    return {True: "Ja", False: "Nei"}.get(u.fullfort, "Ikke vurdert")


def utfordringer(db: Session) -> str:
    rader = [["År", "Uke", "Institusjon", "Antall", "Klarte det", "Status", "Tekst", "Begrunnelse"]]
    liste = (
        db.query(models.Utfordring)
        .order_by(models.Utfordring.aar.desc(), models.Utfordring.uke.desc())
        .all()
    )
    for u in liste:
        rader.append([
            u.aar, u.uke, u.institusjon.navn, u.antall, _klart(u), u.status, u.tekst, u.begrunnelse,
        ])
    return _csv(rader)


def institusjoner(db: Session) -> str:
    rader = [["Institusjon", "Beboere", "Uker med besøkstall", "Deltakere per besøk",
              "Deltakelsesgrad", "Utfordringer vurdert", "Utfordringer klart"]]
    for i in db.query(models.Institusjon).order_by(models.Institusjon.navn).all():
        tall = db.query(models.Besokstall).filter_by(institusjon_id=i.id).all()
        besok = sum(t.besok for t in tall)
        grad = logic.deltakelsesgrad(tall, i.antall_beboere)
        vurdert = [
            u for u in db.query(models.Utfordring).filter_by(institusjon_id=i.id)
            if u.fullfort is not None
        ]
        rader.append([
            i.navn, i.antall_beboere, len(tall),
            f"{sum(t.deltakere for t in tall) / besok:.1f}".replace(".", ",") if besok else "",
            f"{round(grad * 100)} %" if grad is not None else "",
            len(vurdert), sum(1 for u in vurdert if u.fullfort),
        ])
    return _csv(rader)


DATASETT = {
    "besokstall": ("Besøkstall per uke", besokstall),
    "institusjoner": ("Nøkkeltall per institusjon", institusjoner),
    "utfordringer": ("Ukas utfordringer", utfordringer),
}
