import os
from datetime import date
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware

import ai
import eksport
import import_besokstall
import logic
import models
from database import SCHEMA, SCHEMA_FEIL, MIDLERTIDIG_DATABASE, SQLALCHEMY_DATABASE_URL, SessionLocal, engine, get_db
from migrering import legg_til_manglende_kolonner, migrer

_db_init_error = SCHEMA_FEIL
try:
    if not SCHEMA:
        # Eget Postgres-skjema starter tomt; bare SQLite kan ha gamle tabeller
        migrer(engine, models.Base.metadata)
    models.Base.metadata.create_all(bind=engine)
    legg_til_manglende_kolonner(engine, SCHEMA)
    with SessionLocal() as _db:
        if not _db.query(models.Utfordringsmal).count():
            _db.add(
                models.Utfordringsmal(
                    tekst="Ta med {antall} beboere som vanligvis ikke ønsker å være med på aktivitet",
                    basis=3,
                )
            )
            _db.commit()
except Exception as e:
    _db_init_error = f"{type(e).__name__}: {e}"

app = FastAPI(title="Generasjon M – M-venn-appen")

def _databasefeil_tekst(e: Exception) -> str:
    return f"Databasefeil: {type(e).__name__}: {str(e).splitlines()[0][:300]}"


@app.exception_handler(SQLAlchemyError)
async def databasefeil(request: Request, e: SQLAlchemyError):
    return JSONResponse({"detail": _databasefeil_tekst(e)}, status_code=500)

# Uten ADMIN_CODE er admin-delen åpen - sett den før appen deles.
ADMIN_CODE = os.environ.get("ADMIN_CODE")


class AdminMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if (
            ADMIN_CODE
            and request.method != "OPTIONS"
            and request.url.path.startswith("/api/admin/")
            and request.headers.get("x-admin-code") != ADMIN_CODE
        ):
            return JSONResponse({"detail": "Feil kode"}, status_code=401)
        return await call_next(request)


