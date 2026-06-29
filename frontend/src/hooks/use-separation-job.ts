import { useState, useEffect } from "react";
import { uploadTrack, getJob, type JobStatus } from "@/lib/api";

// Owns the lifecycle of one separation job: upload → poll → expose the stems.
export function useSeparationJob() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("idle"); // "idle" | "uploading" | RQ statuses
  const [stems, setStems] = useState<JobStatus["stems"]>(null);

  // Called by the file picker's onChange (in App). Uploads, then stores the
  // returned id — which kicks off polling via the effect below.
  async function upload(file: File) {
    setStatus("uploading");
    setStems(null);
    try {
      const id = await uploadTrack(file);
      setJobId(id);
    } catch (err) {
      console.error("upload failed:", err);
      setStatus("error");
    }
  }

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

  return { upload, status, stems };
}
