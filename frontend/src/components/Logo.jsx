// Generasjon M-logoen gjenskapt i tekst: «GENERASJON» + M i en blå boks.
export default function Logo({ storrelse = 22 }) {
  return (
    <span className="logo" style={{ fontSize: storrelse }} aria-label="Generasjon M">
      <span aria-hidden="true">GENERASJON</span>
      <span className="logo-m" aria-hidden="true"
        style={{ width: storrelse * 1.6, height: storrelse * 1.6, fontSize: storrelse * 1.15 }}>M</span>
    </span>
  );
}
