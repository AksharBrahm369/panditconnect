import Link from "next/link";

export function LegalPage({ title, summary, children }: { title: string; summary: string; children: React.ReactNode }) {
  return <main className="legal-page">
    <nav className="topbar">
      <Link href="/" className="brand"><span className="brand-mark">ॐ</span><span>Pandit in Minutes</span></Link>
      <Link href="/" className="btn btn-ghost">Back home</Link>
    </nav>
    <article className="legal-document">
      <span className="eyebrow">Customer information</span>
      <h1>{title}</h1>
      <p className="legal-summary">{summary}</p>
      <p className="legal-date">Draft updated 6 August 2026 · Obtain Indian legal review before accepting real payments.</p>
      {children}
    </article>
  </main>;
}