app.add_middleware(AdminMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Skjemaer ----------


class InstitusjonIn(BaseModel):
    navn: str = Field(min_length=1)
    antall_beboere: int = Field(ge=1)


class MalIn(BaseModel):
    tekst: str = Field(min_length=1)
    basis: int = Field(ge=1, le=50)


class GenererIn(BaseModel):
    mal_id: int
    aar: int
    uke: int


class UkeIn(BaseModel):
    aar: int
    uke: int


class UtfordringEndring(BaseModel):
    antall: Optional[int] = Field(default=None, ge=1)
    tekst: Optional[str] = None
    # True = klarte det, False = klarte det ikke, "nullstill" via fullfort_nullstill
    fullfort: Optional[bool] = None
    fullfort_nullstill: bool = False


def _institusjon_ut(i: models.Institusjon) -> dict:
    return {"id": i.id, "navn": i.navn, "antall_beboere": i.antall_beboere}


def _utfordring_ut(db: Session, u: models.Utfordring) -> dict:
    return {
        "id": u.id,
        "institusjon_id": u.institusjon_id,
        "institusjon": u.institusjon.navn,
        "aar": u.aar,
        "uke": u.uke,
        "antall": u.antall,
        "tekst": u.tekst,
        "begrunnelse": u.begrunnelse,
        "status": u.status,
        "fullfort": u.fullfort,
    }


# ---------- Offentlig (M-venner) ----------


@app.get("/api/health")
def health():
    return {
        "ok": _db_init_error is None,
        "database": "postgres" if SQLALCHEMY_DATABASE_URL.startswith("postgresql") else "sqlite",
        "midlertidig_database": MIDLERTIDIG_DATABASE,
        "feil": _db_init_error,
        "ai": ai.ai_tilgjengelig(),
    }


@app.get("/api/institusjoner")
def list_institusjoner(db: Session = Depends(get_db)):
    return [
        _institusjon_ut(i)
        for i in db.query(models.Institusjon).order_by(models.Institusjon.navn).all()
    ]


@app.get("/api/institusjoner/{institusjon_id}/utfordring")
def ukas_utfordring(institusjon_id: int, db: Session = Depends(get_db)):
    inst = db.get(models.Institusjon, institusjon_id)
    if not inst:
        raise HTTPException(404, "Fant ikke institusjonen")
    aar, uke = logic.iso_uke(date.today())
    u = (
        db.query(models.Utfordring)
        .filter_by(institusjon_id=institusjon_id, aar=aar, uke=uke, status="publisert")
        .first()
    )
    return {
        "institusjon": _institusjon_ut(inst),
        "uke": uke,
        "utfordring": _utfordring_ut(db, u) if u else None,
    }


# ---------- Admin ----------


@app.post("/api/admin/login")
def admin_login():
    # Middleware har allerede sjekket koden
    return {"ok": True}


@app.post("/api/admin/institusjoner")
def ny_institusjon(data: InstitusjonIn, db: Session = Depends(get_db)):
    i = models.Institusjon(navn=data.navn.strip(), antall_beboere=data.antall_beboere)
    db.add(i)
    db.commit()
    return {"id": i.id}


@app.put("/api/admin/institusjoner/{iid}")
def endre_institusjon(iid: int, data: InstitusjonIn, db: Session = Depends(get_db)):
    i = db.get(models.Institusjon, iid) or _404()
    i.navn = data.navn.strip()
    i.antall_beboere = data.antall_beboere
    db.commit()
    return {"ok": True}


@app.delete("/api/admin/institusjoner/{iid}")
def slett_institusjon(iid: int, db: Session = Depends(get_db)):
    i = db.get(models.Institusjon, iid) or _404()
    db.query(models.Besokstall).filter_by(institusjon_id=iid).delete()
    db.query(models.Utfordring).filter_by(institusjon_id=iid).delete()
    db.delete(i)
    db.commit()
    return {"ok": True}


def _404():
    raise HTTPException(404, "Fant ikke")


@app.get("/api/admin/maler")
def list_maler(db: Session = Depends(get_db)):
    return [
        {"id": m.id, "tekst": m.tekst, "basis": m.basis}
        for m in db.query(models.Utfordringsmal).order_by(models.Utfordringsmal.id).all()
    ]


@app.post("/api/admin/maler")
def ny_mal(data: MalIn, db: Session = Depends(get_db)):
    _sjekk_mal(data)
    m = models.Utfordringsmal(**data.model_dump())
    db.add(m)
    db.commit()
    return {"id": m.id}


@app.put("/api/admin/maler/{mid}")
def endre_mal(mid: int, data: MalIn, db: Session = Depends(get_db)):
    _sjekk_mal(data)
    m = db.get(models.Utfordringsmal, mid) or _404()
    m.tekst, m.basis = data.tekst, data.basis
    db.commit()
    return {"ok": True}


@app.delete("/api/admin/maler/{mid}")
def slett_mal(mid: int, db: Session = Depends(get_db)):
    m = db.get(models.Utfordringsmal, mid) or _404()
    db.query(models.Utfordring).filter_by(mal_id=mid).update({"mal_id": None})
    db.delete(m)
    db.commit()
    return {"ok": True}


def _sjekk_mal(data: MalIn):
    if "{antall}" not in data.tekst:
        raise HTTPException(400, "Malen må inneholde {antall}")


@app.get("/api/admin/uker")
def uker():
    denne = logic.iso_uke(date.today())
    neste = logic.neste_uke(*denne)
    return {"denne": {"aar": denne[0], "uke": denne[1]}, "neste": {"aar": neste[0], "uke": neste[1]}}


@app.get("/api/admin/utfordringer")
def list_utfordringer(aar: int, uke: int, db: Session = Depends(get_db)):
    liste = db.query(models.Utfordring).filter_by(aar=aar, uke=uke).all()
    liste.sort(key=lambda u: u.institusjon.navn)
    return [_utfordring_ut(db, u) for u in liste]


@app.post("/api/admin/utfordringer/generer")
def generer(data: GenererIn, db: Session = Depends(get_db)):
    mal = db.get(models.Utfordringsmal, data.mal_id) or _404()
    for inst in db.query(models.Institusjon).all():
        eksisterende = (
            db.query(models.Utfordring)
            .filter_by(institusjon_id=inst.id, aar=data.aar, uke=data.uke)
            .first()
        )
        if eksisterende and eksisterende.status == "publisert":
            continue
        antall, begrunnelse = logic.beregn_antall(db, inst, mal, data.aar, data.uke)
        tekst = ai.utfordringstekst(mal.tekst, antall, logic.ai_kontekst(db, inst, data.aar, data.uke))
        u = eksisterende or models.Utfordring(institusjon_id=inst.id, aar=data.aar, uke=data.uke)
        u.mal_id, u.antall, u.tekst, u.begrunnelse, u.status = (
            mal.id, antall, tekst, begrunnelse, "utkast",
        )
        db.add(u)
    db.commit()
    return list_utfordringer(data.aar, data.uke, db)


@app.put("/api/admin/utfordringer/{uid}")
def endre_utfordring(uid: int, data: UtfordringEndring, db: Session = Depends(get_db)):
    u = db.get(models.Utfordring, uid) or _404()
    if data.antall is not None:
        u.antall = data.antall
    if data.tekst is not None:
        u.tekst = data.tekst
    if data.fullfort is not None:
        u.fullfort = data.fullfort
    if data.fullfort_nullstill:
        u.fullfort = None
    db.commit()
    return _utfordring_ut(db, u)


@app.post("/api/admin/utfordringer/publiser")
def publiser(data: UkeIn, db: Session = Depends(get_db)):
    n = (
        db.query(models.Utfordring)
        .filter_by(aar=data.aar, uke=data.uke, status="utkast")
        .update({"status": "publisert"})
    )
    db.commit()
    return {"publisert": n}


# ---------- Besøkstall ----------


@app.post("/api/admin/besokstall/import")
async def importer_besokstall(request: Request, db: Session = Depends(get_db)):
    innhold = await request.body()
    if len(innhold) > 5_000_000:
        raise HTTPException(413, "Filen er for stor (maks 5 MB)")
    rader, feil = import_besokstall.les(innhold)
    resultat = import_besokstall.lagre(db, rader) if rader else {
        "nye": 0, "oppdaterte": 0, "utfordringer_vurdert": 0, "ukjente_institusjoner": [],
    }
    return {**resultat, "feil": feil[:50], "antall_feil": len(feil)}


@app.get("/api/admin/besokstall")
def list_besokstall(db: Session = Depends(get_db)):
    liste = (
        db.query(models.Besokstall)
        .order_by(models.Besokstall.aar.desc(), models.Besokstall.uke.desc())
        .limit(500)
        .all()
    )
    return [
        {
            "id": b.id,
            "institusjon": b.institusjon.navn,
            "aar": b.aar,
            "uke": b.uke,
            "besok": b.besok,
            "deltakere": b.deltakere,
        }
        for b in sorted(liste, key=lambda b: (-b.aar, -b.uke, b.institusjon.navn))
    ]


@app.delete("/api/admin/besokstall/{bid}")
def slett_besokstall(bid: int, db: Session = Depends(get_db)):
    b = db.get(models.Besokstall, bid) or _404()
    db.delete(b)
    db.commit()
    return {"ok": True}


@app.get("/api/admin/besokstall/mal.csv")
def besokstall_mal():
    return Response(
        import_besokstall.MAL_CSV.encode("utf-8-sig"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="besokstall-mal.csv"'},
    )


# ---------- Eksport til Google Sheets ----------


@app.get("/api/eksport/{navn}.csv")
def eksport_csv(navn: str, nokkel: str = "", db: Session = Depends(get_db)):
    if not eksport.EKSPORT_NOKKEL:
        raise HTTPException(403, "Eksport er ikke skrudd på (EKSPORT_NOKKEL mangler)")
    if not eksport.nokkel_ok(nokkel):
        raise HTTPException(403, "Feil eksportnøkkel")
    if navn not in eksport.DATASETT:
        raise HTTPException(404, "Ukjent eksport")
    return Response(
        eksport.DATASETT[navn][1](db),
        media_type="text/csv; charset=utf-8",
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/admin/eksport")
def eksport_info():
    return {
        "aktiv": bool(eksport.EKSPORT_NOKKEL),
        "nokkel": eksport.EKSPORT_NOKKEL,
        "datasett": [{"navn": k, "tittel": v[0]} for k, v in eksport.DATASETT.items()],
    }
