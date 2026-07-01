// Hook designed to own the list of tracks
import { useCallback, useState, useEffect } from "react";
import { getTracks, uploadTrack, type Track } from "@/lib/api";

export function useLibrary() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [status, setStatus] = useState<string>("idle");

  async function upload(file: File) {
    setStatus("uploading");
    try {
      await uploadTrack(file);
    } catch (err) {
      console.error("upload failed:", err);
      setStatus("error");
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

  useEffect(() => {
    refresh();
  }, [refresh]);
  return { tracks, refresh, upload };
}
