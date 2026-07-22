import json
import random
import re
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


def _similarity(text, other):
    words_a = set(re.findall(r"\w+", text.lower()))
    words_b = set(re.findall(r"\w+", other.lower()))
    if not words_a or not words_b:
        return 0
    return len(words_a & words_b) / len(words_a | words_b)


def get_examples(language, register, text, max_examples=2):
    database = load_database()
    entries = database.get(language, [])
    # On choisit les exemples dont la phrase française ressemble le plus à
    # la demande : un exemple sans rapport pousse le modèle à le recopier
    # tel quel au lieu de traduire la vraie phrase.
    ranked = sorted(entries, key=lambda e: _similarity(text, e["french"]), reverse=True)
    top = ranked[:max_examples]
    if len(top) < max_examples:
        remaining = [e for e in entries if e not in top]
        top += random.sample(remaining, min(max_examples - len(top), len(remaining)))
    return [(entry["french"], entry[register]) for entry in top]


def build_prompt(text, language, register):
    label = LANGUAGE_LABELS.get(language, language)
    style = "familier façon SMS" if register == "sms" else "classique"
    examples = get_examples(language, register, text)

    examples_block = "\n".join(
        f'FR: "{fr}" -> "{translated}"' for fr, translated in examples
    )

    return (
        f"Tu traduis du français vers le {label} ({style}). "
        f"Réponds uniquement par la traduction, sans aucune explication.\n"
        f"{examples_block}\n"
        f'FR: "{text}" ->'
    )


CHATTY_MARKERS = (
    "Voulez-vous", "Souhaitez-vous", "N'hésitez pas", "C'est un dialecte",
    "Puis-je", "Je peux", "N'hésite pas",
)


def _clean_translation(raw):
    text = raw.strip()

    # Le modèle répond parfois sur plusieurs lignes, ex. "FR: ...\n\nDarija: ...".
    # La vraie traduction est presque toujours la dernière ligne non vide.
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if lines:
        text = lines[-1]

    # Le modèle recopie parfois "FR: ... -> traduction" sur une seule ligne :
    # ne garder que la partie après la dernière flèche.
    if "->" in text:
        text = text.rsplit("->", 1)[-1].strip()

    # Si la ligne contient un passage entre guillemets, c'est presque toujours
    # la traduction elle-même (le modèle met souvent une phrase d'intro avant).
    quoted = re.findall(r'["“‘]([^"”’]{2,})["”’]', text)
    if quoted:
        text = quoted[-1].strip()
    else:
        # Sinon, retire un préfixe du style "Traduction :", "Darija :", etc.
        text = re.sub(r'^.{0,60}:\s*', "", text)

    # Coupe avant un éventuel commentaire du modèle qui continue la conversation.
    for marker in CHATTY_MARKERS:
        idx = text.find(marker)
        if idx > 0:
            text = text[:idx].strip()

    return text.strip() or raw.strip()


def translate(text, language, register="classique"):
    if language not in LANGUAGE_LABELS:
        raise ValueError(f"Langue non supportée : {language}")
    if register not in ("classique", "sms"):
        raise ValueError(f"Registre non supporté : {register}")

    prompt = build_prompt(text, language, register)

    response = requests.post(
        OLLAMA_URL,
        json={
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": False,
            # Le modèle reste chargé en mémoire entre les requêtes : évite de
            # repayer le coût de rechargement (~20s) à chaque traduction.
            "keep_alive": "30m",
            "options": {
                # Nos prompts sont courts : un petit contexte réduit le calcul
                # nécessaire par rapport à la fenêtre par défaut du modèle.
                "num_ctx": 1024,
                # Les traductions sont de courtes phrases : on plafonne la
                # génération pour éviter que le modèle ne continue à écrire.
                "num_predict": 100,
                "num_thread": 4,
                # Coupe la génération au premier retour à la ligne : empêche
                # le modèle d'enchaîner sur une explication après la traduction.
                "stop": ["\n"],
                # Une température basse pousse le modèle à recopier tel quel
                # l'exemple donné plutôt qu'à généraliser à la vraie phrase :
                # on reste sur une valeur plus haute pour éviter ce piège.
                "temperature": 0.9,
            },
        },
        timeout=280,
    )
    response.raise_for_status()
    return _clean_translation(response.json()["response"])


def available_languages():
    return list(LANGUAGE_LABELS.keys())
