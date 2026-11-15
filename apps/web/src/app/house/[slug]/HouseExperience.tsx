"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { ViewerHandle } from "@playcanvas/supersplat-viewer/viewer";
import { readPose } from "./camera";
import { Chat } from "./Chat";
import { SplatViewer, type SceneProps } from "./SplatViewer";

/**
 * The house page: a full-screen 3D tour with the title and the chat floating
 * over it. Each question carries the camera pose at the moment it's sent, so
 * the answer knows where the visitor is and what they're looking at. The chat
 * can be hidden; it stays mounted so the conversation is kept.
 */
export function HouseExperience({
  houseSlug,
  houseTitle,
  scene,
  sources,
}: {
  houseSlug: string;
  houseTitle: string;
  scene: SceneProps;
  sources: string[];
}) {
  const [chatOpen, setChatOpen] = useState(true);
  const viewerRef = useRef<ViewerHandle | null>(null);

  // The viewer listens for WASD/arrow keys on the whole page, so typing in the
  // chat would also walk the camera. Pause its keyboard input while typing.
  const onTyping = (typing: boolean) => {
    if (viewerRef.current) viewerRef.current.state.inputEnabled = !typing;
  };

  const getPose = () => (viewerRef.current?.state.loaded ? readPose(viewerRef.current) : null);

  return (
    <div className="tour">
      <SplatViewer scene={scene} onViewer={(v) => (viewerRef.current = v)} />

      <header className="tour-header">
        <Link href="/" className="tour-back">
          ← All homes
        </Link>
        <h1>{houseTitle}</h1>
      </header>

      <div className="tour-chat" hidden={!chatOpen}>
        <Chat
          houseSlug={houseSlug}
          houseTitle={houseTitle}
          sources={sources}
          getPose={getPose}
          onTyping={onTyping}
          onClose={() => {
            onTyping(false);
            setChatOpen(false);
          }}
        />
      </div>
      {!chatOpen && (
        <button type="button" className="tour-chat-open" onClick={() => setChatOpen(true)}>
          Ask about this home
        </button>
      )}
    </div>
  );
}
