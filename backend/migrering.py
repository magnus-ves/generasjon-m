"""Oppgraderer en database laget av den første versjonen (med avdelinger)
til dagens modell der institusjonen er eneste nivå. Trygt å kjøre ved
hver oppstart: gjør ingenting når skjemaet allerede er oppdatert."""
from sqlalchemy import MetaData, inspect, text
from sqlalchemy.engine import Engine


def _kolonner(engine: Engine, tabell: str) -> set:
    return {k["name"] for k in inspect(engine).get_columns(tabell)}


def legg_til_manglende_kolonner(engine: Engine, schema: str | None) -> None:
    """Nye kolonner som create_all ikke legger til i eksisterende tabeller."""
    insp = inspect(engine)
    if "utfordringer" not in insp.get_table_names(schema=schema):
        return
    kolonner = {k["name"] for k in insp.get_columns("utfordringer", schema=schema)}
    if "fullfort" not in kolonner:
        tabell = f'"{schema}".utfordringer' if schema else "utfordringer"
        with engine.begin() as con:
            con.execute(text(f"ALTER TABLE {tabell} ADD COLUMN fullfort BOOLEAN"))


def migrer(engine: Engine, metadata: MetaData) -> None:
    tabeller = set(inspect(engine).get_table_names())
    har_avdelinger = "avdelinger" in tabeller

    if "institusjoner" in tabeller and "antall_beboere" not in _kolonner(engine, "institusjoner"):
        with engine.begin() as con:
            con.execute(text(
                "ALTER TABLE institusjoner ADD COLUMN antall_beboere INTEGER NOT NULL DEFAULT 10"
            ))
            if har_avdelinger:
                # Institusjonen får summen av beboerne i sine gamle avdelinger
                con.execute(text(
                    "UPDATE institusjoner SET antall_beboere = COALESCE(("
                    "SELECT SUM(a.antall_beboere) FROM avdelinger a "
                    "WHERE a.institusjon_id = institusjoner.id), 10)"
                ))

    for tabell in ("utfordringer",):
        if tabell not in tabeller or "avdeling_id" not in _kolonner(engine, tabell):
            continue
        if engine.dialect.name != "sqlite":
            # Postgres: legg til institusjon_id, fyll den ut og fjern avdeling_id
            with engine.begin() as con:
                if "institusjon_id" not in _kolonner(engine, tabell):
                    con.execute(text(
                        f"ALTER TABLE {tabell} ADD COLUMN institusjon_id INTEGER "
                        "REFERENCES institusjoner(id)"
                    ))
                con.execute(text(
                    f"UPDATE {tabell} SET institusjon_id = (SELECT a.institusjon_id "
                    f"FROM avdelinger a WHERE a.id = {tabell}.avdeling_id)"
                ))
                con.execute(text(f"DELETE FROM {tabell} WHERE institusjon_id IS NULL"))
                con.execute(text(f"ALTER TABLE {tabell} ALTER COLUMN institusjon_id SET NOT NULL"))
                con.execute(text(f"ALTER TABLE {tabell} DROP COLUMN avdeling_id"))
            continue
        # SQLite kan ikke fjerne en kolonne med fremmednøkkel: bygg tabellen
        # på nytt og kopier radene med institusjon_id slått opp fra avdelingen.
        ny = metadata.tables[tabell]
        gammel = f"{tabell}_gammel"
        with engine.begin() as con:
            con.execute(text(f"ALTER TABLE {tabell} RENAME TO {gammel}"))
        ny.create(engine)
        gamle_kol = _kolonner(engine, gammel)
        felles = [c.name for c in ny.columns if c.name != "institusjon_id" and c.name in gamle_kol]
        kolonner = ", ".join(felles)
        kilde = ", ".join(f"g.{c}" for c in felles)
        with engine.begin() as con:
            con.execute(text(
                f"INSERT INTO {tabell} ({kolonner}, institusjon_id) "
                f"SELECT {kilde}, a.institusjon_id FROM {gammel} g "
                "JOIN avdelinger a ON a.id = g.avdeling_id"
            ))
            con.execute(text(f"DROP TABLE {gammel}"))
