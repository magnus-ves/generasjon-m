export function Gnist({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
    </svg>
  );
}

export function Tilbake() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function Pluss() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function Lås() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

const MUNN = {
  1: "M8 16.5c1.2-1.6 2.5-2.2 4-2.2s2.8.6 4 2.2",
  2: "M8.5 16c1-.8 2.2-1.1 3.5-1.1s2.5.3 3.5 1.1",
  3: "M8.5 15.5h7",
  4: "M8.5 14.5c1 1.1 2.2 1.6 3.5 1.6s2.5-.5 3.5-1.6",
  5: "M7.5 14c1.2 2 2.7 3 4.5 3s3.3-1 4.5-3",
};

export function Fjes({ verdi }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="9" cy="10.5" r=".9" fill="currentColor" />
      <circle cx="15" cy="10.5" r=".9" fill="currentColor" />
      <path d={MUNN[verdi]} />
    </svg>
  );
}
