import time
from flask import Flask, jsonify, request
from flask_cors import CORS
from dfa import get_session, reset_session

app = Flask(__name__)
# Enable CORS for the frontend to communicate with the API
CORS(app)

# Common helper for simulating API responses
def process_request(endpoint, simulate_latency=True):
    start_time = time.time()
    
    # Simulate networking/processing time for a real-world feel
    if simulate_latency:
        time.sleep(0.01) # Baseline small delay

    # 1. Get DFA Session
    session_id = request.headers.get("X-Session-ID", "demo_user")
    dfa = get_session(session_id)
    
    # 2. Process through Automaton O(1)
    # The DFA transitions strictly dictate access. No database query needed!
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
    
    status_code = 200 if is_allowed else 403
    return jsonify(response_data), status_code

# Mock Endpoints for the Case Study
@app.route('/login', methods=['POST'])
def login():
    return process_request('/login')

@app.route('/view_dashboard', methods=['GET'])
def view_dashboard():
    return process_request('/view_dashboard')

@app.route('/edit_profile', methods=['POST', 'PUT'])
def edit_profile():
    return process_request('/edit_profile')

@app.route('/logout', methods=['POST'])
def logout():
    return process_request('/logout')

# Utility endpoints for the interactive demo
@app.route('/reset', methods=['POST'])
def reset():
    session_id = request.headers.get("X-Session-ID", "demo_user")
    new_state = reset_session(session_id)
    return jsonify({"status": "success", "state": new_state, "message": "Session reset."}), 200

@app.route('/current_state', methods=['GET'])
def current_state():
    session_id = request.headers.get("X-Session-ID", "demo_user")
    dfa = get_session(session_id)
    return jsonify({"status": "success", "state": dfa.state}), 200

if __name__ == '__main__':
    app.run(debug=True, port=8080)
