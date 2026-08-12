"use client";

import { type RefObject, useLayoutEffect, useRef } from "react";
import { PANDIT_PAGE_TRANSLATIONS } from "@/lib/pandit-page-translations";

function translatedText(source: string, language: string) {
  if (language === "English") return source;
  const dictionary = PANDIT_PAGE_TRANSLATIONS[language];
  if (!dictionary) return source;
  const leading = source.match(/^\s*/)?.[0] ?? "";
  const trailing = source.match(/\s*$/)?.[0] ?? "";
  const clean = source.trim();
  if (!clean) return source;
  const exact = dictionary[clean];
  if (exact) return `${leading}${exact}${trailing}`;

  let match = clean.match(/^(\d+) items? remaining$/i);
  if (match) return `${leading}${match[1]} ${dictionary[Number(match[1]) === 1 ? "item remaining" : "items remaining"] ?? "items remaining"}${trailing}`;
  match = clean.match(/^Review (\d+) missing items?$/i);
  if (match) return `${leading}${dictionary["Review missing items"] ?? "Review missing items"} (${match[1]})${trailing}`;
  match = clean.match(/^Namaste,\s*(.+)$/i);
  if (match) return `${leading}${dictionary.Namaste ?? "Namaste"}, ${match[1]}${trailing}`;
  return source;
}

export function usePanditPageLocalizer(root: RefObject<HTMLElement | null>, language: string, enabled: boolean) {
  const originalText = useRef(new WeakMap<Text, string>());
  const appliedText = useRef(new WeakMap<Text, string>());
  const originalAttributes = useRef(new WeakMap<Element, Map<string, string>>());
  const appliedAttributes = useRef(new WeakMap<Element, Map<string, string>>());

  useLayoutEffect(() => {
    if (!enabled || !root.current) return;
    const container = root.current;
    const translateNode = (textNode: Text) => {
      const parent = textNode.parentElement;
      if (!parent || parent.closest("input, textarea, script, style, [data-no-translate]")) return;
      const current = textNode.nodeValue ?? "";
      const priorApplied = appliedText.current.get(textNode);
      let source = originalText.current.get(textNode);
      if (source === undefined || (current !== priorApplied && current !== source)) {
        source = current;
        originalText.current.set(textNode, source);
      }
      const next = translatedText(source, language);
      appliedText.current.set(textNode, next);
      if (current !== next) textNode.nodeValue = next;
    };
    const translateElement = (element: Element) => {
      for (const name of ["placeholder", "title", "aria-label"]) {
        const current = element.getAttribute(name);
        if (!current) continue;
        let sources = originalAttributes.current.get(element);
        let applied = appliedAttributes.current.get(element);
        if (!sources) { sources = new Map(); originalAttributes.current.set(element, sources); }
        if (!applied) { applied = new Map(); appliedAttributes.current.set(element, applied); }
        const priorApplied = applied.get(name);
        let source = sources.get(name);
        if (source === undefined || (current !== priorApplied && current !== source)) {
          source = current;
          sources.set(name, source);
        }
        const next = translatedText(source, language).trim();
        applied.set(name, next);
        if (current !== next) element.setAttribute(name, next);
      }
    };
    const translateTree = (start: Node) => {
      if (start.nodeType === Node.TEXT_NODE) translateNode(start as Text);
      if (start.nodeType === Node.ELEMENT_NODE) translateElement(start as Element);
      const walker = document.createTreeWalker(start, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      let node = walker.nextNode();
      while (node) {
        if (node.nodeType === Node.TEXT_NODE) translateNode(node as Text);
        else translateElement(node as Element);
        node = walker.nextNode();
      }
    };
    translateTree(container);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") translateNode(mutation.target as Text);
        if (mutation.type === "attributes") translateElement(mutation.target as Element);
        mutation.addedNodes.forEach(translateTree);
      }
    });
    observer.observe(container, { childList: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "title", "aria-label"], subtree: true });
    return () => observer.disconnect();
  }, [enabled, language, root]);
}
