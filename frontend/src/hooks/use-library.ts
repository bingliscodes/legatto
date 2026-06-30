// Hook designed to own the list of tracks
import { useCallback, useState, useEffect } from "react";
import { getTracks, type Track } from "@/lib/api";

export function useLibrary() {
  const [tracks, setTracks] = useState<Track[]>([]);

  const refresh = useCallback(async () => {
    try {
      const tracks = await getTracks();
      setTracks(tracks);
    } catch (err) {
      console.log("Refresh tracks failed:", err);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, []);
  return { tracks, setTracks, refresh };
}
