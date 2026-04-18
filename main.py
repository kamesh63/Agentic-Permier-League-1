from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import asyncio
import json
import random
import os
import httpx
from typing import List
from dotenv import load_dotenv

load_dotenv()
CRICKET_API_KEY = os.getenv("CRICKET_API_KEY")

app = FastAPI(title="FanPulse RCB vs DC Real-time Backend")

# --- Global State ---
class MatchState:
    def __init__(self):
        self.pulse_level = 0
        self.momentum = 50  # 0 is RCB, 100 is DC
        self.overs = 18.2
        self.runs = 175
        self.wickets = 4
        self.batter1 = "Kohli 82*(48)"
        self.batter2 = "Karthik 14*(6)"
        self.bowler = "Kuldeep 3.2-0-28-1"
        self.clutch_active = False

state = MatchState()

UPCOMING_MATCHES = [
    {"team1": "MI", "team2": "CSK", "time": "Tomorrow, 7:30 PM", "status": "Upcoming"},
    {"team1": "KKR", "team2": "RR", "time": "Apr 20, 7:30 PM", "status": "Upcoming"},
    {"team1": "SRH", "team2": "PBKS", "time": "Apr 21, 3:30 PM", "status": "Upcoming"}
]

# --- Realistic Simulator Fallback ---
# If API is missing or no live matches, we simulate a thrilling ending!
def simulate_ball():
    global state
    outcomes = [
        (0, "Dot ball. Solid defense.", "normal", 0),
        (1, "Just a single down to long on.", "normal", 2),
        (2, "Pushed into the gap, they come back for two. Excellent running!", "major", 5),
        (4, "CRACKING SHOT! That's a boundary!", "major", 15),
        (6, "OUT OF THE PARK! MASSIVE SIX!", "major", 25),
        ("W", "BOWLED HIM! What a delivery! The stadium goes completely silent, then erupts!", "major", 30)
    ]
    
    # Increase ball count
    balls = int(round((state.overs % 1) * 10))
    overs = int(state.overs)
    
    # Check for match end before simulating next ball
    if overs >= 20 or state.wickets >= 10:
        state.overs = 0.0
        state.runs = 0
        state.wickets = 0
        state.momentum = 50
        return {"type": "new_event", "text": "Innings Break! The innings has concluded. Resetting scoreboard for the next match...", "event_class": "major"}
        
    balls += 1
    if balls >= 6:
        overs += 1
        balls = 0
    state.overs = float(f"{overs}.{balls}")
    
    outcome = random.choices(outcomes, weights=[30, 40, 10, 10, 5, 5])[0]
    runs, text, event_class, pulse_boost = outcome
    
    if runs == "W":
        state.wickets += 1
    else:
        state.runs += runs
        
    state.pulse_level = min(100, state.pulse_level + pulse_boost)
    
    # Shift momentum slightly based on who scored (assuming RCB is batting for demo)
    if runs == "W":
        state.momentum = min(100, state.momentum + 10) # DC gains momentum
    elif isinstance(runs, int) and runs >= 4:
        state.momentum = max(0, state.momentum - 10) # RCB gains momentum
        
    return {"type": "new_event", "text": text, "event_class": event_class}


# --- WebSocket Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        # Send initial state
        await websocket.send_json(self._get_state_dict())

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict, exclude: WebSocket = None):
        for connection in self.active_connections:
            if connection != exclude:
                try:
                    await connection.send_json(message)
                except:
                    pass

    def _get_state_dict(self):
        return {
            "type": "state_update",
            "pulse": state.pulse_level,
            "momentum": state.momentum,
            "overs": f"{state.overs:.1f}",
            "score": f"{state.runs}/{state.wickets}",
            "batter1": state.batter1,
            "batter2": state.batter2,
            "bowler": state.bowler,
            "upcoming": UPCOMING_MATCHES
        }

manager = ConnectionManager()

