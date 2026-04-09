import os
import time
from flask import Flask, jsonify, request
from flask_cors import CORS
from dfa import get_session, reset_session

app = Flask(__name__, static_folder='../frontend', static_url_path='/')

@app.route('/')
def index():
    return app.send_static_file('index.html')

def process_request(endpoint, simulate_latency=True):
    start_time = time.time()
    
    # 1. JWT Simulation (Pre-DFA Check)
    jwt_token = request.headers.get("Authorization", "")
    if endpoint != '/login':
        if not jwt_token or not jwt_token.startswith("Bearer "):
            return jsonify({"status": "blocked", "state": "q_error", "message": "Missing JWT Token."}), 401
            
    # Simulate hardware latency slightly
    if simulate_latency:
        time.sleep(0.005)

    # 2. Extract DFA Session
    session_id = request.headers.get("X-Session-ID", "strict_demo")
    dfa = get_session(session_id)
    
    # 3. Process Call in O(1)
    is_allowed, current_state, message = dfa.process_call(endpoint)
    
    end_time = time.time()
    latency_ms = round((end_time - start_time) * 1000, 2)
    
    response_data = {
        "status": "success" if is_allowed else "blocked",
        "state": current_state,
        "message": message,
        "endpoint": endpoint,
        "latency_ms": latency_ms
    }
    
    if is_allowed and endpoint == '/login':
        response_data['token'] = f"Bearer secure_token_{int(time.time())}"
        
    status_code = 200 if is_allowed else 403
    return jsonify(response_data), status_code

# Strict API Endpoints matching Case Study
@app.route('/login', methods=['POST'])
def login(): return process_request('/login')

@app.route('/view_dashboard', methods=['GET'])
def view_dashboard(): return process_request('/view_dashboard')

@app.route('/edit_profile', methods=['PUT', 'POST'])
def edit_profile(): return process_request('/edit_profile')

@app.route('/logout', methods=['POST'])
def logout(): return process_request('/logout')

@app.route('/reset', methods=['POST'])
def reset():
    session_id = request.headers.get("X-Session-ID", "strict_demo")
    new_state = reset_session(session_id)
    return jsonify({"status": "success", "state": new_state, "message": "Session reset."}), 200

if __name__ == '__main__':
    app.run(debug=True, port=8080)
