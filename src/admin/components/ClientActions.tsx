"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Pencil, Info } from "lucide-react";

export default function ClientActions({ name, onEdit, onMoreInfo }: { name: string; onEdit: () => void; onMoreInfo: () => void }) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  function open() {
    const bounds = trigger.current?.getBoundingClientRect();
    if (bounds) setPosition({ top: Math.max(8, Math.min(bounds.bottom + 6, window.innerHeight - 112)), left: Math.max(8, Math.min(bounds.right - 170, window.innerWidth - 178)) });
  }
  useEffect(() => {
    if (!position) return;
    menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function outside(event: PointerEvent) {
      if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setPosition(null);
    }
    function keys(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); setPosition(null); trigger.current?.focus(); }
      if (event.key === "Tab") { setPosition(null); trigger.current?.focus(); }
    }
    const close = () => setPosition(null);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keys);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", keys);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [position]);
  return <>
    <button type="button" className="icon-button client-actions-trigger" ref={trigger} aria-label={`Actions for ${name}`} aria-haspopup="menu" aria-expanded={Boolean(position)} aria-controls={position ? menuId : undefined} onClick={() => position ? setPosition(null) : open()} onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); open(); } }}><MoreHorizontal size={19} /></button>
    {position && createPortal(<div className="client-actions-menu" id={menuId} role="menu" aria-label={`${name} actions`} ref={menu} style={position} onKeyDown={event => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("button") || []);
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }}>
      <button type="button" role="menuitem" tabIndex={-1} onClick={() => { setPosition(null); onEdit(); }}><Pencil size={16} />Edit</button>
      <button type="button" role="menuitem" tabIndex={-1} onClick={() => { setPosition(null); onMoreInfo(); }}><Info size={16} />More info</button>
    </div>, document.body)}
  </>;
}
