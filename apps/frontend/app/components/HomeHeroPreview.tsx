"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const briefLines = [
  "checkout refactor dropped customer.email. Add a null guard before sendReceipt().",
  "retry flow skips customer hydration. Re-fetch checkout payload before submitOrder().",
  "receipt worker gets partial customer data. Validate email before queueing the notification."
];

const prefersReducedMotionQuery = "(prefers-reduced-motion: reduce)";

export default function HomeHeroPreview() {
  const [pointerOffset, setPointerOffset] = useState({ x: 0, y: 0 });
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [visibleCharacters, setVisibleCharacters] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const frameRef = useRef<number | null>(null);
  const targetOffsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(prefersReducedMotionQuery);
    const syncPreference = () => setReducedMotion(mediaQuery.matches);
    syncPreference();

    mediaQuery.addEventListener("change", syncPreference);
    return () => mediaQuery.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setVisibleCharacters(briefLines[0].length);
      setActiveLineIndex(0);
      return;
    }

    const activeLine = briefLines[activeLineIndex];
    const atEnd = visibleCharacters >= activeLine.length;
    const atStart = visibleCharacters <= 0;

    const timeout = window.setTimeout(
      () => {
        if (!isDeleting && !atEnd) {
          setVisibleCharacters((current) => current + 1);
          return;
        }

        if (!isDeleting && atEnd) {
          setIsDeleting(true);
          return;
        }

        if (isDeleting && !atStart) {
          setVisibleCharacters((current) => Math.max(0, current - 1));
          return;
        }

        setIsDeleting(false);
        setActiveLineIndex((current) => (current + 1) % briefLines.length);
      },
      !isDeleting && !atEnd ? 26 : !isDeleting && atEnd ? 1700 : atStart ? 260 : 14
    );

    return () => window.clearTimeout(timeout);
  }, [activeLineIndex, isDeleting, reducedMotion, visibleCharacters]);

  useEffect(() => {
    if (reducedMotion) {
      setPointerOffset({ x: 0, y: 0 });
      return;
    }

    const tick = () => {
      setPointerOffset((current) => ({
        x: current.x + (targetOffsetRef.current.x - current.x) * 0.12,
        y: current.y + (targetOffsetRef.current.y - current.y) * 0.12
      }));
      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [reducedMotion]);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reducedMotion) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeX = (event.clientX - bounds.left) / bounds.width;
    const relativeY = (event.clientY - bounds.top) / bounds.height;

    targetOffsetRef.current = {
      x: (relativeX - 0.5) * 20,
      y: (relativeY - 0.5) * 16
    };
  };

  const resetPointer = () => {
    targetOffsetRef.current = { x: 0, y: 0 };
  };

  const activeBrief = useMemo(() => {
    const line = briefLines[activeLineIndex];
    if (reducedMotion) {
      return line;
    }
    return line.slice(0, visibleCharacters);
  }, [activeLineIndex, reducedMotion, visibleCharacters]);

  const shellTransform = reducedMotion
    ? undefined
    : {
        transform: `translate3d(${(pointerOffset.x * 0.16).toFixed(2)}px, ${(pointerOffset.y * 0.16).toFixed(2)}px, 0)`
      };

  const floatingGlowTransform = reducedMotion
    ? undefined
    : {
        transform: `translate3d(${(pointerOffset.x * -0.28).toFixed(2)}px, ${(pointerOffset.y * -0.28).toFixed(2)}px, 0)`
      };

  return (
    <div
      className="group relative"
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      onPointerCancel={resetPointer}
    >
      <div
        className="pointer-events-none absolute inset-4 rounded-[28px] bg-primary/[0.08] blur-2xl transition-transform duration-300"
        style={floatingGlowTransform}
      />
      <div className="tf-glow-card relative p-1">
        <div
          className="rounded-[22px] border border-border bg-gradient-to-br from-card/95 to-secondary/70 p-4 backdrop-blur-md transition-transform duration-200 ease-out sm:p-6"
          style={shellTransform}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-text-secondary">Live issue preview</p>
              <p className="mt-1 text-sm font-semibold text-text-primary">Checkout · null pointer</p>
            </div>
            <span className="rounded-full border border-border bg-card px-2 py-1 text-[10px] font-semibold text-text-secondary">
              New
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            <div
              className="rounded-xl border border-border bg-card px-3 py-3 shadow-sm transition-transform duration-200 sm:px-4"
              style={
                reducedMotion
                  ? undefined
                  : { transform: `translate3d(${(pointerOffset.x * 0.08).toFixed(2)}px, ${(pointerOffset.y * 0.08).toFixed(2)}px, 0)` }
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold text-text-secondary">Fingerprint</p>
                <span className="tf-pill">2 services</span>
              </div>
              <p className="mt-2 break-words font-mono text-[10px] text-text-secondary sm:text-[11px]">
                9e7b… · hash("TypeError" + "at submitOrder…")
              </p>
            </div>

            <div
              className="rounded-xl border border-border bg-card px-3 py-3 shadow-sm transition-transform duration-200 sm:px-4"
              style={
                reducedMotion
                  ? undefined
                  : { transform: `translate3d(${(pointerOffset.x * -0.06).toFixed(2)}px, ${(pointerOffset.y * 0.12).toFixed(2)}px, 0)` }
              }
            >
              <p className="text-xs font-semibold text-text-secondary">Stack (top frames)</p>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-ink px-3 py-2 text-[10px] leading-5 text-white/90 sm:text-[11px]">
{`TypeError: Cannot read properties of undefined
  at submitOrder (checkout.ts:88:13)
  at onClick (Button.tsx:42:9)`}
              </pre>
            </div>

            <div
              className="rounded-xl border border-primary/15 bg-accent-soft px-3 py-3 text-xs text-text-primary shadow-sm sm:px-4"
              style={
                reducedMotion
                  ? undefined
                  : { transform: `translate3d(${(pointerOffset.x * 0.06).toFixed(2)}px, ${(pointerOffset.y * -0.05).toFixed(2)}px, 0)` }
              }
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">
                  AI brief
                </span>
                <span className="rounded-full border border-primary/20 bg-background/70 px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                  likely fix
                </span>
              </div>
              <div className="mt-2 h-10 overflow-hidden text-[12px] leading-5 text-text-primary sm:h-10">
                <span className="break-words">
                  {activeBrief}
                  {!reducedMotion ? (
                    <span className="ml-0.5 inline-block h-[1.05em] w-[0.6ch] animate-pulse bg-text-primary/70 align-[-0.15em]" />
                  ) : null}
                </span>
              </div>
            </div>

            <div
              className="rounded-xl border border-border bg-card px-3 py-3 shadow-sm transition-transform duration-200 sm:px-4"
              style={
                reducedMotion
                  ? undefined
                  : { transform: `translate3d(${(pointerOffset.x * -0.09).toFixed(2)}px, ${(pointerOffset.y * -0.06).toFixed(2)}px, 0)` }
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold text-text-secondary">Connected workflow</p>
                <span className="tf-pill">GitHub + Slack</span>
              </div>
              <p className="mt-2 text-xs leading-6 text-text-secondary">
                Create the GitHub issue, send the alert into Slack, and keep the fix work tied
                to the same incident thread.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div
              className="tf-stat transition-transform duration-200"
              style={
                reducedMotion
                  ? undefined
                  : { transform: `translate3d(${(pointerOffset.x * 0.06).toFixed(2)}px, ${(pointerOffset.y * 0.05).toFixed(2)}px, 0)` }
              }
            >
              <p className="tf-stat-label">Frequency</p>
              <p className="tf-stat-value">58</p>
              <p className="tf-stat-hint">steady trend</p>
            </div>
            <div
              className="tf-stat transition-transform duration-200"
              style={
                reducedMotion
                  ? undefined
                  : { transform: `translate3d(${(pointerOffset.x * -0.05).toFixed(2)}px, ${(pointerOffset.y * -0.04).toFixed(2)}px, 0)` }
              }
            >
              <p className="tf-stat-label">Last seen</p>
              <p className="tf-stat-value">2m ago</p>
              <p className="tf-stat-hint">active incident</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
