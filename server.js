// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const app = express();

// --------------------
// CORS - Only allow frontend
// --------------------
app.use(cors({
  origin: "https://eco-eyes-polished-frontend.vercel.app",
  methods: ["GET", "POST"]
}));
app.use(express.json());

// --------------------
// Backend API Routes (if any)
// --------------------
const api = require('./routes/api');
app.use('/api', api);

// --------------------
// HTTP + Socket.IO Setup
// --------------------
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://eco-eyes-polished-frontend.vercel.app",
    methods: ["GET", "POST"]
  }
});

// --------------------
// Data
// --------------------
const dataDir = path.join(__dirname, 'data');
const feedsList = require(path.join(dataDir, 'feeds.json'));
const eventsList = require(path.join(dataDir, 'events.json'));

if (!feedsList.length || !eventsList.length) {
  console.warn('Warning: feeds.json or events.json is empty!');
}

const FEED_COUNT = feedsList.length;
const FRAME_INTERVAL_MS = 2000;
const feedsState = feedsList.map(f => ({ id: f.id, lastAnomalyAt: 0 }));

// --------------------
// Helper: Create Frame Data URL
// --------------------
function makeFrameDataURL(feedId, anomaly = false, extraText = '') {
  const ts = new Date().toLocaleTimeString();
  const color = anomaly ? '#ff0066' : '#33ffcc';
  const glitch = anomaly ? `<rect x="0" y="0" width="100%" height="100%" fill="black" opacity="0.12"></rect>` : '';
  const svg = `
  <svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'>
    <defs>
      <linearGradient id="g" x1="0" x2="1">
        <stop offset="0" stop-color="#0f172a"/>
        <stop offset="1" stop-color="#02111e"/>
      </linearGradient>
      <style>
        .title { font-family: Arial, Helvetica, sans-serif; fill: ${color}; font-size: 22px; font-weight: bold; }
        .meta { font-family: Arial, Helvetica, sans-serif; fill: #b7c2c7; font-size: 14px; }
      </style>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    ${glitch}
    <text x="14" y="30" class="title">ECHO EYES - FEED #${feedId}${anomaly ? ' - ANOMALY' : ''}</text>
    <text x="14" y="58" class="meta">TS: ${ts}</text>
    <text x="14" y="90" class="meta">${extraText}</text>
    ${Array.from({length: 20}).map(()=>`<rect x="${Math.random()*640}" y="${Math.random()*360}" width="${Math.random()*3}" height="1" fill="rgba(255,255,255,${Math.random()*0.06})" />`).join('')}
  </svg>
  `;
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

// --------------------
// Frame Emission
// --------------------
function startEmission() {
  setInterval(() => {
    const now = Date.now();
    feedsState.forEach(feed => {
      const anomalyChance = Math.random();
      const anomaly = (anomalyChance > 0.92) && (now - feed.lastAnomalyAt > 10_000);
      if (anomaly) feed.lastAnomalyAt = now;
      const extraText = anomaly ? `CODE:${Math.random().toString(36).slice(2,10).toUpperCase()}` : '';
      const evt = anomaly ? eventsList[Math.floor(Math.random()*eventsList.length)] : null;
      const frame = {
        feedId: feed.id,
        timestamp: now,
        dataURL: makeFrameDataURL(feed.id, anomaly, extraText),
        anomaly,
        event: evt,
        meta: {
          location: feedsList[feed.id - 1]?.location || 'Unknown',
          note: anomaly ? evt?.desc : 'normal'
        }
      };
      io.emit('frame', frame);
    });
  }, FRAME_INTERVAL_MS);
}

// --------------------
// Socket.IO Connections
// --------------------
io.on('connection', (socket) => {
  console.log('Client connected', socket.id);
  socket.emit('init', { feedCount: FEED_COUNT });

  socket.on('capture', (evidence) => {
    console.log('Capture received', evidence.feedId, 'note=', evidence.meta?.note);
    socket.emit('captureAck', { ok: true, savedAt: Date.now() });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
  });
});

// --------------------
// Health Check
// --------------------
app.get("/", (req, res) => {
  res.send("Echo Eyes backend is running");
});

// --------------------
// Start Server
// --------------------
const PORT = process.env.PORT || config.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Echo Eyes backend listening on :${PORT} (USE_DB=${config.USE_DB})`);
  startEmission();
});
