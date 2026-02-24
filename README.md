# OnlineVoting - Python auth server (MongoDB)

This project now includes a Python Flask server with MongoDB-backed authentication APIs:

- `POST /register` → create a user in MongoDB
- `POST /login` → authenticate a user from MongoDB
- `GET /users/<username>` → retrieve a stored user profile
- `GET /health` → health check

## 1) Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r server/requirements.txt
```

## 2) Environment variables

A local `.env` file is included at repo root.

You can copy from `.env.example` and edit values if needed:

```bash
cp .env.example .env
```

Default values:

- `MONGO_URI=mongodb://localhost:27017`
- `MONGO_DB=online_voting`
- `USERS_COLLECTION=users`

## 3) Run server

```bash
python server/app.py
```

Server runs on `http://localhost:8000`.

## Example requests

### Register

```bash
curl -X POST http://localhost:8000/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Asha Kumar","username":"asha","password":"secret123"}'
```

### Login

```bash
curl -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"asha","password":"secret123"}'
```
