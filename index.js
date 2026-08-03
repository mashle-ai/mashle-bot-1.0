// Procure por esta parte no seu index.js e deixe exatamente assim:
const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state,
    printQRInTerminal: false,
    // ADICIONE ESTA LINHA ABAIXO (Essencial para não dar erro de pareamento):
    browser: ['Ubuntu', 'Chrome', '110.0.5481.177'] 
});
