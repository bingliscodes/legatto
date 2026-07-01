// Hook designed to own the list of tracks
import { useCallback, useState, useEffect } from "react";
import { getTracks, uploadTrack, getJob, type Track } from "@/lib/api";

export function useLibrary() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [status, setStatus] = useState<string>("idle");
  const [stems, setStems] = useState<JobStatus["stems"]>(null);

  async function upload(file: File) {
    setStatus("uploading");
    setStems(null);
    try {
      const job = await uploadTrack(file);
      setJobId(job.id);
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

  // Poll while there's a job that isn't done yet.
  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      try {
        const job = await getJob(jobId);
        setStatus(job.status);

        if (job.status === "finished") setStems(job.stems);
        if (job.status === "finished" || job.status === "failed")
          clearInterval(interval);
      } catch (err) {
        console.error("poll failed:", err);
        setStatus("error");
        clearInterval(interval);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [jobId]);

  useEffect(() => {
    refresh();
  }, [refresh]);
  return { tracks, refresh, upload, status, stems };
}
