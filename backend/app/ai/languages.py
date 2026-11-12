"""Language names used in prompts. The languages offered in the UI come from settings
(SUMMARY_LANGUAGES / TRANSLATION_LANGUAGES); adding one only needs a name here if it is missing."""

LANGUAGE_NAMES = {
    "vi": "Vietnamese",
    "en": "English",
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "th": "Thai",
    "id": "Indonesian",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
}


def language_name(code: str) -> str:
    return LANGUAGE_NAMES.get(code, code)
