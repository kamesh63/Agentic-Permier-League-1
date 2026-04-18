# FanPulse: Real-time Cricket Match Engagement Platform

## Overview

FanPulse is a real-time web application designed to enhance fan engagement during cricket matches. It provides live match updates, momentum tracking, interactive chat, and upcoming match information, with a focus on the Royal Challengers Bangalore (RCB) vs Delhi Capitals (DC) rivalry.

## Features

- Real-time match score and statistics updates
- Live momentum bar showing team dominance
- WebSocket-based event feed for instant notifications
- Interactive chat system for fan discussions
- Upcoming matches display
- Clutch moment overlays for high-stakes situations
- Responsive web interface

## Technology Stack

- **Backend**: Python with FastAPI framework
- **Frontend**: HTML, CSS, and JavaScript
- **Real-time Communication**: WebSockets
- **Containerization**: Docker
- **External API**: Cricket data integration (requires API key)

## Prerequisites

- Python 3.11 or higher
- Docker (optional, for containerized deployment)
- Cricket API key (for live data)

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/kamesh63/Agentic-Permier-League-1.git
   cd Agentic-Permier-League-1
   ```

2. Create a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Set up environment variables:
   Create a `.env` file in the root directory and add your Cricket API key:
   ```
   CRICKET_API_KEY=your_api_key_here
   ```

## Usage

### Local Development

1. Activate the virtual environment (if not already activated)
2. Run the application:
   ```
   uvicorn main:app --reload
   ```
3. Open your browser and navigate to `http://localhost:8000`

### Docker Deployment

1. Build the Docker image:
   ```
   docker build -t fanpulse .
   ```
2. Run the container:
   ```
   docker run -p 8000:8000 fanpulse
   ```
3. Access the application at `http://localhost:8000`

## API Endpoints

- `GET /`: Serves the main application page
- `WebSocket /ws`: Real-time updates endpoint
- Static files are served from the root directory

## Configuration

The application uses environment variables for configuration:
- `CRICKET_API_KEY`: API key for cricket data (required for live updates)

## Development

The application consists of:
- `main.py`: FastAPI backend server
- `index.html`: Main HTML page
- `styles.css`: Styling
- `app.js`: Frontend JavaScript logic
- `requirements.txt`: Python dependencies
- `Dockerfile`: Container configuration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Disclaimer

This application is for educational and entertainment purposes. Cricket data and API usage may be subject to third-party terms and conditions.