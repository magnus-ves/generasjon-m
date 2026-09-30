from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from database import Base


class Institusjon(Base):
    __tablename__ = "institusjoner"

    id = Column(Integer, primary_key=True)
    navn = Column(String(200), nullable=False)
    antall_beboere = Column(Integer, nullable=False, default=10)


class Utfordringsmal(Base):
    __tablename__ = "utfordringsmaler"

    id = Column(Integer, primary_key=True)
    # Tekst med plassholderen {antall}, f.eks. "Ta med {antall} beboere som ..."
    tekst = Column(Text, nullable=False)
    basis = Column(Integer, nullable=False, default=3)


class Utfordring(Base):
    __tablename__ = "utfordringer"

    id = Column(Integer, primary_key=True)
    institusjon_id = Column(Integer, ForeignKey("institusjoner.id"), nullable=False)
    mal_id = Column(Integer, ForeignKey("utfordringsmaler.id"), nullable=True)
    aar = Column(Integer, nullable=False)
    uke = Column(Integer, nullable=False)
    antall = Column(Integer, nullable=False)
    tekst = Column(Text, nullable=False)
    begrunnelse = Column(Text, default="")
    status = Column(String(20), nullable=False, default="utkast")  # utkast | publisert
    # Satt av admin etter uka: klarte de utfordringen? None = ikke vurdert
    fullfort = Column(Boolean, nullable=True)

    institusjon = relationship("Institusjon")


class Besokstall(Base):
    """Opplastede besøkstall per institusjon og uke (ingen personopplysninger)."""

    __tablename__ = "besokstall"

    id = Column(Integer, primary_key=True)
    institusjon_id = Column(Integer, ForeignKey("institusjoner.id"), nullable=False)
    aar = Column(Integer, nullable=False)
    uke = Column(Integer, nullable=False)
    besok = Column(Integer, nullable=False, default=1)  # antall besøk den uka
    deltakere = Column(Integer, nullable=False)  # beboere som deltok totalt

    institusjon = relationship("Institusjon")
