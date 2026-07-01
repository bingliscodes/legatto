from abc import ABC, abstractmethod
from app.config import STORAGE_ROOT


class Storage(ABC):
    @abstractmethod
    def write_file(self, key: str, data: bytes) -> None:
        """Writes file contents to persistent storage
        key: string representing the whole file e.g., {track_id}/{filename}
        data: raw bytes representing file contents
        """
        raise NotImplementedError

    @abstractmethod
    def list_stems(self, track_id: str) -> list[str]:
        pass

    @abstractmethod
    def open(self, key: str) -> bytes:
        pass


class LocalStorage(Storage):
    def write_file(self, key, data):
        p = STORAGE_ROOT / key
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)

    def list_stems(self, track_id):
        return [f.name for f in (STORAGE_ROOT / track_id / "stems").glob("*.wav")]

    def open(self, key):
        return (STORAGE_ROOT / key).read_bytes()


_storage: Storage | None = None


def get_storage() -> Storage:
    global _storage
    if _storage is None:
        _storage = LocalStorage()
    return _storage
