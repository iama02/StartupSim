# StartupSim 🚀

**StartupSim** is a gamified, interactive web application designed to simulate the challenges, choices, and triumphs of launching and scaling a startup. Using AI-driven scenarios, players navigate real-world startup decisions, manage team morale and budgets, face sudden crises, and present their final venture results to an AI investor board.

---

## 🌟 Key Features

- **Interactive Decision-Based Simulation**: Every choice branches your startup's path, impacting resources, runway, and investor interest.
- **Dynamic Crisis Management**: Face high-pressure, realistic scenarios built to test your strategic thinking and resilience.
- **AI-Powered Feedback & Scenario Generation**: Leverages advanced LLMs (via Groq Cloud SDK) to construct unique journeys based on your business idea.
- **Visual Journey Progress**: A dynamic, interactive roadmap that highlights your startup's progression from discovery to scaling.
- **AI Boardroom Evaluation**: Pitch your achievements, view metrics (Product-Market Fit, Resilience, etc.), and receive detailed strategic feedback.

---

## 🛠️ Tech Stack

- **Frontend**: Semantic HTML5, Vanilla CSS3 (custom styling, glassmorphism UI), and Vanilla JavaScript.
- **Backend**: Node.js and Express.
- **Database**: MongoDB (via Mongoose ODM).
- **AI Services**:
  - **Groq SDK** (Llama models) for generating custom scenarios, journeys, and evaluations.
  - **Replicate API** for generating custom illustrations/assets.

---

## 📂 Project Structure

```text
StartupSim/
├── avatars/                 # Custom generated profile/avatar graphics
├── generated/               # AI-generated comics and simulation assets
├── public/                  # Static assets and templates
│   ├── index.html           # Main landing page
│   ├── start.html           # Registration and idea submission page
│   ├── journey.html         # Roadmap tracking page
│   ├── simulation.html      # Immersive decision simulation arena
│   └── dashboard.html       # Analytics and final boardroom pitch
├── server.js                # Express app entry point
├── update_server.js         # Server update utilities
├── simulation.css           # Styling for the main simulation interface
├── style.css                # Base styling & components
├── .env.example             # Template for local environment variables
└── package.json             # Node.js dependencies and scripts
```

---

## ⚙️ Prerequisites & Configuration

Ensure you have [Node.js](https://nodejs.org/) installed locally.

### Environment Setup

Create a `.env` file in the root directory by copying the example file:

```bash
cp .env.example .env
```

Configure the following environment keys inside `.env`:

```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
GROQ_API_KEY=your_groq_api_key
REPLICATE_API_TOKEN=your_replicate_api_token
GEMINI_API_KEY=your_gemini_api_key
```

---

## 🚀 Getting Started

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/iama02/StartupSim.git
   cd StartupSim
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Run the Server**:
   ```bash
   npm start
   ```
   *By default, the server runs on `http://localhost:3000`.*

---

## 📜 License

This project is licensed under the [ISC License](LICENSE).
