import Link from "next/link";

export default function OnlineLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Link className="mode-return" href="/" aria-label="Torna alla scelta della modalità">← Modalità</Link>
      {children}
    </>
  );
}
