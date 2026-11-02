"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="access-page"><section className="access-card"><h1>The workspace could not load</h1><p>Your saved records remain in storage. Check the connection and try again.</p><button className="primary" onClick={reset}>Try again</button></section></main>;
}
