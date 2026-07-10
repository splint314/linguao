# Linguao

Application de traduction français → darija / wolof / tahitien, propulsée par Ollama en few-shot prompting.

## Structure

```
linguao/
├── backend/
│   ├── app.py                 # API Flask (/translate, /languages, /health)
│   ├── translator.py          # sélection d'exemples + prompt few-shot + appel Ollama
│   ├── translate_exemples.json  # base d'exemples (25 phrases par langue)
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── style.css
    ├── script.js
    ├── manifest.json          # PWA installable
    └── sw.js
```

## Prérequis

- [Ollama](https://ollama.com) installé
- Python 3.9+

## Installation

### 1. Récupérer le projet

```bash
git clone git@github.com:splint314/linguao.git
cd linguao
```

### 2. Installer un modèle Ollama

```bash
ollama pull aya:8b
```

Voir la section [Choix du modèle](#choix-du-modèle) plus bas si ta machine est modeste.

### 3. Installer les dépendances du backend

Debian/Ubuntu bloque `pip install` au niveau système (PEP 668) : il faut passer par un environnement virtuel.

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Lancer le projet

Il faut 3 terminaux ouverts en même temps.

```bash
# Terminal 1 — Ollama (si pas déjà lancé en service)
ollama serve

# Terminal 2 — Backend
cd backend
source venv/bin/activate   # à refaire à chaque nouveau terminal
python app.py

# Terminal 3 — Frontend
cd frontend
python3 -m http.server 8000
```

Ouvre ensuite **http://localhost:8000** dans le navigateur.

Sur mobile, ouvre cette même URL puis "Ajouter à l'écran d'accueil" pour installer l'app (PWA).

### Vérifier que ça tourne

```bash
curl http://localhost:5000/health       # doit renvoyer {"status": "ok"}
curl http://localhost:5000/languages    # doit lister darija/wolof/tahitien
```

## Choix du modèle

Le modèle est configuré via `MODEL_NAME` dans `backend/translator.py`.

- **`aya:8b`** (Cohere Aya, ~5 Go) : spécifiquement entraîné pour le multilingue et les langues peu dotées, meilleur choix qualité. Demande une machine correcte (CPU multi-cœurs, ~5 Go de RAM libres, idéalement un GPU).
- **`qwen2.5:1.5b`** (~1 Go) : beaucoup plus léger, adapté à une machine modeste (peu de CPU/RAM, pas de GPU), au prix d'une qualité de traduction moindre.

```bash
ollama pull qwen2.5:1.5b
```

puis change `MODEL_NAME = "qwen2.5:1.5b"` dans `backend/translator.py`.

## Comment ça marche

Pour chaque traduction, le backend pioche quelques exemples pertinents dans `translate_exemples.json` pour la langue et le registre (classique/SMS) demandés, construit un prompt few-shot, et l'envoie à Ollama via son API locale (`http://localhost:11434/api/generate`).

## À propos des traductions

Les phrases de `translate_exemples.json` ont été générées avec l'aide d'une IA, pas par des locuteurs natifs. Elles servent de base de départ pour le few-shot prompting mais peuvent contenir des erreurs ou des tournures peu naturelles. Une relecture par des locuteurs natifs du darija, du wolof et du tahitien est recommandée avant tout usage sérieux.

## Pistes d'évolution

- **RAG** : si `translate_exemples.json` grossit (100+ exemples/langue), remplacer la sélection aléatoire par une recherche par similarité (embeddings + base vectorielle type Chroma/FAISS) pour choisir les exemples les plus pertinents.
- **Historique** : sauvegarder les traductions précédentes côté client (localStorage) ou serveur.
- **Contribution communautaire** : permettre aux locuteurs natifs de proposer/corriger des exemples pour enrichir la base.
