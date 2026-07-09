# Linguao

Application de traduction français → darija / wolof / tahitien, propulsée par Ollama (Llama 3.x) en few-shot prompting.

## Structure

```
linguao/
├── backend/
│   ├── app.py                 # API Flask (/translate, /languages, /health)
│   ├── translator.py          # sélection d'exemples + prompt few-shot + appel Ollama
│   ├── translate_exemples.json
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── style.css
    ├── script.js
    ├── manifest.json          # PWA installable
    └── sw.js
```

## Lancer le projet

```bash
# Terminal 1 — Ollama
ollama serve
ollama pull aya:8b   # si ce n'est pas déjà fait

# Terminal 2 — Backend
cd backend
pip install -r requirements.txt
python app.py

# Terminal 3 — Frontend
cd frontend
python -m http.server 8000
```

Ouvre ensuite http://localhost:8000.

### Choix du modèle

`aya:8b` (Cohere Aya) est le modèle par défaut configuré dans `backend/translator.py` — il est spécifiquement entraîné pour le multilingue/langues peu dotées, donc plus adapté ici que Llama 3. Il demande cependant une machine correcte (~5 Go de RAM libres). Sur une machine modeste (peu de CPU/RAM, pas de GPU), utilise plutôt un modèle plus léger :

```bash
ollama pull qwen2.5:1.5b
```

puis change `MODEL_NAME` dans `backend/translator.py`.

Sur mobile, ouvre cette même URL dans le navigateur puis "Ajouter à l'écran d'accueil" pour l'installer comme une app (PWA).

## Comment ça marche

Pour chaque traduction, le backend pioche quelques exemples pertinents dans `translate_exemples.json` pour la langue et le registre (classique/SMS) demandés, construit un prompt few-shot, et l'envoie à Ollama via son API locale (`http://localhost:11434/api/generate`).

## Pistes d'évolution

- **RAG** : si `translate_exemples.json` grossit (100+ exemples/langue), remplacer la sélection aléatoire par une recherche par similarité (embeddings + base vectorielle type Chroma/FAISS) pour choisir les exemples les plus pertinents.
- **Historique** : sauvegarder les traductions précédentes côté client (localStorage) ou serveur.
- **Contribution communautaire** : permettre aux locuteurs natifs de proposer/corriger des exemples pour enrichir la base.
