import { type Track } from "@/lib/api";

export default function TrackList({
  tracks,
  onSelect,
}: {
  tracks: Track[];
  onSelect: (track: Track) => void;
}) {
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

function TrackItem({
  track,
  onSelect,
}: {
  track: Track;
  onSelect: (track: Track) => void;
}) {
  return (
    <div
      onClick={() => onSelect(track)}
      className="flex items-center justify-between gap-4 rounded-md border px-4 py-3"
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
