# Automata-Guided Secure API Access Verification

**Application Domain**: Cloud Security, API Management, and Zero-Trust Security Frameworks  
**Team Members**:
- KESHAV JHUNJHUNWALA (24BCE2033)
- Divyank Seervi (24BCE0793)
- Aryan Raj (24BCT0329)

---

## Abstract
Maximum of the modern web applications do rely on a microservices communicating via APIs. The traditional API security mainly have focus on authentication to check if any user has a valid token but often it ignores the exact order of that user's actions. So this leaves systems in danger to business logic attacks, where a user may skip any necessary step (for eg.- like payment) and directly access the restricted endpoint. 

This case study proposes a framework for security that models allowed API call sequences as a **Deterministic Finite Automaton (DFA)**. By treating the sequence of API requests as a formal language, the system tracks the user's state in live time. Any request which is not in the order may immediately trigger an error state, blocking action. Because DFA state transitions operate in O(1) time, the approach provides policy enforcement which is strict without adding any runtime latency to the system.

We can monitor API calls in real time, keeping a state for each user based on their user history and checking a new call against an already existing state machine of allowed sequences.

---

## Background and Context
The Gateways of API serve a crucial role in defending a modern cloud security and zero trust architecture. Static JSON Web Tokens can be validated with success using SaaS monitoring platforms and enterprise API security tools. However, verifying stateful behavior is still a difficult issue. 

Formal languages and model checking are established techniques in theoretical computer science for confirming the correctness of network protocols and hardware. Researchers can mathematically explain if a system enters an unsafe state by modeling software rules as finite state machines. In order to track live user workflows, this project helps resolve the gap between formal automata and modern web security, bringing theoretical foundations to API management directly.

Mostly, API security tools work in a vacuum—they check if a token lets you hit a particular action and that’s it. It is okay for simple checks, but when someone tries to go in a sequence of actions like `/login -> /profile -> /admin -> /user`, it may be an attacker who stole a token exploring what they can access.

Schneider's old paper from 2000 about enforceable security policies gave us some information: "If you can monitor what a programmer does, you can enforce safety measures". Later, Ligatti and his group gave the idea of “edit automata” that can change behavior on the fly to keep it protected. 

Over on the industry side, organizations like Corsha are taking machine-to-machine API traffic as an authentication layer. But we are not seeing anyone use state machines to track sequences among different calls, and that’s where we can contribute with a prototype.

---

## Existing Challenges
The main issue with already existing API authorization is the nature which doesn’t have any correct state tracking; each request sent is handled by API servers as an isolated event. The server isn’t able to stop an attacker who uses valid session tokens to hit endpoints out of order. 

Developers usually create database-intensive runtime checks to check this issue by confirming a user's earlier actions before allowing a particular action. There is a performance slowdown produced in very large-scale microservices when each API call involves querying a database or a rule engine. A lightweight, in-memory method that can easily and quickly check access sequences without depending on inactive database lookups is needed.

Also, there is no memory storage based on previous usage trends. If an attacker tries different endpoints slowly, each call will be allowed as an individual call but in reality, they aren’t normal traffic; they are part of an exploratory sequence. The fix for sequence blindness is typically to log everything and run batch analysis later. But that’s reactive—we find out about an attack after some time, not immediately. We need a real-time verification system with low latency.

---

## Problem Definition
In formal language theory, security issues in API sequences can be explained as a typical string acceptance problem. Let's say a string `w` over an alphabet `Σ` taken as input represents the order of API requests made by a user during the session. The goal is to make a model checking mechanism that accepts `w` if the sequence matches a pre-established security policy `L`, where `L` is a regular language representing operational workflows that are allowed to work.

### Mathematical Representation and Theoretical Underpinnings
The system is designed as a DFA to implement this policy. The DFA keeps track of the user’s authorization status and validates if there are any changes. This system is defined mathematically as a 5-tuple:  
`M = (Q, Σ, δ, q0, F)`

The components are defined as follows:
- **Q (Set of States)**: A finite, non-empty set of states used to represent a user’s current session status. In the given model, these states equate directly to the context made by specific API endpoints.
- **Σ (Alphabet)**: A finite, non-empty set of input symbols. Here, each symbol represents a particular callable API (e.g., `/login`, `/fetch_data`).
- **δ (Transition Function)**: The main enforcement mechanism, defined as `δ: Q × Σ → Q`. It dictates movement allowed from one state to another as per the received API call.
- **q0 (Start State)**: The initial, unauthorized state of a user session (`q0 ∈ Q`).
- **F (Accept States)**: A set of final states (`F ⊆ Q`) representing a safely closed or idle session (e.g., successful logout).

