import threading
import time
import uuid

from flask import Flask, jsonify, request
from flask_cors import CORS

import translator

app = Flask(__name__)
CORS(app)

jobs = {}
JOB_TTL_SECONDS = 3600

# Le CPU de ce serveur sature dès que plusieurs traductions tournent en même
# temps (pas de GPU, inférence 100% CPU). Ce verrou force les traductions à
# s'exécuter une par une plutôt que de se battre pour les mêmes cœurs.
ollama_lock = threading.Lock()

# Protège toutes les lectures/écritures de `jobs` : plusieurs threads (requêtes
# utilisateur + robots qui scannent le site) peuvent y accéder en même temps.
jobs_lock = threading.Lock()


def _prune_old_jobs():
    cutoff = time.time() - JOB_TTL_SECONDS
    with jobs_lock:
        for job_id in [jid for jid, job in jobs.items() if job.get("created_at", 0) < cutoff]:
            jobs.pop(job_id, None)


def _set_job(job_id, **fields):
    with jobs_lock:
        jobs[job_id].update(**fields)


def _get_job(job_id):
    with jobs_lock:
        return jobs.get(job_id)


def run_translation(job_id, text, language, register):
    try:
        with ollama_lock:
            _set_job(job_id, status="running")
            result = translator.translate(text, language, register)
        _set_job(job_id, status="done", translation=result)
    except ValueError as e:
        _set_job(job_id, status="error", error=str(e))
    except Exception as e:
        _set_job(job_id, status="error", error=f"Erreur lors de l'appel à Ollama : {e}")


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/languages")
def languages():
    return jsonify({"languages": translator.available_languages()})


@app.route("/translate", methods=["POST"])
def translate():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    language = data.get("language")
    register = data.get("register", "classique")

    if not text:
        return jsonify({"error": "Le champ 'text' est requis."}), 400
    if language not in translator.available_languages():
        return jsonify({"error": f"Langue non supportée : {language}"}), 400

    _prune_old_jobs()

    job_id = uuid.uuid4().hex
    with jobs_lock:
        jobs[job_id] = {"status": "pending", "created_at": time.time()}
    threading.Thread(
        target=run_translation, args=(job_id, text, language, register), daemon=True
    ).start()

    return jsonify({"job_id": job_id}), 202


@app.route("/translate/<job_id>")
def translate_status(job_id):
    job = _get_job(job_id)
    if job is None:
        return jsonify({"error": "Job introuvable ou expiré."}), 404
    return jsonify(job)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, load_dotenv=False)
