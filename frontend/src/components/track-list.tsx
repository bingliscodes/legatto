import { cn } from "@/lib/utils";

import { type Track } from "@/lib/api";

type SelectTrack = (track: Track) => void;

type TrackListProps = {
  tracks: Track[];
  onSelect: SelectTrack;
};

export default function TrackList({ tracks, onSelect }: TrackListProps) {
  if (tracks.length === 0) {
    return <div>No tracks yet</div>;
  }

  return (
    <div>
      {tracks.map((track) => (
        <TrackItem key={track.id} track={track} onSelect={onSelect} />
      ))}
    </div>
  );
}

type TrackItemProps = {
  track: Track;
  onSelect: SelectTrack;
};
function TrackItem({ track, onSelect }: TrackItemProps) {
  const isCompleted = track.status === "completed";
  return (
    <div
      onClick={() => {
        if (isCompleted) onSelect(track);
      }}
      className={cn(
        "flex items-center justify-between gap-4 rounded-md border px-4 py-3",
        isCompleted && "cursor-pointer hover:bg-muted/50",
      )}
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{track.display_name}</p>
        {track.artist && (
          <p className="truncate text-sm text-muted-foreground">
            {track.artist}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
          {track.status}
        </span>
        <span>{new Date(track.created_at).toLocaleString()}</span>
      </div>
    </div>
  );
}
