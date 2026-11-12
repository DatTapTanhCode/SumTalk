"""STORAGE_BACKEND=s3: finished audio moves to S3 (moto fake), playback is a presigned redirect."""

import pytest
from conftest import wait_for_status
from test_api import upload, wav_file

BUCKET = "sumtalk-test"


@pytest.fixture()
def s3(monkeypatch):
    from moto import mock_aws

    from app.services import storage

    for name, value in {"AWS_ACCESS_KEY_ID": "test", "AWS_SECRET_ACCESS_KEY": "test", "AWS_DEFAULT_REGION": "us-east-1"}.items():
        monkeypatch.setenv(name, value)
    with mock_aws():
        monkeypatch.setattr(storage.settings, "storage_backend", "s3")
        monkeypatch.setattr(storage.settings, "s3_bucket", BUCKET)
        monkeypatch.setattr(storage.settings, "s3_region", "us-east-1")
        storage._s3.cache_clear()
        storage._s3().create_bucket(Bucket=BUCKET)
        yield storage._s3()
        storage._s3.cache_clear()


def keys(s3) -> list[str]:
    return sorted(item["Key"] for item in s3.list_objects_v2(Bucket=BUCKET).get("Contents", []))


def test_finished_audio_moves_to_s3_and_plays_from_a_presigned_url(client, s3):
    from app.services import storage

    meeting = upload(client, "standup.wav", wav_file(4), title="Stand up")
    done = wait_for_status(client, meeting["id"])
    assert done["status"] == "done" and done["has_audio"]

    prefix = f"sumtalk/meetings/{meeting['id']}/"
    assert keys(s3) == [prefix + "audio.wav", prefix + "original.wav"]
    assert not storage.audio_path(meeting["id"]).exists()  # local copy removed

    response = client.get(f"/api/meetings/{meeting['id']}/audio?download=true", follow_redirects=False)
    assert response.status_code == 307
    location = response.headers["location"]
    assert BUCKET in location and "audio.wav" in location and "attachment" in location

    # Re-transcribing fetches the audio back from S3, then archives it again.
    assert client.post(f"/api/meetings/{meeting['id']}/retranscribe", json={"language": "en"}).status_code == 200
    assert wait_for_status(client, meeting["id"])["status"] == "done"
    assert not storage.audio_path(meeting["id"]).exists()

    assert client.delete(f"/api/meetings/{meeting['id']}").status_code == 204
    assert keys(s3) == []


def test_database_backup_goes_to_s3(s3, tmp_path):
    import sqlite3

    from app.services import storage

    db = tmp_path / "app.db"
    with sqlite3.connect(db) as conn:
        conn.execute("create table t (x)")
        conn.execute("insert into t values (42)")
    key = storage.backup_database(db)
    assert key.startswith("sumtalk/backups/app-") and key in keys(s3)


def test_local_storage_is_untouched_without_s3(client):
    from app.services import storage

    meeting = upload(client, "local.wav", wav_file(2))
    wait_for_status(client, meeting["id"])
    assert storage.audio_path(meeting["id"]).exists()
    assert client.get(f"/api/meetings/{meeting['id']}/audio").status_code == 200
