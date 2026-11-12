"""Summary prompts (#68): single pass (SYSTEM + USER) and map-reduce for long meetings (MAP_USER, REDUCE_USER)."""

from .schema import MINUTES_JSON_SHAPE

SYSTEM = """You write meeting minutes from a transcript.

Rules:
- Use only information that is in the transcript. Never invent people, dates, numbers, decisions or tasks.
- Write every text value in {output_language_name}, even when the meeting mixes several languages.
- Keep English technical terms, product names, code names and people's names exactly as spoken; do not translate them.
- Each transcript line looks like "[segment_id] [hh:mm:ss] text". When possible, put the segment ids that
  support an action item in its "segment_ids".
- A decision is something the participants agreed on. Do not list mere suggestions as decisions.
- Use an empty list when nothing applies. Use null for an unknown owner or due date.
- Return only one JSON object, without code fences or any other text, with exactly this shape:
""" + MINUTES_JSON_SHAPE

USER = """Meeting title: {title}
Output language: {output_language_name} ({output_language})

Transcript:
{transcript}

Write the minutes of this meeting as JSON, in {output_language_name}."""

MAP_USER = """Meeting title: {title}
Output language: {output_language_name} ({output_language})

The transcript is long, so it is split into consecutive parts that overlap by a line or two.
This is part {part} of {total}. Write the minutes of THIS PART ONLY as JSON, in {output_language_name}.
Keep the details (names, numbers, segment ids) - the parts are merged afterwards.

Transcript part {part}/{total}:
{transcript}"""

REDUCE_USER = """Meeting title: {title}
Output language: {output_language_name} ({output_language})

Below are the minutes of {total} consecutive parts of ONE meeting, in chronological order (a JSON list).
Merge them into the minutes of the whole meeting:
- remove duplicates (neighbouring parts overlap slightly) and merge items that say the same thing;
- keep chronological order;
- keep owners, due dates and segment ids of action items;
- write one overview for the whole meeting.
Return one JSON object in the same shape, in {output_language_name}.

PARTIAL SUMMARIES:
{partials}"""

EMPTY_TRANSCRIPT = {
    "vi": "Không có lời nói nào được nhận dạng, nên không có gì để tóm tắt.",
    "en": "No speech was recognized, so there is nothing to summarize.",
}
