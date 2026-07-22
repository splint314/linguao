import json
import random
from pathlib import Path

import requests

DATA_PATH = Path(__file__).parent / "translate_exemples.json"
OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "aya:8b"

LANGUAGE_LABELS = {
    "darija": "darija (arabe marocain)",
    "wolof": "wolof (Sénégal)",
    "tahitien": "tahitien (reo tahiti)",
}


def load_database():
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)["translation_database"]


def get_examples(language, register, max_examples=2):
    database = load_database()
    entries = database.get(language, [])
    sample = random.sample(entries, min(max_examples, len(entries)))
    return [(entry["french"], entry[register]) for entry in sample]


def build_prompt(text, language, register):
    label = LANGUAGE_LABELS.get(language, language)
    style = "familier façon SMS" if register == "sms" else "classique"
    examples = get_examples(language, register)

    examples_block = "\n".join(
        f'FR: "{fr}" -> "{translated}"' for fr, translated in examples
    )

    return (
        f"Tu es un traducteur expert du français vers le {label}, style {style}.\n"
        f"Voici des exemples de traduction :\n"
        f"{examples_block}\n\n"
        f'Traduis uniquement la phrase suivante, sans explication ni commentaire : "{text}"'
    )


def translate(text, language, register="classique"):
    if language not in LANGUAGE_LABELS:
        raise ValueError(f"Langue non supportée : {language}")
    if register not in ("classique", "sms"):
        raise ValueError(f"Registre non supporté : {register}")

    prompt = build_prompt(text, language, register)

    response = requests.post(
        OLLAMA_URL,
        json={"model": MODEL_NAME, "prompt": prompt, "stream": False},
        timeout=280,
    )
    response.raise_for_status()
    return response.json()["response"].strip()


def available_languages():
    return list(LANGUAGE_LABELS.keys())
