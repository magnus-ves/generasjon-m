"""Ukenummer og beregning av ukas utfordring.

Antallet i ukas utfordring beregnes alltid her i kode, ut fra
institusjonens størrelse, deltakelsen de siste 6 ukene (fra opplastede
besøkstall) og om de klarte de to siste utfordringene.
AI brukes bare til å skrive teksten, og kan aldri endre tallet.
"""
from datetime import date, timedelta
from statistics import mean

from sqlalchemy.orm import Session

import models

UKER_DELTAKELSE = 6


def _nokkel(aar: int, uke: int) -> int:
    return aar * 100 + uke


def siste_besokstall(db: Session, aar: int, uke: int, uker: int = UKER_DELTAKELSE):
    """Besøkstall for ukene før (aar, uke), `uker` uker tilbake."""
    fra = iso_uke(uke_start(aar, uke) - timedelta(weeks=uker))
    return (
        db.query(models.Besokstall)
        .filter(
            (models.Besokstall.aar * 100 + models.Besokstall.uke) >= _nokkel(*fra),
            (models.Besokstall.aar * 100 + models.Besokstall.uke) < _nokkel(aar, uke),
        )
        .all()
    )


def deltakelsesgrad(rader: list, beboere: int) -> float | None:
    """Andel av beboerne som deltar per besøk i snitt."""
    besok = sum(r.besok for r in rader)
    if not besok or not beboere:
        return None
    return sum(r.deltakere for r in rader) / besok / beboere


def iso_uke(d: date) -> tuple[int, int]:
    aar, uke, _ = d.isocalendar()
    return aar, uke


def uke_start(aar: int, uke: int) -> date:
    return date.fromisocalendar(aar, uke, 1)


def neste_uke(aar: int, uke: int) -> tuple[int, int]:
    return iso_uke(uke_start(aar, uke) + timedelta(days=7))


def beregn_antall(
    db: Session, inst: models.Institusjon, mal: models.Utfordringsmal, aar: int, uke: int
) -> tuple[int, str]:
    """Returnerer (antall, begrunnelse) for en institusjon og målukens utfordring."""
    beboere = [i.antall_beboere for i in db.query(models.Institusjon).all()]
    snitt = mean(beboere) if beboere else inst.antall_beboere

    # 1) Størrelse sammenlignet med snittet
    storrelse = min(max(inst.antall_beboere / snitt if snitt else 1, 0.6), 1.5)
    if storrelse >= 1.15:
        deler = [f"Stor institusjon ({inst.antall_beboere} beboere)"]
    elif storrelse <= 0.85:
        deler = [f"Mindre institusjon ({inst.antall_beboere} beboere)"]
    else:
        deler = [f"Gjennomsnittlig størrelse ({inst.antall_beboere} beboere)"]

    # 2) Deltakelse de siste 6 ukene, sammenlignet med alle institusjoner
    alle_inst = {i.id: i for i in db.query(models.Institusjon).all()}
    siste = siste_besokstall(db, aar, uke)
    egen = deltakelsesgrad([r for r in siste if r.institusjon_id == inst.id], inst.antall_beboere)
    grader = [
        g for g in (
            deltakelsesgrad([r for r in siste if r.institusjon_id == iid], i.antall_beboere)
            for iid, i in alle_inst.items()
        ) if g is not None
    ]
    deltakelse = 1.0
    if egen is None or not grader or not mean(grader):
        deler.append("ingen besøkstall de siste ukene, så deltakelsesfaktoren er satt til 1")
    else:
        deltakelse = min(max(egen / mean(grader), 0.7), 1.3)
        if deltakelse >= 1.1:
            deler.append(f"god deltakelse ({round(egen * 100)} % per besøk)")
        elif deltakelse <= 0.9:
            deler.append(f"lavere deltakelse enn snittet ({round(egen * 100)} % per besøk)")
        else:
            deler.append(f"deltakelse på snittet ({round(egen * 100)} % per besøk)")

    # 3) Historikk: de to siste publiserte utfordringene som er vurdert
    tidligere = (
        db.query(models.Utfordring)
        .filter(
            models.Utfordring.institusjon_id == inst.id,
            models.Utfordring.status == "publisert",
            models.Utfordring.fullfort.isnot(None),
            (models.Utfordring.aar * 100 + models.Utfordring.uke) < aar * 100 + uke,
        )
        .order_by(models.Utfordring.aar.desc(), models.Utfordring.uke.desc())
        .limit(2)
        .all()
    )
    historikk = 1.0
    if len(tidligere) < 2:
        deler.append("for lite historikk ennå, så historikkfaktoren er satt til 1")
    else:
        klart = sum(1 for u in tidligere if u.fullfort)
        if klart == 2:
            historikk = 1.10
            deler.append("de to siste utfordringene ble klart (+10 %)")
        elif klart == 0:
            historikk = 0.85
            deler.append("ingen av de to siste utfordringene ble klart (−15 %)")
        else:
            deler.append("én av de to siste utfordringene ble klart")

    antall = max(1, round(mal.basis * storrelse * deltakelse * historikk))
    return antall, ", ".join(deler[:-1]) + " og " + deler[-1] + "."


def ai_kontekst(db: Session, inst: models.Institusjon, aar: int, uke: int) -> str:
    """Kort bakgrunn om institusjonen til AI-teksten, fra opplastede tall."""
    rader = sorted(
        (r for r in siste_besokstall(db, aar, uke) if r.institusjon_id == inst.id),
        key=lambda r: (r.aar, r.uke),
    )
    if not rader:
        return ""
    linjer = [f"uke {r.uke}: {r.deltakere} deltakere på {r.besok} besøk" for r in rader]
    return f"{inst.antall_beboere} beboere. Siste uker: " + "; ".join(linjer) + "."
