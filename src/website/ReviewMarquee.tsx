"use client";

import { useState } from "react";

type Review = { id: string; name: string; message: string };
type Props = { title: string; badge: string; pauseLabel: string; resumeLabel: string; reviews: Review[] };

export default function ReviewMarquee({ title, badge, pauseLabel, resumeLabel, reviews }: Props) {
  const [paused, setPaused] = useState(false);
  const [touching, setTouching] = useState(false);
  function cards(duplicate = false) {
    return <ul className={`reviews-group${duplicate ? " reviews-group-copy" : ""}`} aria-hidden={duplicate || undefined} inert={duplicate || undefined}>
      {reviews.map((review) => <li key={review.id} className="testimonial-card"><figure>
        <blockquote>{review.message}</blockquote>
        <figcaption><span className="testimonial-avatar" aria-hidden="true">{review.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("")}</span><span><strong>{review.name}</strong><small>{badge}</small></span></figcaption>
      </figure></li>)}
    </ul>;
  }
  return <section className="testimonials-section" aria-labelledby="reviews-title">
    <div className="container testimonials-heading"><h2 id="reviews-title">{title}</h2><button type="button" className="reviews-pause" aria-pressed={paused} onClick={() => setPaused(!paused)}><span aria-hidden="true">{paused ? "▶" : "Ⅱ"}</span>{paused ? resumeLabel : pauseLabel}</button></div>
    <div className="reviews-window" data-paused={paused || touching} tabIndex={0} role="region" aria-label={title}
      onTouchStart={() => setTouching(true)}
      onTouchEnd={(event) => setTouching(event.touches.length > 0)} onTouchCancel={() => setTouching(false)}>
      <div className="reviews-track">{cards()}{cards(true)}</div>
    </div>
  </section>;
}
