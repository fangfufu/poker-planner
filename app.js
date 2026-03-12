// Constants
const DECK = ['0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', '6', '7', '?', '🔄'];

// App State
const state = {
    peer: null,
    connection: null, // Used by client
    isHost: false,
    roomId: null,
    clients: {}, // { clientId: { name: string, conn: DataConnection, disconnected: boolean } }
    peerToClient: {}, // { peerId: clientId } map to look up clientId by connection peerId
    votes: {}, // { clientId: voteValue }
    votingState: 'VOTING', // 'VOTING' | 'REVEALED'
    myName: '',
    myClientId: ''
};

// DOM Elements - Screens
const screens = {
    home: document.getElementById('home-screen'),
    host: document.getElementById('host-screen'),
    client: document.getElementById('client-screen')
};

// DOM Elements - UI
const elements = {
    btnCreate: document.getElementById('btn-create-room'),
    btnJoin: document.getElementById('btn-join-room'),
    inputRoomId: document.getElementById('input-room-id'),
    inputDisplayName: document.getElementById('input-display-name'),
    errorMsg: document.getElementById('connection-error'),
    overlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text'),
    
    // Host Controls
    displayRoomId: document.getElementById('display-room-id'),
    btnCopyRoom: document.getElementById('btn-copy-room'),
    btnReveal: document.getElementById('btn-reveal'),
    btnReset: document.getElementById('btn-reset'),
    btnSort: document.getElementById('btn-sort'),
    hostParticipants: document.getElementById('host-participants'),
    statsPanel: document.getElementById('stats-panel'),
    statMean: document.getElementById('stat-mean'),
    statStdDev: document.getElementById('stat-stddev'),
    
    // Client Controls
    clientRoomDisplay: document.getElementById('client-room-display'),
    deck: document.getElementById('deck'),
    clientVoteStatus: document.getElementById('client-vote-status'),
    clientSelectedCard: document.getElementById('client-selected-card'),
    btnChangeVote: document.getElementById('btn-change-vote')
};

// Helper Functions
function getClientId() {
    let clientId = localStorage.getItem('poker_planner_client_id');
    if (!clientId) {
        clientId = 'client_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('poker_planner_client_id', clientId);
    }
    return clientId;
}

function showScreen(screenName) {
    Object.values(screens).forEach(s => {
        s.classList.remove('view-active');
        s.classList.add('hidden');
    });
    screens[screenName].classList.remove('hidden');
    screens[screenName].classList.add('view-active');
}

function showLoading(text) {
    elements.loadingText.textContent = text;
    elements.overlay.classList.remove('hidden');
}

function hideLoading() {
    elements.overlay.classList.add('hidden');
}

function showError(msg) {
    elements.errorMsg.textContent = msg;
    elements.errorMsg.classList.remove('hidden');
    setTimeout(() => elements.errorMsg.classList.add('hidden'), 5000);
}

