const API_BASE = 'http://127.0.0.1:8080';
const terminal = document.getElementById('terminal-output');
const globalStatusText = document.getElementById('global-status');
const statusDot = document.querySelector('.status-dot');

// DFA Definition for drawing edges mapped to node IDs
const edges = [
    { from: 'q_0', to: 'q_1', label: '/login' },
    { from: 'q_1', to: 'q_2', label: '/view_dashboard' },
    { from: 'q_2', to: 'q_2', label: '/edit_profile', selfLoop: true },
    { from: 'q_1', to: 'q_3', label: '/logout' },
    { from: 'q_2', to: 'q_3', label: '/logout' }
];

// Initialize UI
document.addEventListener('DOMContentLoaded', () => {
    drawEdges();
    
    // Attach event listeners to API buttons
    document.querySelectorAll('.api-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const btnEl = e.currentTarget;
            if (btnEl.id === 'reset-btn') {
                resetSession();
                return;
            }
            
            const endpoint = btnEl.getAttribute('data-endpoint');
            const method = btnEl.querySelector('.method')?.innerText || 'POST';
            
            await makeApiCall(endpoint, method);
        });
    });
});

function logTerminal(message, type = 'sys-log', latency = null) {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    
    let timeStr = new Date().toISOString().split('T')[1].slice(0, 8);
    let innerHtml = `<span class="sys-log">[${timeStr}]</span> ${message}`;
    
    if (latency !== null) {
        innerHtml += `<span class="latency">${latency}ms O(1)</span>`;
    }
    
    entry.innerHTML = innerHtml;
    terminal.appendChild(entry);
    terminal.scrollTop = terminal.scrollHeight;
}

async function makeApiCall(endpoint, method) {
    logTerminal(`Client requested ${method} ${endpoint}`, 'req-log');
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: method,
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            logTerminal(`✔ ALLOWED: Transitioned to ${data.state}. ${data.message}`, 'res-allow', data.latency_ms);
            updateDFAVisuals(data.state, endpoint);
            setSystemStatus('healthy', 'SYSTEM SECURE - TRAFFIC NORMAL');
        } else {
            logTerminal(`✖ BLOCKED: Sent to ${data.state}. ${data.message}`, 'res-block', data.latency_ms);
            updateDFAVisuals('q_error', endpoint, true);
            setSystemStatus('alert', 'VIOLATION DETECTED - SESSION LOCKED');
        }
        
    } catch (err) {
        logTerminal(`ERROR: Could not connect to enforcement engine. Is backend running?`, 'res-block');
        console.error(err);
    }
}

async function resetSession() {
    logTerminal(`Resetting session via /reset endpoint...`, 'sys-log');
    try {
        const response = await fetch(`${API_BASE}/reset`, { method: 'POST' });
        const data = await response.json();
        
        updateDFAVisuals(data.state, null);
        setSystemStatus('healthy', 'SESSION RESET - AWAITING TRAFFIC');
        logTerminal(`Session reset to ${data.state}.`, 'res-allow');
        
        // Hide error node
        document.getElementById('node-q_error').classList.add('hidden');
        
        // Reset all edges
        document.querySelectorAll('.edge-path').forEach(ep => {
            ep.classList.remove('active', 'error');
        });

    } catch (err) {
        logTerminal(`ERROR: Failed to reset session.`, 'res-block');
    }
}

function updateDFAVisuals(newState, endpointTriggered, isError = false) {
    // 1. Update active node
    document.querySelectorAll('.node').forEach(node => {
        node.classList.remove('active');
    });
    
    const targetNode = document.getElementById(`node-${newState}`);
    if (targetNode) {
        if (isError) targetNode.classList.remove('hidden');
        targetNode.classList.add('active');
    }
    
    // 2. Animate edges
    document.querySelectorAll('.edge-path').forEach(ep => {
        ep.classList.remove('active', 'error');
    });

    if (endpointTriggered) {
        // Find the edge that was triggered (if it's a valid one)
        // Note: For errors, we don't have explicit edges, but we can animate the state node 
        // or draw a temporary error edge if we wanted. For simplicity, we just highlight the node.
        const edgeId = `edge-${endpointTriggered.replace('/', '')}`;
        const edgeEl = document.getElementById(edgeId);
        
        if (isError) {
             // Just highlight the target node extensively (handled above)
        } else if (edgeEl) {
            edgeEl.classList.add('active');
        }
    }
}

function setSystemStatus(type, message) {
    globalStatusText.innerText = message;
    if (type === 'alert') {
        statusDot.className = 'status-dot alert';
        globalStatusText.className = 'status-text alert-text';
        document.querySelector('.status-indicator').classList.add('violation');
    } else {
        statusDot.className = 'status-dot healthy';
        globalStatusText.className = 'status-text healthy-text';
        document.querySelector('.status-indicator').classList.remove('violation');
    }
}

// Draw static SVG edges between nodes
function drawEdges() {
    const svg = document.querySelector('.edges-overlay');
    const panel = document.querySelector('.vis-panel');
    
    // Quick helper to get center coordinates of a node relative to the SVG container
    const getCoords = (nodeId) => {
        const el = document.getElementById(`node-${nodeId}`);
        if(!el) return {x:0, y:0};
        // The inline styles are in percentages
        return {
            x: parseFloat(el.style.left),
            y: parseFloat(el.style.top)
        }
    };

    edges.forEach(edge => {
        const from = getCoords(edge.from);
        const to = getCoords(edge.to);
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.classList.add('edge-path');
        path.id = `edge-${edge.label.replace('/', '')}`;
        
        // Calculate raw pixel values roughly based on container to generate curvey paths
        // We use viewbox % values directly in path strings
        
        let d = '';
        if (edge.selfLoop) {
            // Draw a loop 
            d = `M ${from.x}% ${from.y}% C ${from.x + 15}% ${from.y - 15}%, ${from.x + 15}% ${from.y + 15}%, ${from.x}% ${from.y + 5}%`;
        } else {
            // Draw curved line 
            // Add some offset so arrows don't disappear under nodes
            // Using a simple bezier curve for aesthetics
            const midX = (from.x + to.x) / 2;
            const dirY = (to.y - from.y);
            const curve = dirY === 0 ? 15 : 0; // Curve horizontal lines
            
            d = `M ${from.x}% ${from.y}% Q ${midX}% ${from.y - curve}%, ${to.x}% ${to.y}%`;
        }
        
        path.setAttribute('d', d);
        
        // Insert before defs so it's under nodes
        svg.appendChild(path);
    });
}
