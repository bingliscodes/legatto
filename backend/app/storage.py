from abc import ABC, abstractmethod
from pathlib import Path
from app.config import STORAGE_ROOT


class Storage(ABC):
    @abstractmethod
    def write_file(self, file_contents: bytes) -> None:
        """Writes file contents to persistent storage"""
        raise NotImplementedError

    @abstractmethod
    def list_stems(self, track_id: str) -> list[str]:
        pass

    @abstractmethod
    def open(self, key: str) -> bytes:
        pass


class LocalStorage(Storage):
    pass
