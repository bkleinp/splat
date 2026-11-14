"use client";

export type GalleryView = { id: string; label: string; src: string; alt: string; credit?: string };

/**
 * Photo slideshow standing in for the 3D viewer. The selected slide is the
 * visitor's "location", the way the camera pose will be once the engine lands.
 */
export function Gallery({
  views,
  index,
  onChange,
}: {
  views: GalleryView[];
  index: number;
  onChange: (index: number) => void;
}) {
  const view = views[index];
  const many = views.length > 1;
  const go = (delta: number) => onChange((index + delta + views.length) % views.length);

  return (
    <section className="gallery" aria-label="Home photos">
      <div
        className="gallery-frame"
        tabIndex={many ? 0 : undefined}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(-1);
          if (e.key === "ArrowRight") go(1);
        }}
      >
        <img key={view.id} src={view.src} alt={view.alt} />
        <span className="gallery-label">
          {view.label}
          {many && <span className="gallery-count"> · {index + 1}/{views.length}</span>}
        </span>
        {many && (
          <>
            <button type="button" className="gallery-nav prev" aria-label="Previous photo" onClick={() => go(-1)}>
              ‹
            </button>
            <button type="button" className="gallery-nav next" aria-label="Next photo" onClick={() => go(1)}>
              ›
            </button>
          </>
        )}
      </div>

      {many && (
        <div className="gallery-thumbs" role="tablist" aria-label="Rooms">
          {views.map((v, i) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={`gallery-thumb${i === index ? " active" : ""}`}
              onClick={() => onChange(i)}
            >
              <img src={v.src} alt="" />
              <span>{v.label}</span>
            </button>
          ))}
        </div>
      )}

      {view.credit && <p className="gallery-credit muted small">{view.credit}</p>}
    </section>
  );
}
