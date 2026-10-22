"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Global voice playback controller.
 *
 * A single threaded module is enough for this app: only one voice message is
 * ever meant to be audible. `play` switches the current speaker automatically,
 * `pause` targets the currently active player, and `stopAll` is wired to chat
 * lifecycle events (leaving the thread, deleting a message, permission change)
 * so a clipped clip never keeps playing in the background.
 *
 * The module state lives outside React on purpose: a player id has to be
 * recognised by every `VoicePlayer` across re-renders. It is reset on the
 * provider's first mount so a StrictMode double-mount cannot keep a stale
 * element alive.
 */

type VoicePlaybackValue = {
  playingId: string | null;
  play: (playerId: string, audioEl: HTMLAudioElement) => void;
  pause: (playerId: string) => void;
  stopAll: () => void;
};

const VoicePlaybackContext = createContext<VoicePlaybackValue | undefined>(undefined);

/** Module-level singleton. Lives outside React for id stability. */
let currentPlayerId: string | null = null;
let currentAudioEl: HTMLAudioElement | null = null;

function stopAudioElement(el: HTMLAudioElement | null): void {
  if (!el) return;
  el.pause();
  el.currentTime = 0;
}

/** Component that builds the context (keeps the type tidy for consumers). */
export const VoicePlaybackProvider = ({ children }: { children: ReactNode }) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const mounted = useRef(true);

  // StrictMode safety: on a second mount (double-invoke in dev, one in prod)
  // tear down any element a previous mount left behind.
  useLayoutEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    stopAudioElement(currentAudioEl);
    currentPlayerId = null;
    currentAudioEl = null;
    setPlayingId(null);
  }, []);

  const value: VoicePlaybackValue = {
    playingId,
    play: useCallback((playerId: string, audioEl: HTMLAudioElement) => {
      if (currentPlayerId === playerId) {
        if (currentAudioEl) {
          if (currentAudioEl.paused) {
            void currentAudioEl.play();
          } else {
            currentAudioEl.pause();
          }
        }
        return;
      }

      if (currentAudioEl && currentPlayerId && currentPlayerId !== playerId) {
        stopAudioElement(currentAudioEl);
      }

      currentPlayerId = playerId;
      currentAudioEl = audioEl;
      setPlayingId(playerId);
      void audioEl.play().catch((error) => {
        console.error("[voice] playback failed", error);
      });
    }, []),
    pause: useCallback((playerId: string) => {
      if (currentPlayerId === playerId && currentAudioEl) {
        currentAudioEl.pause();
      }
    }, []),
    stopAll: useCallback(() => {
      stopAudioElement(currentAudioEl);
      currentPlayerId = null;
      currentAudioEl = null;
      setPlayingId(null);
    }, []),
  };

  return (
    <VoicePlaybackContext.Provider value={value}>
      {children}
    </VoicePlaybackContext.Provider>
  );
};

/**
 * Pulls the global controller. `play` pauses the peer speaker automatically.
 * `pause` only stops the currently active player.
 */
export function useVoicePlayback(): VoicePlaybackValue {
  const ctx = useContext(VoicePlaybackContext);
  if (!ctx) {
    throw new Error("useVoicePlayback must be used inside <VoicePlaybackProvider>");
  }
  return ctx;
}
