"use client";

export default function WebsiteError({ reset }: { reset: () => void }) {
  return <main className="website-error"><h1>This page could not load</h1><p>Please try again in a moment.</p><button onClick={reset}>Try again</button></main>;
}