function generateRoomId() {
    // Generate a strictly numeric/uppercase alphanumeric room ID for readability
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, 1, O, 0
    let result = '';
    for (let i = 0; i < 5; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// PeerJS Initialization
// PeerJS Initialization
function getIceServers() {
    // These placeholders are replaced during GitHub Actions deployment.
    // To test with TURN locally, you can set window.TURN_CONFIG in your browser console:
    // window.TURN_CONFIG = { username: '...', credential: '...' };
    let username = "__TURN_USERNAME__";
    let credential = "__TURN_CREDENTIAL__";

    // Fallback for local development if placeholders are not replaced
    if (username.startsWith("__") && window.TURN_CONFIG) {
        username = window.TURN_CONFIG.username;
        credential = window.TURN_CONFIG.credential;
    }

    if (username.startsWith("__")) {
        console.warn("ICE Server credentials not configured. TURN/Relay mode will fail. (Placeholders detected)");
    }

    return [
        {
          urls: "stun:stun.relay.metered.ca:80",
        },
        {
          urls: "turn:standard.relay.metered.ca:80",
          username: username,
          credential: credential,
        },
        {
          urls: "turn:standard.relay.metered.ca:80?transport=tcp",
          username: username,
          credential: credential,
        },
        {
          urls: "turn:standard.relay.metered.ca:443",
          username: username,
          credential: credential,
        },
        {
          urls: "turns:standard.relay.metered.ca:443?transport=tcp",
          username: username,
          credential: credential,
        },
    ];
}

async function initPeer(id = null) {
    const iceServers = getIceServers();
    const urlParams = new URLSearchParams(window.location.search);
    const forceRelay = urlParams.get('relay') === '1';
    
    if (forceRelay) console.log("%c FORCE RELAY MODE ACTIVE ", "background: #f59e0b; color: #000; font-weight: bold;");

    return new Promise((resolve, reject) => {
        const peerConfig = {
            debug: 3, // Verbose logging
            config: {
                'iceServers': iceServers,
                'iceTransportPolicy': forceRelay ? 'relay' : 'all'
            }
        };

        const peer = id ? new Peer(id, peerConfig) : new Peer(peerConfig);

        peer.on('open', (id) => {
            console.log('My peer ID is: ' + id);
            resolve(peer);
        });

        peer.on('error', (err) => {
            console.error('Peer error:', err);
            reject(err);
        });
    });
}

// --- HOST LOGIC ---

async function hostCreateRoom() {
    const name = elements.inputDisplayName.value.trim() || 'Host';
    state.myName = name;
    localStorage.setItem('poker_planner_name', name);
    state.myClientId = getClientId();

    showLoading('Creating Room...');
    try {
        const generatedId = generateRoomId();
        state.peer = await initPeer(generatedId);
        state.isHost = true;
        state.roomId = generatedId;
        
        // Host is also a participant
        state.clients[state.myClientId] = { name: `${name} (You)`, conn: 'self', disconnected: false };
        
        setupHostListeners();
        updateHostUI();
        
        elements.displayRoomId.textContent = state.roomId;
        hideLoading();
        showScreen('host');
        
        // We open a client view for the host in a clever way: The host's client view runs alongside
        // Wait, the physical layout puts host and client separate. For simplicity in a single page app, 
        // the host panel itself could just render a host's deck in the grid.
        // Or we just add a "Host Deck" below the host panel.
        // Let's integrate a host-specific deck directly into the host view so they don't need two tabs.
        appendHostDeck();
        
    } catch (err) {
        hideLoading();
        showError('Could not create room. The ID might be taken or networking failed.');
    }
}

function setupHostListeners() {
    state.peer.on('connection', (conn) => {
        console.log('New connection:', conn.peer);
        
        conn.on('open', () => {
            // A wait for 'hello' message to get their name
        });
        
        conn.on('data', (data) => {
            handleHostReceivedData(conn, data);
        });
        
        conn.on('close', () => {
            console.log('Connection closed:', conn.peer);
            const clientId = state.peerToClient[conn.peer];
            if (clientId && state.clients[clientId]) {
                state.clients[clientId].disconnected = true;
                state.clients[clientId].conn = null;
            }
            delete state.peerToClient[conn.peer];
            updateHostUI();
            checkAutoReveal();
            broadcastState(); // Update others about participants
        });
    });
}

function handleHostReceivedData(conn, data) {
    console.log('Host received:', data);
    
    if (data.type === 'HELLO') {
        const clientId = data.clientId || conn.peer;
        state.peerToClient[conn.peer] = clientId;
        state.clients[clientId] = { 
            name: data.name || `User ${conn.peer.substring(0,4)}`, 
            conn: conn,
            disconnected: false
        };
        // Reply with current state
        conn.send({
            type: 'STATE_SYNC',
            votingState: state.votingState,
            participants: getParticipantList(),
            yourVote: state.votes[clientId]
        });
        updateHostUI();
        broadcastState();
    } else if (data.type === 'VOTE' && state.votingState === 'VOTING') {
        const clientId = state.peerToClient[conn.peer] || conn.peer;
        state.votes[clientId] = data.vote;
        updateHostUI();
        checkAutoReveal();
    }
}

function broadcastState() {
    const participantList = getParticipantList();
    const payload = {
        type: 'STATE_SYNC',
        votingState: state.votingState,
        participants: participantList
    };
    
    Object.values(state.clients).forEach(client => {
        if (client.conn && client.conn !== 'self' && client.conn.open) {
            client.conn.send(payload);
        }
    });
}

function getParticipantList() {
    // Only send who is in the room and if they have voted. Don't reveal votes unless state is REVEALED.
    return Object.keys(state.clients).map(clientId => {
        return {
            id: clientId,
            name: state.clients[clientId].name,
            hasVoted: state.votes[clientId] !== undefined,
            vote: state.votingState === 'REVEALED' ? state.votes[clientId] : null,
            disconnected: state.clients[clientId].disconnected
        };
    });
}

function checkAutoReveal() {
    if (state.votingState === 'REVEALED') return;
    
    const activeClients = Object.keys(state.clients).filter(id => !state.clients[id].disconnected);
    const activeClientCount = activeClients.length;
    
    const activeVoteCount = activeClients.filter(id => state.votes[id] !== undefined).length;
    
    if (activeClientCount > 0 && activeVoteCount === activeClientCount) {
        revealVotes();
    }
}

function revealVotes() {
    state.votingState = 'REVEALED';
    updateHostUI();
    broadcastState();
    calculateStats();
}

function resetVotes() {
    state.votingState = 'VOTING';
    state.votes = {};
    updateHostUI();
    broadcastState();
    elements.statsPanel.classList.add('hidden');
}

function calculateStats() {
    let sum = 0;
    let count = 0;
    const numVotes = [];
    
    Object.values(state.votes).forEach(v => {
        if (v !== '?' && v !== '🔄' && v !== undefined && v !== null) {
            const val = parseFloat(v);
            if (!isNaN(val)) {
                sum += val;
                count++;
                numVotes.push(val);
            }
        }
    });
    
    if (count > 0) {
        const mean = sum / count;
        elements.statMean.textContent = mean.toFixed(2);
        
        if (count > 1) {
            // Standard Deviation
            const squareDiffs = numVotes.map(v => Math.pow(v - mean, 2));
            const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / count;
            const stdDev = Math.sqrt(avgSquareDiff);
            elements.statStdDev.textContent = stdDev.toFixed(2);
        } else {
            elements.statStdDev.textContent = '0.00';
        }
        
        elements.statsPanel.classList.remove('hidden');
    } else {
        elements.statsPanel.classList.add('hidden');
    }
}

function updateHostUI(sortBy = null) {
    elements.hostParticipants.innerHTML = '';
    
    let parts = Object.keys(state.clients).map(id => ({
        id: id,
        name: state.clients[id].name,
        vote: state.votes[id],
        disconnected: state.clients[id].disconnected
    }));
    
    if (sortBy === 'vote' && state.votingState === 'REVEALED') {
        parts.sort((a, b) => {
            const valA = parseFloat(a.vote);
            const valB = parseFloat(b.vote);
            if (!isNaN(valA) && !isNaN(valB)) return valA - valB;
            if (isNaN(valA) && !isNaN(valB)) return 1;
            if (!isNaN(valA) && isNaN(valB)) return -1;
            return 0;
        });
    }

    parts.forEach(p => {
        const card = document.createElement('div');
        card.className = 'participant-card';
        if (p.vote !== undefined) card.classList.add('has-voted');
        if (state.votingState === 'REVEALED') card.classList.add('revealed');
        if (p.disconnected) card.classList.add('disconnected');
        
        let displayVote = '?';
        if (state.votingState === 'REVEALED' && p.vote !== undefined) {
            displayVote = p.vote;
        } else if (p.vote !== undefined) {
            displayVote = '✓';
        } else {
            displayVote = '...';
            card.classList.remove('has-voted');
        }
        
        card.innerHTML = `
            <div class="vote-display">${displayVote}</div>
            <div class="participant-name" title="${p.name}">${p.name}</div>
        `;
        elements.hostParticipants.appendChild(card);
    });
    
    // Update Controls
    const hasVotes = Object.keys(state.votes).length > 0;
    elements.btnReveal.disabled = state.votingState === 'REVEALED' || !hasVotes;
    elements.btnReset.disabled = !hasVotes && state.votingState === 'VOTING';
    elements.btnSort.disabled = state.votingState !== 'REVEALED';
}

function appendHostDeck() {
    // Add a deck for the host to vote
    const dashboard = document.querySelector('#host-screen .main-content');
    const deckDiv = document.createElement('div');
    deckDiv.className = 'deck-container glass-panel';
    deckDiv.style.marginTop = '2rem';
    deckDiv.innerHTML = `<h3>Host Vote</h3><div class="cards-grid" id="host-deck-grid"></div>`;
    dashboard.appendChild(deckDiv);
    
    const grid = document.getElementById('host-deck-grid');
    DECK.forEach(val => {
        const c = document.createElement('div');
        c.className = 'poker-card';
        c.textContent = val;
        c.onclick = () => {
            if (state.votingState === 'REVEALED') return;
            // Clear selections
            document.querySelectorAll('#host-deck-grid .poker-card').forEach(cb => cb.classList.remove('selected'));
            c.classList.add('selected');
            
            // Register host vote
            state.votes[state.myClientId] = val;
            updateHostUI();
            checkAutoReveal();
        };
        grid.appendChild(c);
    });
}

// Host controls bindings
elements.btnReveal.onclick = revealVotes;
elements.btnReset.onclick = () => {
    resetVotes();
    // clear host selected card
    document.querySelectorAll('#host-deck-grid .poker-card').forEach(cb => cb.classList.remove('selected'));
};
elements.btnSort.onclick = () => updateHostUI('vote');
elements.btnCopyRoom.onclick = () => {
    navigator.clipboard.writeText(state.roomId).then(() => {
        elements.btnCopyRoom.textContent = 'Copied!';
        setTimeout(() => elements.btnCopyRoom.textContent = 'Copy', 2000);
    });
};

// --- CLIENT LOGIC ---

async function clientJoinRoom(targetRoomId) {
    if (!targetRoomId) return showError('Please enter a Room ID');
    
    const name = elements.inputDisplayName.value.trim() || `User ${Math.floor(Math.random()*1000)}`;
    state.myName = name;
    localStorage.setItem('poker_planner_name', name);
    state.myClientId = getClientId();

    targetRoomId = targetRoomId.toUpperCase().trim();
    
    showLoading('Joining Room...');
    
    try {
        state.peer = await initPeer();
        state.connection = state.peer.connect(targetRoomId, { reliable: true });
        
        state.connection.on('open', () => {
            console.log('Connected to host');
            hideLoading();
            showScreen('client');
            elements.clientRoomDisplay.textContent = targetRoomId;
            
            // Say hello to register
            state.connection.send({
                type: 'HELLO',
                name: state.myName,
                clientId: state.myClientId
            });
            
            renderClientDeck();
        });
        
        state.connection.on('data', (data) => {
            handleClientReceivedData(data);
        });
        
        state.connection.on('error', (err) => {
            hideLoading();
            showError('Connection to host lost.');
            showScreen('home');
        });
        
        state.connection.on('close', () => {
            alert("The host closed the room or you were disconnected.");
            window.location.reload();
        });
        
        // Timeout for connection
        setTimeout(() => {
            if (!state.connection.open) {
                console.log("Connection timeout reached (20s)");
                state.connection.close();
                hideLoading();
                showError('Could not find that room. Is the Host still active? (Timeout)');
            }
        }, 20000);
        
    } catch (err) {
        hideLoading();
        showError('Network error joining room.');
    }
}

function handleClientReceivedData(data) {
    if (data.type === 'STATE_SYNC') {
        const previousVotingState = state.votingState;
        state.votingState = data.votingState;
        
        if (state.votingState === 'VOTING' && previousVotingState === 'REVEALED') {
            // New round started
            state.votes = {};
            elements.deck.style.display = 'flex';
            elements.clientVoteStatus.classList.add('hidden');
            document.querySelectorAll('#deck .poker-card').forEach(cb => cb.classList.remove('selected'));
        }
        
        if (state.votingState === 'REVEALED') {
            // Re-show deck container just to say "round over", but we hide the cards
            elements.deck.style.display = 'none';
        }
        
        if (state.votingState === 'VOTING' && data.yourVote !== undefined) {
            elements.clientSelectedCard.textContent = data.yourVote;
            elements.deck.style.display = 'none';
            elements.clientVoteStatus.classList.remove('hidden');
            
            document.querySelectorAll('#deck .poker-card').forEach(cb => {
                if (cb.textContent === data.yourVote) cb.classList.add('selected');
                else cb.classList.remove('selected');
            });
        }
    }
}

function renderClientDeck() {
    elements.deck.innerHTML = '';
    DECK.forEach(val => {
        const c = document.createElement('div');
        c.className = 'poker-card';
        c.textContent = val;
        c.onclick = () => submitClientVote(val, c);
        elements.deck.appendChild(c);
    });
}

function submitClientVote(val, cardElement) {
    if (state.votingState === 'REVEALED') return;
    
    document.querySelectorAll('#deck .poker-card').forEach(cb => cb.classList.remove('selected'));
    cardElement.classList.add('selected');
    
    state.connection.send({
        type: 'VOTE',
        vote: val
    });
    
    elements.clientSelectedCard.textContent = val;
    elements.deck.style.display = 'none';
    elements.clientVoteStatus.classList.remove('hidden');
}

elements.btnChangeVote.onclick = () => {
    elements.clientVoteStatus.classList.add('hidden');
    elements.deck.style.display = 'flex';
};

// Initial Bindings
const savedName = localStorage.getItem('poker_planner_name');
if (savedName) elements.inputDisplayName.value = savedName;

elements.btnCreate.onclick = hostCreateRoom;
elements.btnJoin.onclick = () => clientJoinRoom(elements.inputRoomId.value);
elements.inputRoomId.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') clientJoinRoom(elements.inputRoomId.value);
});
