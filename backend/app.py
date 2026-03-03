import os
from datetime import datetime, timezone
from pathlib import Path

from bson import ObjectId
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from werkzeug.security import check_password_hash, generate_password_hash


class InsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class UpdateResult:
    def __init__(self, matched_count):
        self.matched_count = matched_count


class DeleteResult:
    def __init__(self, deleted_count):
        self.deleted_count = deleted_count


class InMemoryCollection:
    def __init__(self):
        self.docs = []

    def create_index(self, *args, **kwargs):
        return None

    def _matches(self, doc, query):
        for key, value in query.items():
            if doc.get(key) != value:
                return False
        return True

    def find_one(self, query, projection=None):
        for doc in self.docs:
            if self._matches(doc, query):
                result = dict(doc)
                if projection and projection.get('passwordHash') == 0:
                    result.pop('passwordHash', None)
                return result
        return None

    def insert_one(self, doc):
        saved = dict(doc)
        saved['_id'] = saved.get('_id', ObjectId())
        self.docs.append(saved)
        return InsertResult(saved['_id'])

    def find(self, query=None):
        query = query or {}
        return [dict(doc) for doc in self.docs if self._matches(doc, query)]

    def update_one(self, query, update):
        for idx, doc in enumerate(self.docs):
            if self._matches(doc, query):
                self.docs[idx] = {**doc, **update.get('$set', {})}
                return UpdateResult(1)
        return UpdateResult(0)

    def delete_one(self, query):
        for idx, doc in enumerate(self.docs):
            if self._matches(doc, query):
                self.docs.pop(idx)
                return DeleteResult(1)
        return DeleteResult(0)

    def delete_many(self, query):
        query = query or {}
        original_count = len(self.docs)
        self.docs = [doc for doc in self.docs if not self._matches(doc, query)]
        return DeleteResult(original_count - len(self.docs))


load_dotenv()

MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017')
MONGO_DB = os.getenv('MONGO_DB', 'online_voting')
USERS_COLLECTION = os.getenv('USERS_COLLECTION', 'users')
CANDIDATES_COLLECTION = os.getenv('CANDIDATES_COLLECTION', 'candidates')
VOTES_COLLECTION = os.getenv('VOTES_COLLECTION', 'votes')
SETTINGS_COLLECTION = os.getenv('SETTINGS_COLLECTION', 'settings')


app = Flask(__name__)
FRONTEND_DIR = Path(__file__).resolve().parent.parent / 'frontend'

mongo_enabled = True
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=1200)
    client.admin.command('ping')
    db = client[MONGO_DB]
    users = db[USERS_COLLECTION]
    candidates = db[CANDIDATES_COLLECTION]
    votes = db[VOTES_COLLECTION]
    settings = db[SETTINGS_COLLECTION]
except Exception:
    mongo_enabled = False
    users = InMemoryCollection()
    candidates = InMemoryCollection()
    votes = InMemoryCollection()
    settings = InMemoryCollection()

users.create_index('username', unique=True)
votes.create_index('voterUsername', unique=True)
settings.create_index('key', unique=True)


def ensure_default_admin() -> None:
    admin_username = 'admin'
    admin_password = 'admin@123'

    existing_admin = users.find_one({'username': admin_username})
    if existing_admin:
        return

    users.insert_one(
        {
            'fullName': 'System Admin',
            'username': admin_username,
            'passwordHash': generate_password_hash(admin_password),
            'role': 'admin',
            'createdAt': datetime.now(timezone.utc),
        }
    )


ensure_default_admin()


def ensure_default_settings() -> None:
    existing = settings.find_one({'key': 'election_status'})
    if existing:
        return

    settings.insert_one(
        {
            'key': 'election_status',
            'isOpen': True,
            'updatedAt': datetime.now(timezone.utc).isoformat(),
        }
    )


ensure_default_settings()


def get_election_status() -> bool:
    status_doc = settings.find_one({'key': 'election_status'})
    if not status_doc:
        return True
    return bool(status_doc.get('isOpen', True))


def normalize_candidate(candidate_doc: dict) -> dict:
    return {
        'id': str(candidate_doc['_id']),
        'name': candidate_doc.get('name', ''),
        'party': candidate_doc.get('party', ''),
        'imageData': candidate_doc.get('imageData') or candidate_doc.get('imageUrl', ''),
        'updatedAt': candidate_doc.get('updatedAt'),
    }


@app.get('/health')
def health() -> tuple:
    return jsonify({'status': 'ok', 'database': MONGO_DB, 'storage': 'mongodb' if mongo_enabled else 'in-memory'}), 200


@app.get('/')
def home() -> tuple:
    return send_from_directory(FRONTEND_DIR, 'index.html')


@app.get('/<path:asset_path>')
def static_assets(asset_path: str) -> tuple:
    asset = FRONTEND_DIR / asset_path
    if asset.is_file():
        return send_from_directory(FRONTEND_DIR, asset_path)
    return jsonify({'error': 'not found'}), 404


