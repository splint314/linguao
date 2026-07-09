from flask import Flask, jsonify, request
from flask_cors import CORS

import translator

app = Flask(__name__)
CORS(app)


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

    try:
        result = translator.translate(text, language, register)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Erreur lors de l'appel à Ollama : {e}"}), 502

    return jsonify({"translation": result})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, load_dotenv=False)
