import axios from "axios";
// Will be an env variable later
export const API_BASE = "http://localhost:8000";

export type JobStatus = {
  id: string;
  status: string;
  stems: Record<string, string> | null;
};

export async function uploadTrack(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("audio_file", file);
  const res = await axios.post<string>(`${API_BASE}/tracks/`, formData);
  return res.data;
}

export async function getJob(id: string): Promise<JobStatus> {
  const res = await axios.get<JobStatus>(`${API_BASE}/jobs/${id}`);
  return res.data;
}
