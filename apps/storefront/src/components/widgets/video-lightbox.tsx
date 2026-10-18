"use client";

import { useState, useEffect, useCallback } from "react";
import { youtubeId } from "@biztrackbd/core/builder-client";

export function VideoLightboxSection({
  title,
  titleBn,
  subtitle,
  subtitleBn,
  badge,
  badgeBn,
  videoUrl,
  coverImage,
  aspectRatio = "16-9",
  playLabel = "Watch Video",
  playLabelBn = "ভিডিওটি দেখুন",
  lang,
  ed,
  editing,
}: {
  title?: string;
  titleBn?: string;
  subtitle?: string;
  subtitleBn?: string;
  badge?: string;
  badgeBn?: string;
  videoUrl?: string;
  coverImage?: string;
  aspectRatio?: "16-9" | "4-3" | "21-9";
  playLabel?: string;
  playLabelBn?: string;
  lang: "en" | "bn";
  ed: (path: string) => Record<string, string>;
  editing?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const displayTitle = lang === "bn" && titleBn ? titleBn : title;
  const displaySubtitle = lang === "bn" && subtitleBn ? subtitleBn : subtitle;
  const displayBadge = lang === "bn" && badgeBn ? badgeBn : badge;
  const displayPlay = lang === "bn" && playLabelBn ? playLabelBn : playLabel;

  const ytId = videoUrl ? youtubeId(videoUrl) : null;
  const isDirectVideo = videoUrl ? /\.(mp4|webm|ogg)($|\?)/i.test(videoUrl) : false;

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleClose]);

  // Fallback cover if none provided
  const fallbackCover = ytId ? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg` : "";
  const effectiveCover = coverImage || fallbackCover;

  return (
    <section className="bt-lightbox-sec">
      <div className="wrap">
        {(displayBadge || displayTitle || displaySubtitle || editing) && (
          <div className="bt-lightbox-head">
            {displayBadge && (
              <span className="bt-lightbox-badge" {...ed("badge")}>
                {displayBadge}
              </span>
            )}
            {displayTitle && <h2 {...ed("title")}>{displayTitle}</h2>}
            {displaySubtitle && <p className="muted" {...ed("subtitle")}>{displaySubtitle}</p>}
          </div>
        )}

        <div className={`bt-lightbox-frame bt-aspect-${aspectRatio}`}>
          <div
            className="bt-lightbox-poster"
            style={effectiveCover ? { backgroundImage: `url(${effectiveCover})` } : undefined}
          >
            <div className="bt-lightbox-overlay" />
            
            <button
              type="button"
              className="bt-lightbox-trigger"
              onClick={() => {
                if (videoUrl) setIsOpen(true);
              }}
              aria-label={displayPlay || "Play Video"}
            >
              <span className="bt-play-btn-halo" aria-hidden="true" />
              <span className="bt-play-btn-circle">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <polygon points="6 4 20 12 6 20 6 4" />
                </svg>
              </span>
              {displayPlay && (
                <span className="bt-play-label" {...ed("playLabel")}>
                  {displayPlay}
                </span>
              )}
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="bt-lightbox-modal" role="dialog" aria-modal="true" onClick={handleClose}>
            <div className="bt-lightbox-backdrop" />
            <div className="bt-lightbox-dialog" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="bt-lightbox-close"
                onClick={handleClose}
                aria-label="Close video player"
              >
                &times;
              </button>

              <div className="bt-lightbox-video-holder">
                {ytId ? (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1`}
                    title={displayTitle || "Video player"}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="bt-lightbox-iframe"
                  />
                ) : isDirectVideo && videoUrl ? (
                  <video
                    src={videoUrl}
                    controls
                    autoPlay
                    playsInline
                    className="bt-lightbox-native-video"
                  />
                ) : videoUrl ? (
                  <iframe
                    src={videoUrl}
                    title={displayTitle || "Video player"}
                    allow="autoplay; fullscreen"
                    allowFullScreen
                    className="bt-lightbox-iframe"
                  />
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
