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


def get_examples(language, register, text, max_examples=3):
    database = load_database()
    entries = database.get(language, [])
    # On choisit les exemples dont la phrase française ressemble le plus à
    # la demande : un exemple sans rapport pousse le modèle à le recopier
    # tel quel au lieu de traduire la vraie phrase.
    scored = [(e, _similarity(text, e["french"])) for e in entries]
    relevant = [e for e, score in scored if score > 0]
    relevant.sort(key=lambda e: _similarity(text, e["french"]), reverse=True)
    top = relevant[:max_examples]
    if len(top) < max_examples:
        # Aucun exemple pertinent trouvé (phrase courte/isolée type "salut") :
        # on pioche au hasard plutôt que de toujours reprendre les mêmes
        # premières entrées de la base (le tri par score à 0 partout serait
        # sinon stable et renverrait systématiquement les mêmes exemples).
        remaining = [e for e in entries if e not in top]
        random.shuffle(remaining)
        top += remaining[: max_examples - len(top)]
    return [(entry["french"], entry[register]) for entry in top]


def build_prompt(text, language, register, examples):
    label = LANGUAGE_LABELS.get(language, language)
    style = "familier façon SMS" if register == "sms" else "classique"

    examples_block = "\n".join(
        f'FR: "{fr}" -> "{translated}"' for fr, translated in examples
    )

    # Le darija n'a pas d'orthographe officielle : le modèle bascule parfois
    # en alphabet arabe alors que toute la base d'exemples (et l'app) utilise
    # une transcription latine (arabizi, chiffres pour les sons arabes).
    script_note = (
        " Écris toujours en alphabet latin (arabizi), jamais en alphabet arabe."
        if language == "darija"
        else ""
    )

    return (
        f"Tu traduis du français vers le {label} ({style})."
        f"{script_note} "
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


_FRENCH_MARKERS = {
    "je", "tu", "il", "elle", "nous", "vous", "ils", "elles", "le", "la",
    "les", "un", "une", "des", "que", "qui", "pour", "avec", "dans", "sur",
    "est", "suis", "moi", "toi", "et", "de", "du", "au", "aux", "ce",
    "cette", "bon", "bien", "toi",
}


def _french_marker_count(text):
    return len(set(re.findall(r"\w+", text.lower())) & _FRENCH_MARKERS)


_ARABIC_SCRIPT_RE = re.compile(r"[؀-ۿ]")


def _looks_wrong(translation, text, examples, language=None):
    norm = lambda s: re.sub(r"[^\w]", "", s.lower())
    # Le modèle a juste recopié le français au lieu de traduire.
    if norm(translation) == norm(text):
        return True
    # Le modèle a répondu (au moins en partie) en français au lieu de
    # traduire : plusieurs mots-outils français dans une traduction censée
    # être dans une tout autre langue trahissent une réponse ratée.
    if _french_marker_count(translation) >= 2:
        return True
    # Le darija de l'app est transcrit en alphabet latin (arabizi) : une
    # réponse en alphabet arabe casse cette convention, même si le sens est
    # correct (le modèle bascule parfois vers l'arabe standard).
    if language == "darija" and _ARABIC_SCRIPT_RE.search(translation):
        return True
    # Le modèle a recopié la traduction d'un exemple qui ne correspond pas
    # vraiment à la phrase demandée (copie au lieu de généraliser).
    for fr, translated in examples:
        if norm(translation) == norm(translated) and _similarity(text, fr) < 0.4:
            return True
    return False


def _call_ollama(prompt):
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


def translate(text, language, register="classique"):
    if language not in LANGUAGE_LABELS:
        raise ValueError(f"Langue non supportée : {language}")
    if register not in ("classique", "sms"):
        raise ValueError(f"Registre non supporté : {register}")

    examples = get_examples(language, register, text)
    prompt = build_prompt(text, language, register, examples)

    # Si le résultat est manifestement raté (écho du français, réponse encore
    # en français, alphabet arabe pour du darija, copie d'un exemple sans
    # rapport...), on retente avant d'abandonner : chaque appel étant rapide
    # (< 1s en général), quelques tentatives de plus coûtent peu face au gain
    # de fiabilité, sans changer la vitesse perçue dans le cas courant.
    result = _call_ollama(prompt)
    for _ in range(2):
        if not _looks_wrong(result, text, examples, language):
            return result
        result = _call_ollama(prompt)

    return result


def available_languages():
    return list(LANGUAGE_LABELS.keys())
