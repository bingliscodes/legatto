import axios from "axios";
// Will be an env variable later
export const API_BASE = "http://localhost:8000";

export type JobStatus = {
  id: string;
  status: string;
  stems: Record<string, string> | null;
};

export async function uploadTrack(file: File): Promise<string> {
  // POST /tracks/
  try {
    const res = await axios.post<JobStatus>(`${API_BASE}/tracks`, { file });
    return res.data;
  } catch (err) {
    // Handle axios error
  }
}
