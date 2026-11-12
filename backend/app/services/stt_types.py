"""Types shared by the local (faster-whisper) and remote (OpenAI-compatible API) speech-to-text engines."""

from dataclasses import dataclass


@dataclass
class TranscribedSegment:
    start: float
    end: float
    text: str
    language: str | None
    words: list[tuple[float, float, str]] | None = None  # (start, end, word) when word timestamps were requested


@dataclass
class Detection:
    language: str | None
    probability: float


# Phrases Whisper is known to invent on silence/music (YouTube outro captions in its training data).
HALLUCINATIONS = (
    "subscribe",
    "amara.org",
    "subtitles by",
    "ghiền mì gõ",
    "đăng ký kênh",
    "like và đăng ký",
    "hẹn gặp lại các bạn trong những video tiếp theo",
)


def looks_like_hallucination(text: str, no_speech_prob: float | None, avg_logprob: float | None) -> bool:
    if no_speech_prob is not None and avg_logprob is not None and no_speech_prob > 0.6 and avg_logprob < -0.8:
        return True
    lowered = text.lower()
    return any(phrase in lowered for phrase in HALLUCINATIONS)


# Whisper's language names (OpenAI and Groq answer "english", "Vietnamese"...; we store ISO codes).
WHISPER_LANGUAGES = {
    "en": "english", "zh": "chinese", "de": "german", "es": "spanish", "ru": "russian", "ko": "korean",
    "fr": "french", "ja": "japanese", "pt": "portuguese", "tr": "turkish", "pl": "polish", "ca": "catalan",
    "nl": "dutch", "ar": "arabic", "sv": "swedish", "it": "italian", "id": "indonesian", "hi": "hindi",
    "fi": "finnish", "vi": "vietnamese", "he": "hebrew", "uk": "ukrainian", "el": "greek", "ms": "malay",
    "cs": "czech", "ro": "romanian", "da": "danish", "hu": "hungarian", "ta": "tamil", "no": "norwegian",
    "th": "thai", "ur": "urdu", "hr": "croatian", "bg": "bulgarian", "lt": "lithuanian", "la": "latin",
    "mi": "maori", "ml": "malayalam", "cy": "welsh", "sk": "slovak", "te": "telugu", "fa": "persian",
    "lv": "latvian", "bn": "bengali", "sr": "serbian", "az": "azerbaijani", "sl": "slovenian", "kn": "kannada",
    "et": "estonian", "mk": "macedonian", "br": "breton", "eu": "basque", "is": "icelandic", "hy": "armenian",
    "ne": "nepali", "mn": "mongolian", "bs": "bosnian", "kk": "kazakh", "sq": "albanian", "sw": "swahili",
    "gl": "galician", "mr": "marathi", "pa": "punjabi", "si": "sinhala", "km": "khmer", "sn": "shona",
    "yo": "yoruba", "so": "somali", "af": "afrikaans", "oc": "occitan", "ka": "georgian", "be": "belarusian",
    "tg": "tajik", "sd": "sindhi", "gu": "gujarati", "am": "amharic", "yi": "yiddish", "lo": "lao",
    "uz": "uzbek", "fo": "faroese", "ht": "haitian creole", "ps": "pashto", "tk": "turkmen", "nn": "nynorsk",
    "mt": "maltese", "sa": "sanskrit", "lb": "luxembourgish", "my": "myanmar", "bo": "tibetan", "tl": "tagalog",
    "mg": "malagasy", "as": "assamese", "tt": "tatar", "haw": "hawaiian", "ln": "lingala", "ha": "hausa",
    "ba": "bashkir", "jw": "javanese", "su": "sundanese", "yue": "cantonese",
}
_CODES_BY_NAME = {name: code for code, name in WHISPER_LANGUAGES.items()}


def language_code(value: str | None) -> str | None:
    """'en', 'English', 'english' -> 'en'. Unknown -> None."""
    if not value:
        return None
    value = value.strip().lower()
    if value in WHISPER_LANGUAGES:
        return value
    return _CODES_BY_NAME.get(value)
