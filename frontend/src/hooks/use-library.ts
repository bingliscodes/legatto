// Hook designed to own the list of tracks
import { useCallback, useState, useEffect } from "react";
import { getTracks, uploadTrack, type Track } from "@/lib/api";

export function useLibrary() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string>("idle");

  async function upload(file: File) {
    setUploadStatus("uploading");
    try {
      const track = await uploadTrack(file);
      setTracks((prev) => [track, ...prev]);
    } catch (err) {
      console.error("upload failed:", err);
      setUploadStatus("error");
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
    const interval = setInterval(async () => {
      try {
        const tracks = await getTracks();
        const hasPending = tracks.some(
          (track) => track.status === "queued" || track.status === "processing",
        );
        if (!hasPending) clearInterval(interval);
      } catch (err) {
        console.error("poll failed:", err);
        setUploadStatus("error");
        clearInterval(interval);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [tracks]);

  useEffect(() => {
    refresh();
  }, [refresh]);
  return { tracks, refresh, upload, uploadStatus };
}
