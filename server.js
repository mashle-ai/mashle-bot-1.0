const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

const app = express().use(bodyParser.json());

// ==================== CONFIGURAÇÕES DO SEU BOT MASHLE ====================
// IMPORTANTE: Cadastre essas variáveis no painel do Render (Environment Variables)
// ou substitua diretamente entre as aspas para testar.
const TOKEN_WHATSAPP = process.env.TOKEN_WHATSAPP || "SEU_TOKEN_DE_ACESSO_META";
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || "SEU_PHONE_NUMBER_ID";
const TOKEN_VERIFICACAO = process.env.TOKEN_VERIFICACAO || "mashle_verification_token";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "SUA_API_KEY_DO_GEMINI";

// Inicializa a IA (Google Gemini)
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Rota padrão (Raiz) - Necessária para o UptimeRobot acessar e manter o bot acordado
app.get('/', (req, res) => {
    res.status(200).send('🤖 Bot mashle está online e rodando na nuvem!');
});

// 1. Validação do Webhook (Exigência da Meta para ativar o bot)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token === TOKEN_VERIFICACAO) {
        console.log("Webhook do bot mashle verificado com sucesso!");
        return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
});

// 2. Recebimento de mensagens do WhatsApp
app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;

        // Garante que a estrutura da mensagem recebida é válida
        if (body.object && body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
            const msgObj = body.entry[0].changes[0].value.messages[0];
            const doNumero = msgObj.from; // Número de quem enviou
            
            if (msgObj.type === 'text') {
                const textoRecebido = msgObj.text.body.trim();

                // COMANDO: !menu ou !ajuda
                if (textoRecebido === '!menu' || textoRecebido === '!ajuda') {
                    const menuTexto = `💪⚡ *BOT MASHLE* ⚡💪\n\nOlá! Eu sou o *mashle*, seu assistente virtual de comandos.\n\n*Comandos disponíveis:*\n👉 *!ia [sua pergunta]* - Converse com a Inteligência Artificial.\n👉 *!play [nome da música]* - Baixe áudios do YouTube diretamente.`;
                    await enviarTextoWhatsApp(doNumero, menuTexto);
                }
                
                // COMANDO: !ia
                else if (textoRecebido.startsWith('!ia ')) {
                    const pergunta = textoRecebido.replace('!ia ', '');
                    await enviarTextoWhatsApp(doNumero, "🧠 *mashle pensando...*");
                    
                    try {
                        const response = await ai.models.generateContent({
                            model: 'gemini-2.5-flash',
                            contents: pergunta,
                        });
                        await enviarTextoWhatsApp(doNumero, `🤖 *Mashle IA:*\n\n${response.text}`);
                    } catch (aiError) {
                        console.error("Erro na IA:", aiError);
                        await enviarTextoWhatsApp(doNumero, "❌ Desculpe, tive um problema ao processar meu cérebro de IA agora.");
                    }
                }

                // COMANDO: !play
                else if (textoRecebido.startsWith('!play ')) {
                    const nomeMusica = textoRecebido.replace('!play ', '');
                    await enviarTextoWhatsApp(doNumero, `🎵 Buscando e preparando o áudio para: "${nomeMusica}"...`);

                    try {
                        // Faz a requisição para a API do Cobalt para obter o link do áudio do YouTube
                        const cobaltResponse = await axios.post('https://cobalt.tools', {
                            url: `https://youtube.com{encodeURIComponent(nomeMusica)}`,
                            downloadMode: 'audio',
                            audioFormat: 'mp3'
                        }, {
                            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
                        });

                        if (cobaltResponse.data && cobaltResponse.data.url) {
                            const linkAudio = cobaltResponse.data.url;
                            await enviarAudioWhatsApp(doNumero, linkAudio);
                        } else {
                            await enviarTextoWhatsApp(doNumero, "❌ Não encontrei um link de áudio válido para essa música.");
                        }
                    } catch (musicError) {
                        console.error("Erro ao buscar música:", musicError);
                        await enviarTextoWhatsApp(doNumero, "❌ Erro ao baixar a música. Tente especificar melhor o nome e o artista.");
                    }
                }
            }
        }
        res.sendStatus(200);
    } catch (error) {
        console.error("Erro geral no processamento do webhook:", error);
        res.sendStatus(200); // Sempre retorne 200 para a Meta não bloquear seu webhook
    }
});

// Função para disparar mensagens de texto
async function enviarTextoWhatsApp(para, texto) {
    try {
        await axios.post(`https://facebook.com{PHONE_NUMBER_ID}/messages`, {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: para,
            type: "text",
            text: { body: texto }
        }, {
            headers: { 'Authorization': `Bearer ${TOKEN_WHATSAPP}`, 'Content-Type': 'application/json' }
        });
    } catch (err) {
        console.error("Erro ao enviar texto via Meta API:", err.response?.data || err.message);
    }
}

// Função para disparar mensagens de áudio
async function enviarAudioWhatsApp(para, urlAudio) {
    try {
        await axios.post(`https://facebook.com{PHONE_NUMBER_ID}/messages`, {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: para,
            type: "audio",
            audio: { link: urlAudio }
        }, {
            headers: { 'Authorization': `Bearer ${TOKEN_WHATSAPP}`, 'Content-Type': 'application/json' }
        });
    } catch (err) {
        console.error("Erro ao enviar áudio via Meta API:", err.response?.data || err.message);
    }
}

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => console.log(`O bot mashle está rodando na porta ${PORTA}`));
                           