# --- Background Tasks ---
async def match_simulator():
    """Simulates real-time pulse and momentum decay."""
    while True:
        await asyncio.sleep(1)
        
        # Pulse Decay
        if state.pulse_level > 0:
            state.pulse_level = max(0, state.pulse_level - 1)

        # Momentum Drift to center
        if state.momentum > 50:
            state.momentum -= 0.5
        elif state.momentum < 50:
            state.momentum += 0.5

        # Broadcast state every second
        await manager.broadcast(manager._get_state_dict())

async def ball_by_ball_simulator():
    """Simulates realistic ball events if API fails."""
    while True:
        await asyncio.sleep(random.randint(15, 30)) # Wait 15-30 seconds between balls
        if not getattr(state, "api_live", False):
            event = simulate_ball()
            await manager.broadcast(event)

async def api_poller():
    """Fetches real-time match events from CricAPI."""
    while True:
        await asyncio.sleep(15) # Poll every 15 seconds
        
        if not CRICKET_API_KEY or CRICKET_API_KEY == "your_api_key_here":
            if not getattr(state, "api_live", False):
                # Just show this warning once
                event = {"type": "new_event", "text": "System: Using Advanced Simulator. Add API key for real data.", "event_class": "normal"}
                await manager.broadcast(event)
                state.api_live = False
            await asyncio.sleep(60) # Don't spam the warning
            continue
            
        try:
            async with httpx.AsyncClient() as client:
                url = f"https://api.cricapi.com/v1/currentMatches?apikey={CRICKET_API_KEY}&offset=0"
                response = await client.get(url)
                
                if response.status_code == 200:
                    data = response.json()
                    matches = data.get("data", [])
                    
                    if matches:
                        match = matches[0]
                        match_name = match.get("name", "Unknown Match")
                        status = match.get("status", "")
                        score_info = match.get("score", [])
                        
                        if score_info and len(score_info) > 0:
                            current_score = score_info[0]
                            state.runs = current_score.get("r", 0)
                            state.wickets = current_score.get("w", 0)
                            state.overs = current_score.get("o", 0.0)
                            state.api_live = True # API is working and returning data
                        else:
                            state.api_live = False
                            
                        state.batter1 = match.get("teamInfo", [{}])[0].get("shortname", "T1")
                        state.batter2 = match.get("teamInfo", [{}, {}])[1].get("shortname", "T2") if len(match.get("teamInfo", [])) > 1 else ""
                        state.bowler = "API Tracking Live"
                        
                        event_text = f"Live update from {match_name}: {status}"
                        event_type = "major"
                        state.pulse_level = min(100, state.pulse_level + 10)
                        
                        event = {"type": "new_event", "text": event_text, "event_class": event_type}
                        await manager.broadcast(event)
                    else:
                        state.api_live = False
                else:
                    print("API Error:", response.text)
                    state.api_live = False
        except Exception as e:
            print("API Polling Exception:", e)
            state.api_live = False

# Start background tasks
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(match_simulator())
    asyncio.create_task(api_poller())
    asyncio.create_task(ball_by_ball_simulator())

# --- Routes ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("action") == "reaction":
                # Increase pulse globally on reaction
                state.pulse_level = min(100, state.pulse_level + 15)
                
                # Shift momentum slightly based on team (assuming team parameter)
                team = message.get("team", "RCB") # Default to RCB for demo
                if team == "RCB":
                    state.momentum = max(0, state.momentum - 2)
                else:
                    state.momentum = min(100, state.momentum + 2)
                
                # Broadcast the interaction so others see floating emojis
                await manager.broadcast({
                    "type": "user_reaction",
                    "emoji": message.get("emoji"),
                    "x": message.get("x"),
                    "y": message.get("y")
                }, exclude=websocket)
            elif message.get("action") == "chat":
                # Broadcast chat message to everyone ELSE
                await manager.broadcast({
                    "type": "chat_message",
                    "text": message.get("text"),
                    "isSelf": False
                }, exclude=websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Serve Frontend Files
app.mount("/static", StaticFiles(directory="."), name="static")

@app.get("/")
async def get_index():
    return FileResponse("index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
