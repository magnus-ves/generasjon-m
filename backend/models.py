from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey
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

    institusjon = relationship("Institusjon")


class Besok(Base):
    __tablename__ = "besok"

    id = Column(Integer, primary_key=True)
    institusjon_id = Column(Integer, ForeignKey("institusjoner.id"), nullable=False)
    dato = Column(Date, nullable=False)
    deltakere = Column(Integer, nullable=False)
    mvenner = Column(Integer, nullable=False, default=1)
    aktivitet = Column(String(300), default="")
    stemning = Column(Integer, nullable=False)  # 1-5
    maal = Column(Text, default="")
    maal_oppnadd = Column(String(10), default="")  # ja | delvis | nei
    # Hvor mange som teller mot ukas utfordring (f.eks. beboere som
    # vanligvis ikke blir med)
    utfordring_bidrag = Column(Integer, nullable=False, default=0)
    opprettet = Column(DateTime, default=datetime.utcnow)

    institusjon = relationship("Institusjon")

