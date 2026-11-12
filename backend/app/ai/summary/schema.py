"""Meeting minutes returned by the summary model (#68). `action_items` + `segment_ids` are stored now so
Sprint 4 (#79 Action items) can use them without re-running the summary."""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


def _clean_list(value):
    """Models sometimes return null or a single string instead of a list."""
    if value is None:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    return [v for v in value if not (isinstance(v, str) and not v.strip())]


class ActionItem(BaseModel):
    task: str
    owner: str | None = None
    due: str | None = None
    segment_ids: list[int] = Field(default_factory=list)  # Segment.idx of the final transcript

    @field_validator("owner", "due", mode="before")
    @classmethod
    def _empty_to_none(cls, value):
        if isinstance(value, str) and value.strip().lower() in ("", "null", "none", "n/a", "unknown"):
            return None
        return value

    @field_validator("segment_ids", mode="before")
    @classmethod
    def _ids(cls, value):
        if value is None:
            return []
        if isinstance(value, (int, str)):
            value = [value]
        ids = []
        for v in value:
            try:
                ids.append(int(str(v).strip("[] ")))
            except ValueError:
                continue
        return ids


class Minutes(BaseModel):
    overview: str
    key_points: list[str] = Field(default_factory=list)
    decisions: list[str] = Field(default_factory=list)
    action_items: list[ActionItem] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)

    _lists = field_validator("key_points", "decisions", "open_questions", mode="before")(_clean_list)

    @field_validator("action_items", mode="before")
    @classmethod
    def _items(cls, value):
        value = _clean_list(value)
        return [{"task": v} if isinstance(v, str) else v for v in value]


# Shown to the model in the prompt.
MINUTES_JSON_SHAPE = """{
  "overview": "2-4 sentences: what the meeting was about and its outcome",
  "key_points": ["main point discussed", "..."],
  "decisions": ["decision that was agreed", "..."],
  "action_items": [{"task": "what must be done", "owner": "person or null", "due": "deadline or null", "segment_ids": [12, 15]}],
  "open_questions": ["question left unresolved", "..."]
}"""
