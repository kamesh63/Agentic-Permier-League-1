// --- Elements ---
const root = document.documentElement;
const momentumBar = document.getElementById('momentum-bar');
const eventFeed = document.getElementById('event-feed');
const clutchOverlay = document.getElementById('clutch-overlay');
const clutchTimerDisplay = document.getElementById('clutch-timer');

// Additional UI Elements
const upcomingMatchesTrack = document.getElementById('upcoming-matches-track');
const voiceAgentToggle = document.getElementById('voice-agent-toggle');
const matchScore = document.getElementById('match-score');
const matchOvers = document.getElementById('match-overs');
const batter1 = document.getElementById('batter1');
const batter2 = document.getElementById('batter2');
const bowlerInfo = document.getElementById('bowler-info');

// Chat UI Elements
const chatWindow = document.getElementById('chat-window');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const chatMessages = document.getElementById('chat-messages');

// Momentum Labels
const momentumLabelRcb = document.getElementById('momentum-label-rcb');
const momentumLabelDc = document.getElementById('momentum-label-dc');

// --- WebSocket Connection ---
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}/ws`;
let ws;

function connectWebSocket() {
    ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
    };

    ws.onclose = () => {
        console.log("WebSocket disconnected. Reconnecting...");
        setTimeout(connectWebSocket, 2000);
    };
}

// Start connection if not in local file mode
if (window.location.protocol !== 'file:') {
    connectWebSocket();
} else {
    // Mock for local dev without server
    console.warn("Running in local file mode without WebSocket Server.");
}

// --- Message Handling ---
function handleServerMessage(data) {
    if (data.type === 'state_update') {
        updatePulseVisuals(data.pulse);
        updateMomentum(data.momentum);
        
        // Update Scoreboard
        if (matchScore) matchScore.innerText = data.score;
        if (matchOvers) matchOvers.innerText = `Overs: ${data.overs}`;
        if (batter1) batter1.innerText = data.batter1;
        if (batter2) batter2.innerText = data.batter2;
        if (bowlerInfo) bowlerInfo.innerText = data.bowler;

        // Render upcoming matches
        renderUpcomingMatches(data.upcoming);
    } else if (data.type === 'new_event') {
        addEventToFeed(data);
    } else if (data.type === 'user_reaction') {
        spawnFloatingEmoji(data.emoji, data.x, data.y);
    } else if (data.type === 'chat_message') {
        appendChatMessage(data.text, data.isSelf);
    }
}

// --- Upcoming Matches Rendering ---
function renderUpcomingMatches(matches) {
    if (!upcomingMatchesTrack || !matches) return;
    upcomingMatchesTrack.innerHTML = '';
    matches.forEach(match => {
        const card = document.createElement('div');
        card.className = 'upcoming-match-card';
        card.innerHTML = `
            <div class="match-teams">${match.team1} vs ${match.team2}</div>
            <div class="match-time">${match.time}</div>
            <div class="match-status">${match.status}</div>
        `;
        upcomingMatchesTrack.appendChild(card);
    });
}

// --- Chat Window Logic ---
// (Chat is now a permanent sidebar)

function sendChatMessage() {
    const text = chatInput.value.trim();
    if (text) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                action: 'chat',
                text: text
            }));
        } else {
            console.warn("WebSocket not connected. Displaying message locally only.");
        }
        // Optimistically append our own message
        appendChatMessage(text, true);
        chatInput.value = '';
    }
}

chatSendBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});

function appendChatMessage(text, isSelf = false) {
    const el = document.createElement('div');
    el.className = `chat-message ${isSelf ? 'self' : ''}`;
    el.innerText = text;
    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- Visual Updates ---
function updatePulseVisuals(pulseLevel) {
    const scale = 1 + (pulseLevel / 100) * 1.5;
    root.style.setProperty('--pulse-scale', scale);
    
    const speed = Math.max(0.5, 3 - (pulseLevel / 100) * 2.5);
    root.style.setProperty('--pulse-speed', `${speed}s`);

    if (pulseLevel > 80) {
        root.style.setProperty('--pulse-color', 'rgba(226, 35, 26, 0.8)'); // RCB Red intense
    } else {
        root.style.setProperty('--pulse-color', 'rgba(0, 76, 147, 0.5)'); // DC Blue
    }
}

function updateMomentum(momentumValue) {
    const team1Width = 100 - momentumValue;
    const team2Width = momentumValue;
    
    const barLeft = document.getElementById('momentum-bar-left');
    const barRight = document.getElementById('momentum-bar-right');
    
    if (barLeft) barLeft.style.width = `${team1Width}%`;
    if (barRight) barRight.style.width = `${team2Width}%`;
    
    if (momentumLabelRcb && momentumLabelDc) {
        momentumLabelRcb.innerText = `RCB Momentum (${Math.round(team1Width)}%)`;
        momentumLabelDc.innerText = `DC Momentum (${Math.round(momentumValue)}%)`;
    }
}

// --- Interaction Sending ---
document.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const emoji = e.target.getAttribute('data-reaction');
        
        // Spawn locally for immediate feedback
        spawnFloatingEmoji(emoji, e.clientX, e.clientY);
        
        // Send to server
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                action: 'reaction',
                team: 'RCB', // For demo purposes, user is RCB
                emoji: emoji,
                x: e.clientX,
                y: e.clientY
            }));
        }
    });
});

function spawnFloatingEmoji(emoji, x, y) {
    const el = document.createElement('div');
    el.className = 'floating-emoji';
    el.innerText = emoji;
    
    const startX = x + (Math.random() * 40 - 20);
    el.style.left = `${startX}px`;
    el.style.top = `${y - 40}px`;
    
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
}

// --- Voice Agent ---
let voiceEnabled = false;
let preferredVoice = null;

function getPreferredVoice() {
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    return voices.find(v => v.lang.includes('en-IN') || v.lang.includes('hi-IN') || v.lang.includes('en-GB')) || voices[0] || null;
}

// Find preferred voice (try to get Indian English or Hindi for local feel)
if (window.speechSynthesis) {
    preferredVoice = getPreferredVoice();
    window.speechSynthesis.onvoiceschanged = () => {
        preferredVoice = getPreferredVoice();
    };
}

if (voiceAgentToggle) {
    voiceAgentToggle.addEventListener('change', (e) => {
        voiceEnabled = e.target.checked;
        if (voiceEnabled && window.speechSynthesis) {
            const msg = new SpeechSynthesisUtterance("Audio commentary enabled.");
            if (preferredVoice) msg.voice = preferredVoice;
            window.speechSynthesis.speak(msg);
        } else if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    });
}

function addEventToFeed(event) {
    const el = document.createElement('div');
    el.className = `event-item ${event.event_class}`;
    el.innerText = event.text;
    eventFeed.appendChild(el);
    
    // Auto-scroll to bottom of feed
    eventFeed.scrollTop = eventFeed.scrollHeight;
    
    if (eventFeed.children.length > 50) {
        eventFeed.children[0].remove();
    }

    if (voiceEnabled && window.speechSynthesis) {
        // Prevent overlapping voices; optional, but good for fast events
        window.speechSynthesis.cancel(); 
        const msg = new SpeechSynthesisUtterance(event.text);
        
        if (preferredVoice) msg.voice = preferredVoice;
        
        // Dynamic pitch and rate based on event class
        if (event.event_class === "major") {
            msg.pitch = 1.3;
            msg.rate = 1.15;
        } else {
            msg.pitch = 1.0;
            msg.rate = 1.0;
        }
        
        window.speechSynthesis.speak(msg);
    }
}

// --- Clutch Mode (Still local for demo purposes) ---
let clutchActive = false;
function triggerClutchMode() {
    clutchActive = true;
    clutchOverlay.classList.add('active');
    
    let timeLeft = 10.0;
    clutchTimerDisplay.innerText = timeLeft.toFixed(1) + 's';
    
    const countdown = setInterval(() => {
        timeLeft -= 0.1;
        clutchTimerDisplay.innerText = timeLeft.toFixed(1) + 's';
        
        if (timeLeft <= 0) {
            clearInterval(countdown);
            endClutchMode(false);
        }
    }, 100);

    document.getElementById('clutch-yes').onclick = () => {
        clearInterval(countdown);
        endClutchMode(true, "Yes!");
    };
    document.getElementById('clutch-no').onclick = () => {
        clearInterval(countdown);
        endClutchMode(true, "No");
    };
}

function endClutchMode(answered, choice) {
    clutchOverlay.classList.remove('active');
    clutchActive = false;
    
    if (answered) {
        addEventToFeed({ text: `You predicted: ${choice}!`, event_class: "major" });
        spawnFloatingEmoji("🎯", window.innerWidth / 2, window.innerHeight / 2);
    }
}

// Trigger Clutch Mode after 15 seconds for the demo
setTimeout(triggerClutchMode, 15000);
