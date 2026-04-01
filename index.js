import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from 'baileys';
import pino from 'pino';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
let globalSock = null;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/status', (req, res) => {
  res.json({ online: globalSock !== null });
});

app.get('/pair', async (req, res) => {
  const phone = req.query.phone;
  if (!phone) return res.json({ success: false, error: 'Nimewo manke' });
  if (!globalSock) return res.json({ success: false, error: 'Bot poko prè' });
  try {
    const code = await globalSock.requestPairingCode(phone);
    res.json({ success: true, code });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

async function connectWA() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version, auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
  });
  globalSock = sock;
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      globalSock = null;
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) setTimeout(connectWA, 5000);
    } else if (connection === 'open') {
      globalSock = sock;
      console.log('WhatsApp connected!');
    }
  });
}

connectWA();