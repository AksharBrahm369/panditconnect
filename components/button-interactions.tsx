"use client";

import { useEffect } from "react";

const interactiveSelector = [
  "button:not([disabled])",
  "a.btn",
  "a.icon-button",
  "[role='button']:not([aria-disabled='true'])",
].join(",");

function animateControl(source: EventTarget | null, clientX?: number, clientY?: number) {
  if (!(source instanceof Element)) return;
  const control = source.closest<HTMLElement>(interactiveSelector);
  if (!control || control.matches(":disabled") || control.getAttribute("aria-disabled") === "true") return;

  const rect = control.getBoundingClientRect();
  const diameter = Math.max(rect.width, rect.height) * 1.45;
  const x = clientX ?? rect.left + rect.width / 2;
  const y = clientY ?? rect.top + rect.height / 2;

  control.querySelector(".interaction-ripple")?.remove();
  const ripple = document.createElement("span");
  ripple.className = "interaction-ripple";
  ripple.setAttribute("aria-hidden", "true");
  ripple.style.width = `${diameter}px`;
  ripple.style.height = `${diameter}px`;
  ripple.style.left = `${x - rect.left - diameter / 2}px`;
  ripple.style.top = `${y - rect.top - diameter / 2}px`;

  control.classList.remove("interaction-clicked");
  void control.offsetWidth;
  control.classList.add("has-interaction-effect", "interaction-clicked");
  control.appendChild(ripple);

  ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
  window.setTimeout(() => control.classList.remove("interaction-clicked"), 360);
}

export function ButtonInteractions() {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => animateControl(event.target, event.clientX, event.clientY);
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.repeat && (event.key === "Enter" || event.key === " ")) animateControl(event.target);
    };

    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return null;
}
