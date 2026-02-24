import os
from pathlib import Path
from datetime import datetime, timezone

from bson import ObjectId
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from werkzeug.security import check_password_hash, generate_password_hash


load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "online_voting")
USERS_COLLECTION = os.getenv("USERS_COLLECTION", "users")
CANDIDATES_COLLECTION = os.getenv("CANDIDATES_COLLECTION", "candidates")


app = Flask(__name__)
FRONTEND_DIR = Path(__file__).resolve().parent.parent
client = MongoClient(MONGO_URI)
db = client[MONGO_DB]
users = db[USERS_COLLECTION]
candidates = db[CANDIDATES_COLLECTION]
users.create_index("username", unique=True)


def normalize_candidate(candidate_doc: dict) -> dict:
    return {
        "id": str(candidate_doc["_id"]),
        "name": candidate_doc.get("name", ""),
        "party": candidate_doc.get("party", ""),
        "imageUrl": candidate_doc.get("imageUrl", ""),
        "updatedAt": candidate_doc.get("updatedAt"),
    }


@app.get("/health")
def health() -> tuple:
    return jsonify({"status": "ok", "database": MONGO_DB}), 200


@app.get("/")
def home() -> tuple:
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.get("/<path:asset_path>")
def static_assets(asset_path: str) -> tuple:
    asset = FRONTEND_DIR / asset_path
    if asset.is_file():
        return send_from_directory(FRONTEND_DIR, asset_path)
    return jsonify({"error": "not found"}), 404


@app.post("/register")
def register() -> tuple:
    payload = request.get_json(silent=True) or {}
    full_name = (payload.get("fullName") or "").strip()
    username = (payload.get("username") or "").strip().lower()
    password = payload.get("password") or ""

    if not full_name or not username or not password:
        return jsonify({"error": "fullName, username, and password are required"}), 400

    if len(password) < 6:
        return jsonify({"error": "password must be at least 6 characters"}), 400

    if users.find_one({"username": username}):
        return jsonify({"error": "username already exists"}), 409

    user_doc = {
        "fullName": full_name,
        "username": username,
        "passwordHash": generate_password_hash(password),
        "createdAt": datetime.now(timezone.utc),
    }

    try:
        users.insert_one(user_doc)
    except PyMongoError:
        return jsonify({"error": "failed to save user"}), 500

    return jsonify({"message": "registration successful", "username": username}), 201


@app.post("/login")
def login() -> tuple:
    payload = request.get_json(silent=True) or {}
    username = (payload.get("username") or "").strip().lower()
    password = payload.get("password") or ""

    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400

    user = users.find_one({"username": username})
    if not user or not check_password_hash(user["passwordHash"], password):
        return jsonify({"error": "invalid credentials"}), 401

    return (
        jsonify(
            {
                "message": "login successful",
                "user": {
                    "id": str(user["_id"]),
                    "fullName": user["fullName"],
                    "username": user["username"],
                },
            }
        ),
        200,
    )


@app.get("/users/<username>")
def get_user(username: str) -> tuple:
    user = users.find_one({"username": username.strip().lower()}, {"passwordHash": 0})
    if not user:
        return jsonify({"error": "user not found"}), 404

    user["id"] = str(user.pop("_id"))
    return jsonify(user), 200


@app.get("/candidates")
def list_candidates() -> tuple:
    candidate_rows = candidates.find().sort("updatedAt", -1)
    return jsonify([normalize_candidate(doc) for doc in candidate_rows]), 200


@app.post("/candidates")
def create_candidate() -> tuple:
    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()
    party = (payload.get("party") or "").strip()
    image_url = (payload.get("imageUrl") or "").strip()

    if not name or not party or not image_url:
        return jsonify({"error": "name, party, and imageUrl are required"}), 400

    candidate_doc = {
        "name": name,
        "party": party,
        "imageUrl": image_url,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    try:
        result = candidates.insert_one(candidate_doc)
    except PyMongoError:
        return jsonify({"error": "failed to add candidate"}), 500

    candidate_doc["_id"] = result.inserted_id
    return jsonify(normalize_candidate(candidate_doc)), 201


@app.put("/candidates/<candidate_id>")
def update_candidate(candidate_id: str) -> tuple:
    payload = request.get_json(silent=True) or {}
    update_fields = {}

    for field in ("name", "party", "imageUrl"):
        if field in payload:
            value = (payload.get(field) or "").strip()
            if not value:
                return jsonify({"error": f"{field} cannot be empty"}), 400
            update_fields[field] = value

    if not update_fields:
        return jsonify({"error": "at least one field is required"}), 400

    update_fields["updatedAt"] = datetime.now(timezone.utc).isoformat()

    try:
        object_id = ObjectId(candidate_id)
    except Exception:
        return jsonify({"error": "invalid candidate id"}), 400

    result = candidates.update_one({"_id": object_id}, {"$set": update_fields})
    if result.matched_count == 0:
        return jsonify({"error": "candidate not found"}), 404

    updated = candidates.find_one({"_id": object_id})
    return jsonify(normalize_candidate(updated)), 200


@app.delete("/candidates/<candidate_id>")
def delete_candidate(candidate_id: str) -> tuple:
    try:
        object_id = ObjectId(candidate_id)
    except Exception:
        return jsonify({"error": "invalid candidate id"}), 400

    result = candidates.delete_one({"_id": object_id})
    if result.deleted_count == 0:
        return jsonify({"error": "candidate not found"}), 404

    return jsonify({"message": "candidate deleted"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
