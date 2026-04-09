class SessionDFA:
    def __init__(self):
        # Initial State
        self.state = 'q_0'
        
        # Exact Case Study States
        self.states = {'q_0', 'q_1', 'q_2', 'q_3', 'q_error'}
        
        # Exact Transitions from the original Case Study Text
        self.transitions = {
            ('q_0', '/login'): 'q_1',
            ('q_1', '/view_dashboard'): 'q_2',
            ('q_2', '/edit_profile'): 'q_2',
            ('q_1', '/logout'): 'q_3',
            ('q_2', '/logout'): 'q_3'
        }

    def process_call(self, api_call):
        """
        Processes an API call and updates the DFA state in O(1).
        """
        if self.state == 'q_error':
            return False, self.state, "Session locked due to prior sequence violation."
        if self.state == 'q_3':
            return False, self.state, "Session gracefully closed."

        next_state = self.transitions.get((self.state, api_call))

        if next_state:
            self.state = next_state
            return True, self.state, "Valid sequence."
        else:
            self.state = 'q_error'
            return False, self.state, "Invalid workflow bypass detected."

    def reset(self):
        self.state = 'q_0'

session_store = {}

def get_session(session_id="strict_demo"):
    if session_id not in session_store:
        session_store[session_id] = SessionDFA()
    return session_store[session_id]

def reset_session(session_id="strict_demo"):
    if session_id in session_store:
        session_store[session_id].reset()
    else:
        session_store[session_id] = SessionDFA()
    return session_store[session_id].state
