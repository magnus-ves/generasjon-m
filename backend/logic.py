"""Beregninger: ukenummer, ukas utfordring og dashboard-statistikk.

Antallet i ukas utfordring beregnes alltid her i kode. AI brukes bare til
å skrive teksten til M-vennene, og kan aldri endre tallet.
"""
from datetime import date, timedelta
from statistics import mean
from typing import Optional

from sqlalchemy.orm import Session

import models

UKER_DELTAKELSE = 6


def iso_uke(d: date) -> tuple[int, int]:
    aar, uke, _ = d.isocalendar()
    return aar, uke


def uke_start(aar: int, uke: int) -> date:
    return date.fromisocalendar(aar, uke, 1)


def neste_uke(aar: int, uke: int) -> tuple[int, int]:
    return iso_uke(uke_start(aar, uke) + timedelta(days=7))


def besok_i_uke(db: Session, avdeling_id: int, aar: int, uke: int):
    start = uke_start(aar, uke)
    return (
        db.query(models.Besok)
        .filter(
            models.Besok.avdeling_id == avdeling_id,
            models.Besok.dato >= start,
            models.Besok.dato < start + timedelta(days=7),
        )
        .all()
    )


def fremgang(db: Session, utfordring: models.Utfordring) -> int:
    return sum(
        b.utfordring_bidrag
        for b in besok_i_uke(db, utfordring.avdeling_id, utfordring.aar, utfordring.uke)
    )


def er_fullfort(db: Session, utfordring: models.Utfordring) -> bool:
    return fremgang(db, utfordring) >= utfordring.antall


def _grad(besok: list, beboere: dict) -> Optional[float]:
    verdier = [
        b.deltakere / beboere[b.avdeling_id]
        for b in besok
        if beboere.get(b.avdeling_id)
    ]
    return mean(verdier) if verdier else None


def beregn_antall(
    db: Session, avdeling: models.Avdeling, mal: models.Utfordringsmal, aar: int, uke: int
) -> tuple[int, str]:
    """Returnerer (antall, begrunnelse) for en avdeling og målukens utfordring."""
    alle_avd = db.query(models.Avdeling).all()
    beboere = {a.id: a.antall_beboere for a in alle_avd}
    snitt_beboere = mean(beboere.values()) if beboere else avdeling.antall_beboere

    # 1) Størrelse
    storrelse = avdeling.antall_beboere / snitt_beboere if snitt_beboere else 1
    storrelse = min(max(storrelse, 0.6), 1.5)
    if storrelse >= 1.15:
        stor_tekst = "Stor avdeling"
    elif storrelse <= 0.85:
        stor_tekst = "Mindre avdeling"
    else:
        stor_tekst = "Gjennomsnittlig størrelse"

    # 2) Deltakelse de siste 6 ukene, sammenlignet med alle avdelinger
    fra = uke_start(aar, uke) - timedelta(weeks=UKER_DELTAKELSE)
    til = uke_start(aar, uke)
    siste = (
        db.query(models.Besok)
        .filter(models.Besok.dato >= fra, models.Besok.dato < til)
        .all()
    )
    egen = _grad([b for b in siste if b.avdeling_id == avdeling.id], beboere)
    felles = _grad(siste, beboere)
    if egen is None or not felles:
        deltakelse = 1.0
        delt_tekst = "ingen besøksdata ennå, så deltakelsesfaktoren er satt til 1"
    else:
        deltakelse = min(max(egen / felles, 0.7), 1.3)
        if deltakelse >= 1.1:
            delt_tekst = "god deltakelse"
        elif deltakelse <= 0.9:
            delt_tekst = "lavere deltakelse enn snittet"
        else:
            delt_tekst = "deltakelse på snittet"

    # 3) Historikk: de to siste publiserte utfordringene
    tidligere = (
        db.query(models.Utfordring)
        .filter(
            models.Utfordring.avdeling_id == avdeling.id,
            models.Utfordring.status == "publisert",
            (models.Utfordring.aar * 100 + models.Utfordring.uke) < aar * 100 + uke,
        )
        .order_by(models.Utfordring.aar.desc(), models.Utfordring.uke.desc())
        .limit(2)
        .all()
    )
    historikk = 1.0
    hist_tekst = ""
    if len(tidligere) == 2:
        fullfort = sum(er_fullfort(db, u) for u in tidligere)
        if fullfort == 2:
            historikk = 1.10
            hist_tekst = "de to siste utfordringene ble fullført (+10 %)"
        elif fullfort == 0:
            historikk = 0.85
            hist_tekst = "ingen av de to siste utfordringene ble fullført (−15 %)"
        else:
            hist_tekst = "én av de to siste utfordringene ble fullført"

    antall = max(1, round(mal.basis * storrelse * deltakelse * historikk))
    deler = [f"{stor_tekst} ({avdeling.antall_beboere} beboere)", delt_tekst]
    if hist_tekst:
        deler.append(hist_tekst)
    begrunnelse = ", ".join(deler[:-1]) + " og " + deler[-1] + "."
    return antall, begrunnelse


# ---------- Dashboard ----------


def _fmt(v: Optional[float], desimaler: int = 1) -> str:
    if v is None:
        return "–"
    return f"{v:.{desimaler}f}".replace(".", ",")


def _pst(v: Optional[float]) -> str:
    return "–" if v is None else f"{round(v * 100)} %"


