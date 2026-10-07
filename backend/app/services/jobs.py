"""Minimal in-process job queue. A production system would use Celery/RQ + Redis; the interface stays the same."""

import logging
import queue
import threading
from collections.abc import Callable

log = logging.getLogger(__name__)


class Worker:
    """One background thread running (job, meeting_id) items in order. A job already waiting is not queued twice."""

    def __init__(self, name: str, handlers: dict[str, Callable[[str], None]]) -> None:
        self.name = name
        self.handlers = handlers
        self._queue: queue.Queue[tuple[str, str] | None] = queue.Queue()
        self._waiting: set[tuple[str, str]] = set()
        self._lock = threading.Lock()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        self._thread = threading.Thread(target=self._run, name=f"worker-{self.name}", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._queue.put(None)

    def submit(self, job: str, meeting_id: str) -> None:
        item = (job, meeting_id)
        with self._lock:
            if item in self._waiting:
                return
            self._waiting.add(item)
        self._queue.put(item)

    def _run(self) -> None:
        while (item := self._queue.get()) is not None:
            with self._lock:
                self._waiting.discard(item)
            job, meeting_id = item
            try:
                self.handlers[job](meeting_id)
            except Exception:
                log.exception("Job '%s' failed for meeting %s", job, meeting_id)


_meeting_locks: dict[str, threading.RLock] = {}
_guard = threading.Lock()


def meeting_lock(meeting_id: str) -> threading.RLock:
    """Serializes live transcription and finalization of the same meeting."""
    with _guard:
        return _meeting_locks.setdefault(meeting_id, threading.RLock())
