const express = require('express');
const fs = require('fs');
const { exec } = require("child_process");
const router = express.Router();
const pino = require("pino");
const { 
    uploadToMega,
    randomMegaId 
} = require('./mega');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");

function removeFile(filePath) {
    if (!fs.existsSync(filePath)) return false;
    fs.rmSync(filePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const num = req.query.number;
    if (!num) return res.status(400).send({ error: "Number parameter is required" });

    async function handlePairing() {
        const { state, saveCreds } = await useMultiFileAuthState('./session');
        
        try {
            const sock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
            });

            if (!sock.authState.creds.registered) {
                await delay(1500);
                const cleanNum = num.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(cleanNum);
                if (!res.headersSent) return res.send({ code });
            }

            sock.ev.on('creds.update', saveCreds);
            sock.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect } = update;
                
                if (connection === "open") {
                    try {
                        await delay(5000);
                        const credsPath = './session/creds.json';
                        
                        if (!fs.existsSync(credsPath)) {
                            throw new Error("Session file not found");
                        }

                        const megaUrl = await uploadToMega(credsPath);
                        if (!megaUrl) throw new Error("Upload failed");
                        
                        const fileId = megaUrl.split('/file/')[1]?.split('/')[0];
                        if (!fileId) throw new Error("Invalid Mega URL format");
                        
                        const sid = `Zaynix-MD=${fileId}`;
                        const userJid = jidNormalizedUser(sock.user.id);

                        await sock.sendMessage(userJid, { text: sid });
                        await sock.sendMessage(userJid, {
                            text: `*Session Generated Successfully!*\n\n` +
                                  `Your session ID: ${sid}\n\n` +
                                  `⚠️ DO NOT SHARE THIS WITH ANYONE`
                        });

                        await delay(100);
                        await removeFile('./session');
                        process.exit(0);
                    } catch (e) {
                        console.error("Session error:", e);
                        exec('pm2 restart pair');
                    }
                } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    await delay(10000);
                    handlePairing();
                }
            });
        } catch (err) {
            console.error("Pairing error:", err);
            exec('pm2 restart pair');
            await removeFile('./session');
            if (!res.headersSent) res.send({ error: "Service unavailable" });
        }
    }

    await handlePairing();
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    exec('pm2 restart pair');
});

module.exports = router;