def _nokkeltall(db: Session, besok: list, beboere: dict, utfordringer: list) -> dict:
    n = len(besok)
    maal = [b for b in besok if b.maal_oppnadd]
    avsluttede = utfordringer
    fullforte = sum(er_fullfort(db, u) for u in avsluttede)
    return {
        "besok": n,
        "deltakere": sum(b.deltakere for b in besok),
        "dpb": (sum(b.deltakere for b in besok) / n) if n else None,
        "grad": _grad(besok, beboere),
        "stemning": mean(b.stemning for b in besok) if n else None,
        "maal_ja": (sum(b.maal_oppnadd == "ja" for b in maal) / len(maal)) if maal else None,
        "maal_delvis": (sum(b.maal_oppnadd == "delvis" for b in maal) / len(maal)) if maal else None,
        "utf": (fullforte / len(avsluttede)) if avsluttede else None,
        "utf_avsluttede": len(avsluttede),
    }


STEMNING_NAVN = {1: "Tung", 2: "Litt lav", 3: "Helt ok", 4: "God", 5: "Strålende"}


def dashboard(
    db: Session,
    institusjon_id: Optional[int],
    avdeling_id: Optional[int],
    uker: int,
    idag: Optional[date] = None,
) -> dict:
    idag = idag or date.today()
    denne = iso_uke(idag)
    forste_uke_start = uke_start(*denne) - timedelta(weeks=uker - 1)

    alle_avd = db.query(models.Avdeling).all()
    if institusjon_id:
        avd_utvalg = [a for a in alle_avd if a.institusjon_id == institusjon_id]
    else:
        avd_utvalg = alle_avd
    if avdeling_id:
        avd_utvalg = [a for a in avd_utvalg if a.id == avdeling_id]
    utvalg_ids = {a.id for a in avd_utvalg}
    beboere = {a.id: a.antall_beboere for a in alle_avd}

    alle_besok = (
        db.query(models.Besok)
        .filter(models.Besok.dato >= forste_uke_start, models.Besok.dato <= idag)
        .all()
    )
    besok = [b for b in alle_besok if b.avdeling_id in utvalg_ids]

    denne_nokkel = denne[0] * 100 + denne[1]
    forste = iso_uke(forste_uke_start)
    forste_nokkel = forste[0] * 100 + forste[1]
    avsluttede = [
        u
        for u in db.query(models.Utfordring)
        .filter(models.Utfordring.status == "publisert")
        .all()
        if forste_nokkel <= u.aar * 100 + u.uke < denne_nokkel
    ]

    tall = _nokkeltall(
        db, besok, beboere, [u for u in avsluttede if u.avdeling_id in utvalg_ids]
    )

    # Linjediagram: deltakere per besøk per uke, utvalg mot alle
    uke_liste = [
        iso_uke(forste_uke_start + timedelta(weeks=i)) for i in range(uker)
    ]

    def per_uke(liste):
        ut = []
        for aar, uke in uke_liste:
            start = uke_start(aar, uke)
            b = [x for x in liste if start <= x.dato < start + timedelta(days=7)]
            ut.append(round(sum(x.deltakere for x in b) / len(b), 2) if b else None)
        return ut

    linje = {
        "uker": [f"u{u}" for _, u in uke_liste],
        "utvalg": per_uke(besok),
        "alle": per_uke(alle_besok),
    }

    # Per avdeling (innenfor valgt institusjon)
    rad_avd = (
        [a for a in alle_avd if a.institusjon_id == institusjon_id]
        if institusjon_id
        else alle_avd
    )
    rader = []
    for a in rad_avd:
        t = _nokkeltall(
            db,
            [b for b in alle_besok if b.avdeling_id == a.id],
            beboere,
            [u for u in avsluttede if u.avdeling_id == a.id],
        )
        rader.append(
            {
                "id": a.id,
                "navn": a.navn,
                "institusjon": a.institusjon.navn,
                "besok": t["besok"],
                "dpb": _fmt(t["dpb"]),
                "grad": _pst(t["grad"]),
                "grad_verdi": t["grad"] or 0,
                "stemning": _fmt(t["stemning"]),
                "maal": _pst(t["maal_ja"]),
                "utf": _pst(t["utf"]),
            }
        )

    stemning_hint = (
        f"av 5 · {STEMNING_NAVN[round(tall['stemning'])]}" if tall["stemning"] else "av 5"
    )
    return {
        "tall": [
            {
                "etikett": "Deltakere per besøk",
                "verdi": _fmt(tall["dpb"]),
                "hint": f"{tall['besok']} besøk · {tall['deltakere']} deltakere",
            },
            {
                "etikett": "Deltakelsesgrad",
                "verdi": _pst(tall["grad"]),
                "hint": "Deltakere / antall beboere",
            },
            {"etikett": "Snittstemning", "verdi": _fmt(tall["stemning"]), "hint": stemning_hint},
            {
                "etikett": "Mål oppnådd",
                "verdi": _pst(tall["maal_ja"]),
                "hint": f"+ {_pst(tall['maal_delvis'])} delvis" if tall["maal_delvis"] is not None else "",
            },
            {
                "etikett": "Utfordringer fullført",
                "verdi": _pst(tall["utf"]),
                "hint": f"{tall['utf_avsluttede']} avsluttede",
            },
        ],
        "linje": linje,
        "rader": rader,
        "rå": tall,
    }
