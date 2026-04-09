class SessionDFA:
    def __init__(self):
        # Initial State
        self.state = 'q_0'
        
        # Valid States
        self.states = {'q_0', 'q_1', 'q_2', 'q_3', 'q_error'}
        
        # Transitions defined as (current_state, API_call) -> next_state
        self.transitions = {
            ('q_0', '/login'): 'q_1',
            ('q_1', '/view_dashboard'): 'q_2',
            ('q_2', '/edit_profile'): 'q_2',
            ('q_1', '/logout'): 'q_3',
            ('q_2', '/logout'): 'q_3'
        }

    def process_call(self, api_call):
        """
        Processes an API call and updates the DFA state.
        Runs in O(1) time complexity.
        Returns a tuple: (is_allowed: bool, current_state: str, message: str)
        """
        # If we are already in an error state or a closed state, block further actions
        if self.state == 'q_error':
            return False, self.state, "Session is locked due to strict security violation."
        if self.state == 'q_3':
            return False, self.state, "Session is already safely closed (logged out)."

        # Look up transition
        next_state = self.transitions.get((self.state, api_call))

        if next_state:
            # Valid transition
            self.state = next_state
            return True, self.state, "Request allowed."
        else:
            # Invalid transition -> Trap state
            self.state = 'q_error'
            return False, self.state, "Security violation: Invalid API sequence detected."

    def reset(self):
        """Reset session to start state for demo purposes."""
        self.state = 'q_0'

# Store session DFA objects (in real life, tied to token/session_id)
# For this demo, we'll just track user_ids (or a single global user for simplicity)
session_store = {}

def get_session(session_id="demo_user"):
    if session_id not in session_store:
        session_store[session_id] = SessionDFA()
    return session_store[session_id]

def reset_session(session_id="demo_user"):
    if session_id in session_store:
        session_store[session_id].reset()
    else:
        session_store[session_id] = SessionDFA()
    return session_store[session_id].state
