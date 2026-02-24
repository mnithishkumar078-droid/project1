import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from werkzeug.security import check_password_hash, generate_password_hash


load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "online_voting")
USERS_COLLECTION = os.getenv("USERS_COLLECTION", "users")


app = Flask(__name__)
client = MongoClient(MONGO_URI)
db = client[MONGO_DB]
users = db[USERS_COLLECTION]
users.create_index("username", unique=True)


@app.get("/health")
def health() -> tuple:
    return jsonify({"status": "ok", "database": MONGO_DB}), 200


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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
