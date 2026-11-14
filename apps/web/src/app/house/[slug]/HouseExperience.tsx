"use client";

import { useState } from "react";
import { Chat } from "./Chat";
import { Gallery, type GalleryView } from "./Gallery";

/** Owns the visitor's current view so the gallery and the chat agree on where they are. */
export function HouseExperience({
  houseSlug,
  houseTitle,
  views,
  sources,
}: {
  houseSlug: string;
  houseTitle: string;
  views: GalleryView[];
  sources: string[];
}) {
  const [index, setIndex] = useState(0);
  const view = views[index];

  return (
    <div className="house-layout">
      <Gallery views={views} index={index} onChange={setIndex} />
      <Chat houseSlug={houseSlug} houseTitle={houseTitle} sources={sources} currentView={{ id: view.id, label: view.label }} />
    </div>
  );
}
