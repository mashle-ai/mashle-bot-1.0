const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const express = require('express');
const axios = require('axios');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações do seu ambiente (Configure no painel do Render)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "SUA_API_KEY_DO_GEMINI";
const NUMERO_BOT = process.env.NUMERO_BOT || "258843297841"; 

// Inicialização com a biblioteca estável
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const gruposConfig = {}; 
const antiFloodUsuarios = {};

app.get('/', (req, res) => {
    res.status(200).send('<h1>🤖 mashle-bot-1.0 Ativo!</h1><p>Verifique os logs no painel para ver o codigo de pareamento.</p>');
});
app.listen(PORT, () => console.log(`Servidor a rodar na porta ${PORT}`));

async function ligarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_mashle');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ['Ubuntu', 'Chrome', '110.0.5481.177']
    });

    // SISTEMA DE PAREAMENTO POR CÓDIGO DE TEXTO
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let numeroLimpo = NUMERO_BOT.replace(/[^0-9]/g, '');
                const codigoPareamento = await sock.requestPairingCode(numeroLimpo);
                console.log("=========================================");
                console.log(`🤖 MASHLE-BOT-1.0 - CÓDIGO DE PAREAMENTO GERADO:`);
                console.log(`👉   ${codigoPareamento}   👈`);
                console.log("Insira este codigo no seu WhatsApp em: Aparelhos Conectados > Conectar com numero de telefone");
                console.log("=========================================");
            } catch (err) {
                console.error("Erro ao solicitar codigo de pareamento:", err);
            }
        }, 8000); 
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom) ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true;
            console.log('Conexao fechada, a tentar reconectar: ', shouldReconnect);
            if (shouldReconnect) ligarBot();
        } else if (connection === 'open') {
            console.log('💪⚡ MASHLE-BOT-1.0 LIGADO E PRONTO PARA O COMBATE!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg || !msg.message || msg.key.fromMe) return;

        const de = msg.key.remoteJid;
        const ehGrupo = de.endsWith('@g.us');
        const deQuem = msg.key.participant || de;
        
        const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const partes = texto.trim().split(' ');
        const comando = partes[0].toLowerCase();
        const args = texto.trim().substring(comando.length).trim();

        if (ehGrupo && !gruposConfig[de]) {
            gruposConfig[de] = { antilink: false, antiflood: false, mutado: false };
        }

        // Moderação: Mute
        if (ehGrupo && gruposConfig[de].mutado) {
            const grupoInfo = await sock.groupMetadata(de);
            const ehAdmin = grupoInfo.participants.find(p => p.id === deQuem)?.admin;
            if (!ehAdmin) {
                await sock.sendMessage(de, { delete: msg.key });
                return;
            }
        }

        // Moderação: Anti-Link
        if (ehGrupo && gruposConfig[de].antilink && (texto.includes('://whatsapp.com') || texto.includes('http://') || texto.includes('https://'))) {
            const grupoInfo = await sock.groupMetadata(de);
            const ehAdmin = grupoInfo.participants.find(p => p.id === deQuem)?.admin;
            if (!ehAdmin) {
                await sock.sendMessage(de, { delete: msg.key });
                await sock.groupParticipantsUpdate(de, [deQuem], "remove");
                await sock.sendMessage(de, { text: `🚨 *Anti-Link:* @${deQuem.split('@')[0]} expulso por partilhar links!`, mentions: [deQuem] });
                return;
            }
        }

        // Moderação: Anti-Flood
        if (ehGrupo && gruposConfig[de].antiflood) {
            const agora = Date.now();
            if (!antiFloodUsuarios[deQuem]) antiFloodUsuarios[deQuem] = [];
            antiFloodUsuarios[deQuem] = antiFloodUsuarios[deQuem].filter(tempo => agora - tempo < 5000);
            antiFloodUsuarios[deQuem].push(agora);

            if (antiFloodUsuarios[deQuem].length > 5) {
                const grupoInfo = await sock.groupMetadata(de);
                const ehAdmin = grupoInfo.participants.find(p => p.id === deQuem)?.admin;
                if (!ehAdmin) {
                    await sock.groupParticipantsUpdate(de, [deQuem], "remove");
                    await sock.sendMessage(de, { text: `🚨 *Anti-Flood:* @${deQuem.split('@')[0]} expulso por inundar o chat!`, mentions: [deQuem] });
                    return;
                }
            }
        }

        // Execução de Comandos
        if (comando === '!menu' || comando === '!ajuda') {
            const menu = `💪⚡ *MASHLE-BOT-1.0* ⚡💪\n\n` +
                         `Olá! Eu sou o *mashle-bot-1.0*, um sistema movido a pura força muscular e código! 🦾\n` +
                         `👑 *Criador Oficial:* Peter\n\n` +
                         `*Gerais:*\n` +
                         `👉 *!ia [texto]* - Conversa com o Gemini IA.\n` +
                         `👉 *!play [nome]* - Descarrega musicas.\n\n` +
                         `*Moderação de Grupo (Admins):*\n` +
                         `🔒 *!mute* - Silencia o grupo.\n` +
                         `🔓 *!unmute* - Permite envio de mensagens.\n` +
                         `🔗 *!antilink [on/off]* - Bloqueia links externos.\n` +
                         `🌊 *!antiflood [on/off]* - Trava envio em massa.`;
            await sock.sendMessage(de, { text: menu });
        }

        if (['!mute', '!unmute', '!antilink', '!antiflood'].includes(comando)) {
            if (!ehGrupo) return sock.sendMessage(de, { text: "❌ Comando restrito a grupos." });
            const grupoInfo = await sock.groupMetadata(de);
            const ehAdmin = grupoInfo.participants.find(p => p.id === deQuem)?.admin;
            if (!ehAdmin) return sock.sendMessage(de, { text: "❌ Apenas administradores do grupo podem usar este comando." });

            if (comando === '!mute') {
                gruposConfig[de].mutado = true;
                await sock.sendMessage(de, { text: "🔒 *Grupo mutado!* Apenas admins falam agora." });
            } else if (comando === '!unmute') {
                gruposConfig[de].mutado = false;
                await sock.sendMessage(de, { text: "🔓 *Grupo aberto!* Todos os membros podem falar." });
            } else if (comando === '!antilink') {
                gruposConfig[de].antilink = (args === 'on');
                await sock.sendMessage(de, { text: args === 'on' ? "🔗 *Anti-Link Ativado!*" : "🔗 *Anti-Link Desativado!*" });
            } else if (comando === '!antiflood') {
                gruposConfig[de].antiflood = (args === 'on');
                await sock.sendMessage(de, { text: args === 'on' ? "🌊 *Anti-Flood Ativado!*" : "🌊 *Anti-Flood Desativado!*" });
            }
        }

        if (comando === '!ia') {
            if (!args) return sock.sendMessage(de, { text: "❌ Escreva algo para o bot processar." });
            try {
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                const promptDoPeter = `O teu nome é mashle-bot-1.0. Tu foste criado pelo desenvolvedor Peter. Responde de forma direta, prestativa e às vezes usa referências a treinos físicos ou éclairs de chocolate como o personagem Mashle. Responde à seguinte pergunta: ${args}`;
                
                const result = await model.generateContent(promptDoPeter);
                const response = await result.response;
                await sock.sendMessage(de, { text: `🤖 *Mashle IA:* ${response.text()}` });
            } catch (e) {
                await sock.sendMessage(de, { text: "❌ Falha no processamento da IA." });
            }
        }

        if (comando === '!play') {
            if (!args) return sock.sendMessage(de, { text: "❌ Indique o nome da musica." });
            await sock.sendMessage(de, { text: `🎵 A preparar o audio para: "${args}"...` });
            try {
                const cobaltResponse = await axios.post('https://cobalt.tools', {
                    url: `https://youtube.com{encodeURIComponent(args)}`,
                    downloadMode: 'audio',
                    audioFormat: 'mp3'
                }, { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' } });

                if (cobaltResponse.data?.url) {
                    await sock.sendMessage(de, { audio: { url: cobaltResponse.data.url }, mimetype: 'audio/mp4' });
                } else {
                    await sock.sendMessage(de, { text: "❌ Não foi possivel encontrar a faixa musical." });
                }
            } catch (e) {
                await sock.sendMessage(de, { text: "❌ Erro durante o download do ficheiro de som." });
            }
        }
    });
}

ligarBot();
            
