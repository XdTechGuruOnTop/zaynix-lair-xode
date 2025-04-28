const express = require('express');
const fs = require('fs');
const { exec } = require("child_process");
let router = express.Router()
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");
const { upload } = require('./mega');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    let num = req.query.number;
    async function zaynixPair() {
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);
        try {
            // Optimize socket creation with minimal settings
            let zaynixPairWeb = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }).child({ level: "silent" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "silent" }).child({ level: "silent" }), // Changed to silent for better performance
                browser: Browsers.macOS("Safari"),
                connectTimeoutMs: 60000, // Faster timeout for connection
                keepAliveIntervalMs: 5000, // Reduced keep-alive interval
            });

            if (!zaynixPairWeb.authState.creds.registered) {
                // Reduced initial delay
                await delay(500); 
                num = num.replace(/[^0-9]/g, '');
                const code = await zaynixPairWeb.requestPairingCode(num);
                if (!res.headersSent) {
                    // Send response immediately
                    await res.send({ code });
                }
            }

            zaynixPairWeb.ev.on('creds.update', saveCreds);
            zaynixPairWeb.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection === "open") {
                    try {
                        // Reduced delay
                        await delay(3000);
                        const auth_path = './session/';
                        const user_jid = jidNormalizedUser(zaynixPairWeb.user.id);

                        function randomMegaId(length = 6, numberLength = 4) {
                            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                            let result = '';
                            for (let i = 0; i < length; i++) {
                                result += characters.charAt(Math.floor(Math.random() * characters.length));
                            }
                            const number = Math.floor(Math.random() * Math.pow(10, numberLength));
                            return `${result}${number}`;
                        }

                        // Upload and create session immediately
                        const mega_url = await upload(fs.createReadStream(auth_path + 'creds.json'), `${randomMegaId()}.json`);
                        const string_session = mega_url.replace('https://mega.nz/file/', '');
                        const sid = "Zaynix-MD=" + string_session;

                        // Send messages in parallel using Promise.all
                        await Promise.all([
                            zaynixPairWeb.sendMessage(user_jid, { text: sid }),
                            zaynixPairWeb.sendMessage(user_jid, {
                                text: `*🌟 𝐙𝐚𝐲𝐧𝐢𝐱-𝐌𝐃 𝐒𝐄𝐒𝐒𝐈𝐎𝐍 𝐆𝐄𝐍𝐄𝐑𝐀𝐓𝐄𝐃 𝐒𝐔𝐂𝐂𝐄𝐒𝐒𝐅𝐔𝐋𝐋𝐘! 🌟*

╔══════════════════════╗
║  ⚡ *SAVE YOUR SESSION ID* ⚡  
║  ✅ *CHECK ABOVE MESSAGE*  ✅
╚══════════════════════╝

*📢 OFFICIAL CHANNEL:*
➤ https://whatsapp.com/channel/0029Vb0Tq5eKbYMSSePQtI34

*👨‍💻 NEED HELP?*
➤ wa.me/919341378016

*⚠️ IMPORTANT:*
🔒 *NEVER SHARE YOUR SESSION ID WITH ANYONE* 🔒
💯 *ZAYNIX-MD - THE BEST MD BOT* 💯`
                            }),
                            zaynixPairWeb.sendMessage("919341378016@s.whatsapp.net", {
                                text: `🤖 *ZAYNIX-MD NOTIFICATION* 🤖\n\n✅ New session generated successfully!\n📱 User: ${user_jid}`
                            })
                        ]);

                    } catch (e) {
                        console.error("Error during session handling:", e);
                        exec('pm2 restart zaynix');
                    }

                    await delay(100);
                    removeFile('./session');
                    process.exit(0);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    await delay(2000); // Reduced delay before reconnect
                    zaynixPair();
                }
            });
        } catch (err) {
            console.log("Error in session creation:", err);
            exec('pm2 restart zaynix-md');
            console.log("service restarted");
            await removeFile('./session');
            if (!res.headersSent) {
                await res.send({ code: "Service Unavailable" });
            }
            zaynixPair();
        }
    }
    return await zaynixPair();
});

// Error handling with automatic recovery
process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err);
    exec('pm2 restart prabath');
});

module.exports = router;
