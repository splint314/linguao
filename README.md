# Linguao

Application de traduction français → darija / wolof / tahitien, propulsée par Ollama en few-shot prompting.

Trois interfaces partagent le même backend :
- **`frontend/`** — site web responsive : mise en page desktop plein écran (deux panneaux
  français/traduction) à partir de 761px de large, mise en page mobile empilée en dessous.
- **`mobile/`** — application mobile native (Expo / React Native, iOS + Android).

## Structure

```
linguao/
├── backend/
│   ├── app.py                 # API Flask (/translate, /translate/<job_id>, /languages, /health)
│   ├── translator.py          # sélection d'exemples + prompt few-shot + appel Ollama
│   ├── translate_exemples.json  # base d'exemples
│   └── requirements.txt
├── frontend/                  # client web (mobile + desktop 1920x1080)
│   ├── index.html
│   ├── style.css
│   └── script.js
└── mobile/                    # client mobile natif (Expo / React Native)
    ├── App.tsx
    ├── src/
    │   ├── api.ts              # appel du backend (job + polling) + réglage de l'URL
    │   ├── theme.ts             # couleurs, mode clair/sombre
    │   └── components/
    └── app.json
```

## Prérequis

- [Ollama](https://ollama.com) installé
- Python 3.9+
- Node.js 18+ (pour le client mobile)
- L'app [Expo Go](https://expo.dev/go) sur ton téléphone (iOS/Android) pour tester le client mobile sans Xcode/Android Studio

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

### 4. Installer les dépendances du client mobile (optionnel, si tu veux tester sur téléphone)

```bash
cd mobile
npm install
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

Ouvre ensuite **http://localhost:8000** dans le navigateur : sur un écran large (≥761px), l'app
prend tout l'écran avec les panneaux français/traduction côte à côte ; sur mobile, les panneaux
s'empilent et la page redevient scrollable normalement.

Le frontend devine l'adresse du backend automatiquement (port 8000 en dev local → `localhost:5000`,
sinon même origine que la page — utile derrière un reverse proxy en prod). Si besoin, le bouton ⚙️
permet de saisir une adresse manuellement (mémorisée dans le navigateur).

### Client mobile (Expo)

```bash
cd mobile
npm start
```

Scanne le QR code affiché avec l'app **Expo Go** (Android) ou l'appareil photo (iOS) — ton
téléphone doit être sur le même réseau Wi-Fi que ton ordinateur. L'app devine l'adresse du backend
à partir de l'IP utilisée par Expo pour charger le bundle ; si besoin, corrige-la depuis l'icône ⚙️
dans l'app.

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

Pour chaque traduction, le backend pioche 2 exemples pertinents dans `translate_exemples.json` pour la langue et le registre (classique/SMS) demandés, construit un prompt few-shot court, et l'envoie à Ollama via son API locale (`http://localhost:11434/api/generate`).

La requête `/translate` démarre la traduction en tâche de fond et répond immédiatement avec un `job_id` ; le frontend interroge ensuite `/translate/<job_id>` toutes les 1,5s jusqu'à obtenir le résultat. Ce fonctionnement asynchrone évite qu'un proxy (Cloudflare, etc.) ne coupe la connexion si le modèle met du temps à répondre.

## À propos des traductions

Les phrases de `translate_exemples.json` ont été générées avec l'aide d'une IA, pas par des locuteurs natifs. Elles servent de base de départ pour le few-shot prompting mais peuvent contenir des erreurs ou des tournures peu naturelles. Une relecture par des locuteurs natifs du darija, du wolof et du tahitien est recommandée avant tout usage sérieux.

## Pistes d'évolution

- **RAG** : si `translate_exemples.json` grossit (100+ exemples/langue), remplacer la sélection par similarité de mots-clés par une recherche par embeddings + base vectorielle (type Chroma/FAISS) pour choisir les exemples les plus pertinents.
- **Contribution communautaire** : permettre aux locuteurs natifs de proposer/corriger des exemples pour enrichir la base.
- **Build mobile autonome** : générer un APK/IPA installable (via `eas build`) pour ne plus dépendre d'Expo Go.
