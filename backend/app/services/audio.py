"""Audio helpers. The project's standard format is 16 kHz, mono, 16-bit PCM WAV - what Whisper expects."""

import os
import uuid
import wave
from pathlib import Path

import numpy as np

from ..config import CHANNELS, SAMPLE_RATE, SAMPLE_WIDTH


class AudioError(Exception):
    """A user-facing problem with an audio file (unsupported, corrupt, no audio track...)."""


def total_samples(chunks: list[Path]) -> int:
    return sum(p.stat().st_size // SAMPLE_WIDTH for p in chunks)


def read_pcm(chunks: list[Path], start: int, end: int) -> np.ndarray:
    """Samples [start, end) of the chunks laid end to end, as float32 in [-1, 1]."""
    parts: list[np.ndarray] = []
    pos = 0
    for path in chunks:
        n = path.stat().st_size // SAMPLE_WIDTH
        if pos + n > start and pos < end:
            a, b = max(start, pos) - pos, min(end, pos + n) - pos
            with open(path, "rb") as f:
                f.seek(a * SAMPLE_WIDTH)
                parts.append(np.frombuffer(f.read((b - a) * SAMPLE_WIDTH), dtype="<i2"))
        pos += n
        if pos >= end:
            break
    if not parts:
        return np.zeros(0, dtype=np.float32)
    return np.concatenate(parts).astype(np.float32) / 32768.0


def load_wav(path: Path) -> np.ndarray:
    """Read a standard-format WAV as float32 samples (what Whisper takes)."""
    with wave.open(str(path), "rb") as w:
        if (w.getframerate(), w.getnchannels(), w.getsampwidth()) != (SAMPLE_RATE, CHANNELS, SAMPLE_WIDTH):
            raise AudioError("audio.wav is not in the standard 16 kHz mono 16-bit format")
        data = w.readframes(w.getnframes())
    return np.frombuffer(data, dtype="<i2").astype(np.float32) / 32768.0


def _open_wav_writer(path: Path) -> wave.Wave_write:
    w = wave.open(str(path), "wb")
    w.setnchannels(CHANNELS)
    w.setsampwidth(SAMPLE_WIDTH)
    w.setframerate(SAMPLE_RATE)
    return w


def assemble_wav(chunks: list[Path], dst: Path) -> float:
    """Join raw PCM recording chunks into one WAV file. Returns the duration in seconds."""
    tmp = dst.with_name(f"{dst.stem}.{uuid.uuid4().hex}.tmp")
    frames = 0
    with _open_wav_writer(tmp) as w:
        for path in chunks:
            data = path.read_bytes()
            w.writeframes(data)
            frames += len(data) // SAMPLE_WIDTH
    os.replace(tmp, dst)
    return frames / SAMPLE_RATE


def convert_to_wav(src: Path, dst: Path) -> float:
    """Decode any audio/video file (PyAV = FFmpeg libraries) into the standard WAV format."""
    import av

    try:
        container = av.open(str(src))
    except Exception as exc:  # av raises many FFmpegError subclasses for unreadable files
        raise AudioError("Unsupported or corrupted file - it could not be opened as audio.") from exc

    tmp = dst.with_name(f"{dst.stem}.{uuid.uuid4().hex}.tmp")
    frames = 0
    try:
        with container:
            if not container.streams.audio:
                raise AudioError("The file has no audio track.")
            stream = container.streams.audio[0]
            resampler = av.AudioResampler(format="s16", layout="mono", rate=SAMPLE_RATE)
            with _open_wav_writer(tmp) as w:

                def write(resampled) -> None:
                    nonlocal frames
                    for frame in resampled:
                        data = frame.to_ndarray()
                        w.writeframes(data.astype("<i2", copy=False).tobytes())
                        frames += data.shape[-1]

                for packet in container.demux(stream):
                    try:
                        decoded = packet.decode()
                    except av.InvalidDataError:
                        continue  # skip a corrupt packet instead of failing the whole file
                    for frame in decoded:
                        write(resampler.resample(frame))
                write(resampler.resample(None))  # flush
    except AudioError:
        tmp.unlink(missing_ok=True)
        raise
    except Exception as exc:
        tmp.unlink(missing_ok=True)
        raise AudioError(f"Could not decode the audio: {exc}") from exc

    if frames == 0:
        tmp.unlink(missing_ok=True)
        raise AudioError("No audio could be decoded from the file.")
    os.replace(tmp, dst)
    return frames / SAMPLE_RATE
