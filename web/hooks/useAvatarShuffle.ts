"use client";

import { useCallback, useState } from "react";

import { AVATAR_PALETTES } from "@/lib/avatars";

function getRandomPalette(
  current: number,
) {
  let next = Math.floor(
    Math.random() *
      AVATAR_PALETTES.length,
  );

  if (
    AVATAR_PALETTES.length > 1 &&
    next === current
  ) {
    next =
      (next + 1) %
      AVATAR_PALETTES.length;
  }

  return next;
}

function getRandomReversed() {
  return Math.random() >= 0.5;
}

export function useAvatarShuffle() {
  const [
    palette,
    setPalette,
  ] = useState(() =>
    Math.floor(
      Math.random() *
        AVATAR_PALETTES.length,
    ),
  );

  const [
    reversed,
    setReversed,
  ] = useState(() =>
    getRandomReversed(),
  );

  const shuffle = useCallback(() => {
    setPalette((current) =>
      getRandomPalette(current),
    );

    setReversed(
      getRandomReversed(),
    );
  }, []);

  return {
    palette,
    reversed,
    shuffle,
  };
}