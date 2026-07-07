from abc import ABC, abstractmethod
import boto3
from botocore.exceptions import ClientError
from pathlib import Path

from app.config import STORAGE_ROOT
from app.config import settings


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
        raise NotImplementedError

    @abstractmethod
    def open(self, key: str) -> bytes:
        raise NotImplementedError

    @abstractmethod
    def url_for(self, key: str) -> str | None:
        raise NotImplementedError


class LocalStorage(Storage):
    def write_file(self, key: str, data: bytes) -> None:
        p = STORAGE_ROOT / key
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)

    def list_stems(self, track_id: str) -> list[str]:
        return sorted(
            [f.name for f in (STORAGE_ROOT / track_id / "stems").glob("*.wav")]
        )

    def open(self, key: str) -> bytes:
        # directory-traversal guard
        safe_input = STORAGE_ROOT.resolve()
        target = (safe_input / key).resolve()

        if not target.is_relative_to(safe_input) or not target.is_file():
            raise FileNotFoundError(key)

        return target.read_bytes()

    def url_for(self, key: str) -> str | None:
        return None


class S3Storage(Storage):
    def __init__(self):
        self.bucket = settings.spaces_bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.spaces_endpoint,
            region_name=settings.spaces_region,
            aws_access_key_id=settings.spaces_key,
            aws_secret_access_key=settings.spaces_secret,
        )

    def write_file(self, key: str, data: bytes) -> None:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data)

    def list_stems(self, track_id: str) -> list[str]:
        res = self.client.list_objects_v2(
            Bucket=self.bucket, Prefix=f"{track_id}/stems/"
        )
        contents = res.get("Contents", [])

        return sorted([Path(i["Key"]).name for i in contents])

    def open(self, key: str) -> bytes:
        try:
            return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()
        except ClientError as e:
            if e.response["Error"]["Code"] in ("NoSuchKey", "404"):
                raise FileNotFoundError(key)
            raise

    def url_for(self, key: str) -> str | None:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=3600,
        )


_storage: Storage | None = None


def get_storage() -> Storage:
    global _storage
    if _storage is None:
        if settings.storage_backend == "s3":
            _storage = S3Storage()
        elif settings.storage_backend == "local":
            _storage = LocalStorage()
        else:
            raise ValueError(f"unknown storage_backend: {settings.storage_backend}")
    return _storage