If the user makes API call `σ` at state `qx` and transition `δ(qx, σ)` isn’t explicitly defined in the policies, the function defaults to trap state `q_{error}`. When we reach `q_{error}`, it immediately terminates the connection.

---

## System Model
To show the construction of the DFA, we apply it to a standard user modification sequence. The states are assigned to the access levels granted by endpoints and transitions are allowed sequences of those given calls.

We define the components for this specific model as follows:
- **Alphabet (Σ)**: `{/login, /view_dashboard, /edit_profile, /logout}`
- **States (Q)**:
  - `q_0`: Unauthenticated Session (Start State)
  - `q_1`: Authenticated Session
  - `q_2`: Data Context Loaded
  - `q_3`: Session Safely Closed (Final State)
  - `q_{error}`: Security Violation (Trap State)

### Transition Rules (δ)
The system enforces the following valid transitions:
1. `δ(q_0, /login) = q_1` (User provides credentials to enter the system)
2. `δ(q_1, /view_dashboard) = q_2` (User fetches their specific data context)
3. `δ(q_2, /edit_profile) = q_2` (User edits data and remains in the loaded context)
4. `δ(q_1, /logout) = q_3` (User exits directly from the authenticated state)
5. `δ(q_2, /logout) = q_3` (User exits after viewing or editing data)

Any deviation from this path will lead to a trap state. For example, if an attacker attempts to skip the data fetching step and try to modify the profile directly after logging in, the system evaluates `δ(q_1, /edit_profile)`. Since this is not a correct sequence, the machine results to `q_{error}` and the backend denies the request.

---

## Dataset (Theoretical Evaluation)
*Note: Due to lack of real enterprise logs, synthetic data was created to mirror expected user trends for API calls.*

- **Scope**: 30 days, 1000 principals (850 users, 150 services)
- **Scale**: ~2.5 million API calls, 47 endpoints, 500 attack sequences injected.
- **Personas**:
  - General users: Follow standard workflows (login, browse, logout).
  - Efficient users: More varied, sometimes skipping optional steps within allowed sequences.
  - Internal services: Predictable machine-to-machine patterns.
  - Attackers: 50 campaigns of session hijacking, workflow bypasses, slow probing, and cross-service chains.

---

## Experimental Setup
Built in **Python 3.10** under a Flask + Django mock architecture.
- **Automata Handling**: OpenFST 1.8.2.
- **Data analysis**: Pandas, NumPy.
- **Storage**: Principal states stored in O(1) access Hash Maps (LRU Cache).
- **Control Baseline**: PostgreSQL table with role-based permissions (`SELECT 1 FROM permissions...`).

## Evaluation
### Detection Effectiveness
Comparing traditional Role-Based Access Control (Baseline) against FA-Based Detection:
- **Workflow bypass**: 38% vs **95%** (+57%)
- **Cross-service attack chain**: 18% vs **94%** (+76%)
- **Privilege escalation sequence**: 24% vs **94%** (+70%)

*(Note: Parameter tampering showed no improvement, as DFA tracks sequences, not payload data).*

### Runtime Performance
At high loads (5000 req/sec), the baseline database query added **28.6ms** latency. The Automaton handled it strictly in memory, adding only **14.2ms**, showing a massive O(1) performance advantage over traditional database lookups.

---

## Conclusion and Future Enhancements
This project demonstrated that finite automata effectively secure APIs. They systematically catch attack sequences that point-in-time checks miss, executing with highly suppressed latency. While memory usage scales linearly with active users, distributed memory systems like Redis can effortlessly scale this approach.

**Future Considerations**:
- Probabilistic automata to reduce strict logic false positives.
- Integration directly into Service Mesh sidecars (e.g., Istio).
- Automated model learning from historic logs.

## References
1. Quincozes et al. (2024), "Auth4App"
2. Beauquier et al. (2013), "Security policies enforcement using finite edit automata"
3. Basin et al. (2024).
4. SecureAuth (2025).
5. Ligatti et al. (2005), "Edit automata: Enforcement mechanisms for run-time security policies"
[...]
*(Full references provided in the original text)*
