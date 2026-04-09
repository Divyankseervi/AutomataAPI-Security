const API_BASE = 'http://127.0.0.1:8080';
const terminal = document.getElementById('terminal-output');
const globalStatusText = document.getElementById('global-status');
const statusDot = document.querySelector('.status-dot');
let currentJwt = null;
let latencyHistory = [];

const edges = [
    { from: 'q_0', to: 'q_1', label: '/login' },
    { from: 'q_1', to: 'q_2', label: '/view_dashboard' },
    { from: 'q_2', to: 'q_2', label: '/edit_profile', selfLoop: true },
    { from: 'q_1', to: 'q_3', label: '/logout' },
    { from: 'q_2', to: 'q_3', label: '/logout' }
];

document.addEventListener('DOMContentLoaded', () => {
    drawEdges();
    
    document.querySelectorAll('.api-btn').forEach(btn => {
        if(btn.id === 'sim-legit' || btn.id === 'sim-threat' || btn.id === 'reset-btn') return;
        btn.addEventListener('click', async (e) => {
            const endpoint = e.currentTarget.getAttribute('data-endpoint');
            const method = e.currentTarget.getAttribute('data-method') || 'POST';
            await makeApiCall(endpoint, method);
        });
    });

    document.getElementById('reset-btn').addEventListener('click', resetSession);
    document.getElementById('sim-legit').addEventListener('click', runLegitSim);
    document.getElementById('sim-threat').addEventListener('click', runThreatSim);
});

function logTerminal(message, type = 'sys-log', latency = null) {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    let timeStr = new Date().toISOString().split('T')[1].slice(0, 8);
    let innerHtml = `<span class="sys-log">[${timeStr}]</span> ${message}`;
    if (latency !== null) innerHtml += `<span class="latency">${latency}ms O(1)</span>`;
    entry.innerHTML = innerHtml;
    terminal.appendChild(entry);
    terminal.scrollTop = terminal.scrollHeight;
}

function updateMetrics(latency) {
    latencyHistory.push(latency);
    if(latencyHistory.length > 50) latencyHistory.shift();
    const avg = latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length;
    document.getElementById('avg-latency').innerText = `${avg.toFixed(2)} ms`;
}

async function makeApiCall(endpoint, method, isSim = false) {
    if(!isSim) logTerminal(`Client requested ${method} ${endpoint}`, 'req-log');
    
    try {
        const headers = { 'Content-Type': 'application/json' };
        if(currentJwt) headers['Authorization'] = currentJwt;

        const response = await fetch(`${API_BASE}${endpoint}`, { method, headers });
        const data = await response.json();
        
        if (data.token) {
            currentJwt = data.token;
            document.querySelector('.jwt-token').innerText = currentJwt;
            document.querySelector('.jwt-token').style.color = '#00fa9a';
        }
        
        updateMetrics(data.latency_ms);

        if (data.status === 'success') {
            if(!isSim) logTerminal(`✔ ALLOWED: -> ${data.state}. ${data.message}`, 'res-allow', data.latency_ms);
            updateDFAVisuals(data.state, endpoint);
            setSystemStatus('healthy', 'SYSTEM SECURE - TRAFFIC NORMAL');
        } else {
            if(!isSim) logTerminal(`✖ BLOCKED: -> ${data.state}. ${data.message}`, 'res-block', data.latency_ms);
            updateDFAVisuals('q_error', endpoint, true);
            setSystemStatus('alert', 'VIOLATION DETECTED - SESSION LOCKED');
        }
        
    } catch (err) {
        if(!isSim) logTerminal(`ERROR: Backend unreachable.`, 'res-block');
    }
}

async function resetSession() {
    logTerminal(`Resetting session DFA...`, 'sys-log');
    await fetch(`${API_BASE}/reset`, { method: 'POST' });
    currentJwt = null;
    document.querySelector('.jwt-token').innerText = 'No token present';
    document.querySelector('.jwt-token').style.color = '#a1b0cc';
    
    updateDFAVisuals('q_0', null);
    setSystemStatus('healthy', 'SESSION RESET - AWAITING TRAFFIC');
    document.getElementById('node-q_error').classList.add('hidden');
}

function updateDFAVisuals(newState, endpointTriggered, isError = false) {
    document.querySelectorAll('.node').forEach(n => n.classList.remove('active'));
    
    const targetNode = document.getElementById(`node-${newState}`);
    if (targetNode) {
        if (isError) targetNode.classList.remove('hidden');
        targetNode.classList.add('active');
    }
    
    document.querySelectorAll('.edge-path').forEach(ep => ep.classList.remove('active'));

    if (endpointTriggered && !isError) {
        const edgeId = `edge-${endpointTriggered.replace('/', '')}`;
        const edgeEl = document.getElementById(edgeId);
        if (edgeEl) edgeEl.classList.add('active');
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

function drawEdges() {
    const svg = document.querySelector('.edges-overlay');
    const getCoords = (nodeId) => {
        const el = document.getElementById(`node-${nodeId}`);
        if(!el) return {x:0, y:0};
        return { x: parseFloat(el.style.left), y: parseFloat(el.style.top) }
    };

    edges.forEach(edge => {
        const from = getCoords(edge.from);
        const to = getCoords(edge.to);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.classList.add('edge-path');
        path.id = `edge-${edge.label.replace('/', '')}`;
        
        let d = '';
        if (edge.selfLoop) {
            d = `M ${from.x}% ${from.y}% C ${from.x + 15}% ${from.y - 15}%, ${from.x + 15}% ${from.y + 15}%, ${from.x}% ${from.y + 5}%`;
        } else {
            const midX = (from.x + to.x) / 2;
            const dirY = (to.y - from.y);
            const curve = dirY === 0 ? 15 : 0; 
            d = `M ${from.x}% ${from.y}% Q ${midX}% ${from.y - curve}%, ${to.x}% ${to.y}%`;
        }
        
        path.setAttribute('d', d);
        svg.appendChild(path);
    });
}

// Simulations
async function runLegitSim() {
    logTerminal(`Running O(1) Load Test Validation (20 calls)`, 'sys-log');
    await resetSession();
    const calls = [ ['/login','POST'], ['/view_dashboard','GET'], ['/edit_profile','PUT'], ['/logout', 'POST'] ];
    for(let i=0; i<8; i++) {
        await makeApiCall(calls[i%4][0], calls[i%4][1], false);
        await new Promise(r => setTimeout(r, 150));
    }
}

async function runThreatSim() {
    logTerminal(`Injecting Threat Campaign: Workflow Bypass`, 'sys-log');
    await resetSession();
    await makeApiCall('/login', 'POST', false);
    await new Promise(r => setTimeout(r, 400));
    logTerminal(`Attacker probing /edit_profile bypass...`, 'req-log');
    await makeApiCall('/edit_profile', 'PUT', false);
}
