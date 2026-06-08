"use client";

import { useEffect } from "react";
import { usePlayerStore } from "@/hooks/usePlayer";

export default function PlayerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const loadFromStorage = usePlayerStore((s) => s.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return <>{children}</>;
}
