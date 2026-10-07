from app.services.pipeline import plan_commit
from app.services.transcriber import TranscribedSegment


def seg(start, end, text, words=None):
    return TranscribedSegment(start, end, text, "en", words)


def test_silence_skips_ahead_but_keeps_last_second():
    assert plan_commit([], 6.0, final=False, full=False) == ([], 5.0, "")


def test_pause_after_last_sentence_commits_everything():
    segments = [seg(0, 2, "Hello."), seg(2.5, 4, "How are you?")]
    assert plan_commit(segments, 6.0, final=False, full=False) == (segments, 4, "")


def test_sentence_running_into_window_end_is_held_back():
    segments = [seg(0, 2, "Hello."), seg(2.5, 5.9, "Today we will")]
    commit, advance, pending = plan_commit(segments, 6.0, final=False, full=False)
    assert commit == segments[:1]
    assert advance == 2.5  # re-transcribed next time, with more audio
    assert pending == "Today we will"


def test_long_segment_is_split_after_finished_sentence():
    words = [(0.0, 0.5, " Good"), (0.5, 1.0, " morning."), (1.6, 2.0, " Let's"), (2.0, 5.9, " start")]
    commit, advance, pending = plan_commit([seg(0, 5.9, "Good morning. Let's start", words)], 6.0, final=False, full=False)
    assert [s.text for s in commit] == ["Good morning."]
    assert commit[0].end == 1.0
    assert advance == 1.6
    assert pending == "Let's start"


def test_unfinished_single_sentence_waits_for_more_audio():
    commit, advance, pending = plan_commit([seg(0, 5.8, "We need to")], 6.0, final=False, full=False)
    assert (commit, advance, pending) == ([], 0.0, "We need to")


def test_full_window_is_cut_at_the_edge():
    segments = [seg(0, 24.9, "a very long sentence without a pause")]
    assert plan_commit(segments, 25.0, final=False, full=True) == (segments, 25.0, "")


def test_final_window_commits_everything():
    segments = [seg(0, 2.9, "Bye")]
    assert plan_commit(segments, 3.0, final=True, full=False) == (segments, 3.0, "")