@app.post('/register')
def register() -> tuple:
    if not mongo_enabled:
        return jsonify({'error': 'MongoDB is unavailable. Registration requires database storage.'}), 503

    payload = request.get_json(silent=True) or {}
    full_name = (payload.get('fullName') or '').strip()
    username = (payload.get('username') or '').strip().lower()
    password = payload.get('password') or ''

    if not full_name or not username or not password:
        return jsonify({'error': 'fullName, username, and password are required'}), 400

    if len(password) < 6:
        return jsonify({'error': 'password must be at least 6 characters'}), 400

    if users.find_one({'username': username}):
        return jsonify({'error': 'username already exists'}), 409

    user_doc = {
        'fullName': full_name,
        'username': username,
        'passwordHash': generate_password_hash(password),
        'role': 'voter',
        'createdAt': datetime.now(timezone.utc),
    }

    try:
        users.insert_one(user_doc)
    except PyMongoError:
        return jsonify({'error': 'failed to save user'}), 500

    return jsonify({'message': 'registration successful', 'username': username}), 201


def _authenticate_user() -> tuple:
    payload = request.get_json(silent=True) or {}
    username = (payload.get('username') or '').strip().lower()
    password = payload.get('password') or ''

    if not username or not password:
        return jsonify({'error': 'username and password are required'}), 400

    user = users.find_one({'username': username})
    if not user or not check_password_hash(user['passwordHash'], password):
        return jsonify({'error': 'invalid credentials'}), 401

    return (
        jsonify(
            {
                'message': 'login successful',
                'user': {
                    'id': str(user['_id']),
                    'fullName': user['fullName'],
                    'username': user['username'],
                    'role': user.get('role', 'voter'),
                },
            }
        ),
        200,
    )


@app.post('/login')
def login() -> tuple:
    return _authenticate_user()


@app.post('/admin/login')
def admin_login() -> tuple:
    response, status_code = _authenticate_user()
    if status_code != 200:
        return response, status_code

    user = response.get_json().get('user', {})
    if user.get('role') != 'admin':
        return jsonify({'error': 'admin access required'}), 403

    return response, 200


@app.get('/users/<username>')
def get_user(username: str) -> tuple:
    user = users.find_one({'username': username.strip().lower()}, {'passwordHash': 0})
    if not user:
        return jsonify({'error': 'user not found'}), 404

    user['id'] = str(user.pop('_id'))
    return jsonify(user), 200


@app.get('/candidates')
def list_candidates() -> tuple:
    candidate_rows = candidates.find()
    sorted_rows = sorted(candidate_rows, key=lambda row: row.get('updatedAt', ''), reverse=True)
    return jsonify([normalize_candidate(doc) for doc in sorted_rows]), 200


@app.post('/candidates')
def create_candidate() -> tuple:
    payload = request.get_json(silent=True) or {}
    name = (payload.get('name') or '').strip()
    party = (payload.get('party') or '').strip()
    image_data = (payload.get('imageData') or '').strip()

    if not name or not party or not image_data:
        return jsonify({'error': 'name, party, and imageData are required'}), 400

    candidate_doc = {
        'name': name,
        'party': party,
        'imageData': image_data,
        'updatedAt': datetime.now(timezone.utc).isoformat(),
    }

    try:
        result = candidates.insert_one(candidate_doc)
    except PyMongoError:
        return jsonify({'error': 'failed to add candidate'}), 500

    candidate_doc['_id'] = result.inserted_id
    return jsonify(normalize_candidate(candidate_doc)), 201


@app.put('/candidates/<candidate_id>')
def update_candidate(candidate_id: str) -> tuple:
    payload = request.get_json(silent=True) or {}
    update_fields = {}

    for field in ('name', 'party', 'imageData'):
        if field in payload:
            value = (payload.get(field) or '').strip()
            if not value:
                return jsonify({'error': f'{field} cannot be empty'}), 400
            update_fields[field] = value

    if not update_fields:
        return jsonify({'error': 'at least one field is required'}), 400

    update_fields['updatedAt'] = datetime.now(timezone.utc).isoformat()

    try:
        object_id = ObjectId(candidate_id)
    except Exception:
        return jsonify({'error': 'invalid candidate id'}), 400

    result = candidates.update_one({'_id': object_id}, {'$set': update_fields})
    if result.matched_count == 0:
        return jsonify({'error': 'candidate not found'}), 404

    updated = candidates.find_one({'_id': object_id})
    return jsonify(normalize_candidate(updated)), 200


