# OnlineVoting - Python API server

This repository includes a lightweight FastAPI server that connects to MongoDB using Motor and exposes simple CRUD endpoints for users, elections, candidates and votes. It also serves the existing static HTML files from the project root.

Quick start

1. Create a virtual environment and install dependencies:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r server/requirements.txt
```

2. Configure environment variables (see `server/.env.example`):

Create a `.env` file in `server/` or set `MONGO_URI` and `MONGO_DB` in your environment.

3. Run the server:

```bash
cd "New folder (2)"
uvicorn server.main:app --reload --host 0.0.0.0 --port 8000
```

The static site will be served at `http://localhost:8000/` and API endpoints are available under `/api/*`.

Notes

- This is a starter scaffold. For production use, add authentication, validation, and proper ObjectId handling.
