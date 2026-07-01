// Hook designed to own the list of tracks
import { useCallback, useState, useEffect } from "react";
import { getTracks, uploadTrack, type Track } from "@/lib/api";

export function useLibrary() {
  const [tracks, setTracks] = useState<Track[]>([]);

  async function upload(file: File) {
    try {
      const track = await uploadTrack(file);
      setTracks((prev) => [track, ...prev]);
    } catch (err) {
      console.error("upload failed:", err);
    }
  }

  const refresh = useCallback(async () => {
    try {
      const tracks = await getTracks();
      setTracks(tracks);
    } catch (err) {
      console.error("Refresh tracks failed:", err);
    }
  }, []);

  // Poll the list (GET /tracks) while any track is still queued/processing.
  useEffect(() => {
    const hasPending = tracks.some(
      (t) => t.status === "queued" || t.status === "processing",
    );
    if (!hasPending) return;

    const interval = setInterval(() => refresh(), 1500);
    return () => clearInterval(interval);
  }, [tracks, refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);
  return { tracks, refresh, upload };
}