@app.post('/votes')
def cast_vote() -> tuple:
    if not mongo_enabled:
        return jsonify({'error': 'MongoDB is unavailable. Voting requires database storage.'}), 503

    if not get_election_status():
        return jsonify({'error': 'Election is currently closed by admin.'}), 403

    payload = request.get_json(silent=True) or {}
    voter_username = (payload.get('voterUsername') or '').strip().lower()
    candidate_id = (payload.get('candidateId') or '').strip()

    if not voter_username or not candidate_id:
        return jsonify({'error': 'voterUsername and candidateId are required'}), 400

    voter = users.find_one({'username': voter_username})
    if not voter or voter.get('role') != 'voter':
        return jsonify({'error': 'voter not found'}), 404

    try:
        candidate_object_id = ObjectId(candidate_id)
    except Exception:
        return jsonify({'error': 'invalid candidate id'}), 400

    candidate = candidates.find_one({'_id': candidate_object_id})
    if not candidate:
        return jsonify({'error': 'candidate not found'}), 404

    previous_vote = votes.find_one({'voterUsername': voter_username})
    vote_doc = {
        'voterUsername': voter_username,
        'candidateId': candidate_object_id,
        'candidateName': candidate.get('name', ''),
        'party': candidate.get('party', ''),
        'votedAt': datetime.now(timezone.utc).isoformat(),
    }

    try:
        if previous_vote:
            votes.update_one({'_id': previous_vote['_id']}, {'$set': vote_doc})
            return jsonify({'message': 'vote updated successfully'}), 200
        votes.insert_one(vote_doc)
    except PyMongoError:
        return jsonify({'error': 'failed to save vote'}), 500

    return jsonify({'message': 'vote cast successfully'}), 201


@app.get('/admin/election/status')
def election_status() -> tuple:
    return jsonify({'isOpen': get_election_status()}), 200


@app.post('/admin/election/status')
def update_election_status() -> tuple:
    payload = request.get_json(silent=True) or {}
    if 'isOpen' not in payload:
        return jsonify({'error': 'isOpen is required'}), 400

    is_open = bool(payload.get('isOpen'))
    settings.update_one(
        {'key': 'election_status'},
        {'$set': {'isOpen': is_open, 'updatedAt': datetime.now(timezone.utc).isoformat()}},
    )
    return jsonify({'message': f"Election {'opened' if is_open else 'closed'} successfully", 'isOpen': is_open}), 200


@app.get('/admin/analytics')
def admin_analytics() -> tuple:
    all_candidates = candidates.find()
    all_votes = votes.find()
    all_users = users.find()

    voter_count = sum(1 for user in all_users if user.get('role') == 'voter')
    total_votes = len(all_votes)

    vote_count_by_candidate = {}
    for vote in all_votes:
        candidate_key = str(vote.get('candidateId', ''))
        vote_count_by_candidate[candidate_key] = vote_count_by_candidate.get(candidate_key, 0) + 1

    candidate_breakdown = []
    for candidate in all_candidates:
        candidate_id = str(candidate.get('_id', ''))
        total = vote_count_by_candidate.get(candidate_id, 0)
        candidate_breakdown.append(
            {
                'id': candidate_id,
                'name': candidate.get('name', ''),
                'party': candidate.get('party', ''),
                'totalVotes': total,
            }
        )

    sorted_breakdown = sorted(candidate_breakdown, key=lambda row: row['totalVotes'], reverse=True)
    leading_candidate = sorted_breakdown[0] if sorted_breakdown and sorted_breakdown[0]['totalVotes'] > 0 else None
    turnout = round((total_votes / voter_count) * 100, 2) if voter_count else 0

    return (
        jsonify(
            {
                'totalVoters': voter_count,
                'totalVotes': total_votes,
                'turnoutPercent': turnout,
                'isElectionOpen': get_election_status(),
                'leadingCandidate': leading_candidate,
                'candidateBreakdown': sorted_breakdown,
            }
        ),
        200,
    )


@app.post('/admin/reset-votes')
def reset_votes() -> tuple:
    result = votes.delete_many({})
    return jsonify({'message': 'All votes reset successfully', 'deletedCount': result.deleted_count}), 200


@app.get('/votes/<username>')
def get_vote(username: str) -> tuple:
    normalized_username = username.strip().lower()
    vote = votes.find_one({'voterUsername': normalized_username})
    if not vote:
        return jsonify({'hasVoted': False}), 200

    return (
        jsonify(
            {
                'hasVoted': True,
                'candidateId': str(vote.get('candidateId', '')),
                'candidateName': vote.get('candidateName', ''),
                'party': vote.get('party', ''),
                'votedAt': vote.get('votedAt', ''),
            }
        ),
        200,
    )


@app.delete('/candidates/<candidate_id>')
def delete_candidate(candidate_id: str) -> tuple:
    try:
        object_id = ObjectId(candidate_id)
    except Exception:
        return jsonify({'error': 'invalid candidate id'}), 400

    result = candidates.delete_one({'_id': object_id})
    if result.deleted_count == 0:
        return jsonify({'error': 'candidate not found'}), 404

    return jsonify({'message': 'candidate deleted'}), 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
