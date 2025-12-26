const axios = require('axios');
const config = require('./config');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
  generateWAMessageFromContent,
  proto,
  downloadContentFromMessage,
  jidDecode,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys'); // Use latest version

const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson } = require('./lib/functions');
const { AntiDelDB, initializeAntiDeleteSettings, setAnti, getAnti, getAllAntiDeleteSettings, saveContact, loadMessage, getName, getChatSummary, saveGroupMetadata, getGroupMetadata, saveMessageCount, getInactiveGroupMembers, getGroupMembersMessageCount, saveMessage } = require('./data');
const fs = require('fs');
const ff = require('fluent-ffmpeg');
const P = require('pino');
const { PresenceControl, BotActivityFilter } = require('./data/presence');
const qrcode = require('qrcode-terminal');
const StickersTypes = require('wa-sticker-formatter');
const util = require('util');
const { sms, downloadMediaMessage, AntiDelete } = require('./lib');
const FileType = require('file-type');
const { File } = require('megajs');
const os = require('os');
const Crypto = require('crypto');
const path = require('path');
const express = require('express');

const prefix = config.PREFIX;
const ownerNumber = ['923306137477'];

const l = console.log;

// Temp directory cleanup
const tempDir = path.join(os.tmpdir(), 'cache-temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

const clearTempDir = () => {
  fs.readdir(tempDir, (err, files) => {
    if (err) return;
    files.forEach(file => fs.unlink(path.join(tempDir, file), () => {}));
  });
};
setInterval(clearTempDir, 5 * 60 * 1000);

// Express server
const app = express();
const port = process.env.PORT || 9090;
app.use(express.static(path.join(__dirname, 'lib')));
app.get('/', (req, res) => res.redirect('/irfan.html'));
app.listen(port, () => console.log(`Server running on port ${port}`));

// Session loading from MEGA
const sessionDir = path.join(__dirname, 'sessions');
const credsPath = path.join(sessionDir, 'creds.json');
if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

async function loadSession() {
  if (!config.SESSION_ID) {
    console.log('No SESSION_ID - Will generate QR');
    return null;
  }
  try {
    const megaFileId = config.SESSION_ID.startsWith('IK~') ? config.SESSION_ID.replace('IK~', '') : config.SESSION_ID;
    const filer = File.fromURL(`https://mega.nz/file/${megaFileId}`);
    const data = await new Promise((resolve, reject) => {
      filer.download((err, data) => err ? reject(err) : resolve(data));
    });
    fs.writeFileSync(credsPath, data);
    console.log('MEGA session loaded successfully');
    return JSON.parse(data.toString());
  } catch (e) {
    console.log('Session load failed - Will use QR');
    return null;
  }
}

// Main connection function
async function connectToWA() {
  console.log('Connecting to WhatsApp...');
  const creds = await loadSession();
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'sessions'), { creds });

  const { version } = await fetchLatestBaileysVersion();

  const conn = makeWASocket({
    logger: P({ level: 'silent' }),
    printQRInTerminal: !creds,
    browser: Browsers.macOS('Firefox'),
    auth: state,
    version,
    getMessage: async () => ({})
  });

  conn.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !creds) qrcode.generate(qr, { small: true });

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(shouldReconnect ? 'Reconnecting...' : 'Logged out - Change SESSION_ID');
      if (shouldReconnect) setTimeout(connectToWA, 5000);
    } else if (connection === 'open') {
      console.log('DARKZONE-MD Connected Successfully ✅');

      // Load plugins
      const pluginPath = path.join(__dirname, 'plugins');
      if (fs.existsSync(pluginPath)) {
        fs.readdirSync(pluginPath).forEach(file => {
          if (file.endsWith('.js')) require(path.join(pluginPath, file));
        });
        console.log('All plugins loaded ✅');
      }

      // Improved connected message
      const upMessage = `
┏━━━━━━━━━━━━━━━━━━┓
   DARKZONE-MD v6.0.0
┗━━━━━━━━━━━━━━━━━━┛
✅ Bot is now Online & Fully Operational

📡 Prefix: ${prefix}
👑 Owner: ERFAN AHMAD
🚀 Powered by DARKZONE-MD

🌐 Channel: https://whatsapp.com/channel/0029Vb5dDVO59PwTnL86j13J
🔗 GitHub: https://github.com/ERFAN-Md/DARKZONE-MD
      `;

      await conn.sendMessage(conn.user.id, {
        image: { url: 'https://files.catbox.moe/jecbfo.jpg' },
        caption: upMessage.trim()
      });
    }
  });

  conn.ev.on('creds.update', saveCreds);

  // Your other events (messages.update, call, group-participants.update, presence.update, messages.upsert, etc.)
  // Paste all your original event handlers here exactly as they were (they work fine in CommonJS)

  // ... (All your event handlers: anti-delete, anti-call, welcome/goodbye, presence, messages.upsert with all features, commands, etc.)

  // At the end, add your custom functions (decodeJid, downloadMediaMessage, sendFileUrl, etc.)

  return conn;
}

// Global error handlers to prevent crashes
process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);

// Start the bot
setTimeout(connectToWA, 4000);
