import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const HOME = {
  title: "GP Studio — Controller for Valeton GP-5 and GP-50",
  description:
    "Independent controller for Valeton GP-5 and GP-50. Connect over USB or Bluetooth to edit patches, the audio chain, and .prst files.",
};

const PAGES: Record<string, { title: string; description: string }> = {
  "/": HOME,
  "/about": {
    title: "About — GP Studio",
    description:
      "GP Studio is an independent controller for Valeton GP-5 and GP-50. The project is heading toward open source.",
  },
  "/log": {
    title: "MIDI log — GP Studio",
    description: "Live MIDI input log for a connected Valeton GP-5 or GP-50.",
  },
  "/editor": {
    title: "Editor — GP Studio",
    description: "Preset editor for GP Studio.",
  },
  "/library": {
    title: "Library — GP Studio",
    description: "Preset library for GP Studio.",
  },
};

function setMeta(attr: "name" | "property", key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function DocumentHead() {
  const { pathname } = useLocation();

  useEffect(() => {
    const page = PAGES[pathname] ?? HOME;
    document.title = page.title;
    setMeta("name", "description", page.description);
    setMeta("property", "og:title", page.title);
    setMeta("property", "og:description", page.description);
    setMeta("name", "twitter:title", page.title);
    setMeta("name", "twitter:description", page.description);
  }, [pathname]);

  return null;
}
