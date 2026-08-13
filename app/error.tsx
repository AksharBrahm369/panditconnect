"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";

const customerCareEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "darshanzala369@gmail.com";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch("/api/client-errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: error.message, digest: error.digest, path: location.pathname }),
      keepalive: true,
    });
  }, [error]);

  const subject = "Help needed with PanditConnect";
  const reference = error.digest ? `\nError reference: ${error.digest}` : "";
  const body = `Namaste Customer Care,\n\nSomething went wrong while I was using PanditConnect. Please help me continue.${reference}\n\nI will describe the issue here: `;
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(customerCareEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return <main className="fatal-error">
    <div>
      <span className="brand-mark">ॐ</span>
      <h1>Something went wrong</h1>
      <p>Your account and request are safe. Please retry. If the problem continues, email Customer Care and describe what happened.</p>
      <div className="fatal-error-actions">
        <button className="btn btn-primary" onClick={reset}>Try again</button>
        <a className="btn btn-ghost" href={gmailUrl} target="_blank" rel="noreferrer"><Mail size={17} /> Email Customer Care</a>
        <Link className="btn btn-ghost" href="/">Go home</Link>
      </div>
      <p className="fatal-error-contact">Customer Care: <a href={`mailto:${customerCareEmail}`}>{customerCareEmail}</a></p>
    </div>
  </main>;
}
