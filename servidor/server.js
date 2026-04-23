const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const uploadDir = path.join(__dirname, '../interface/public/patrocinadores');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/patrocinadores', express.static(uploadDir));

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir); },
    filename: function (req, file, cb) {
        const { numero, index } = req.body;
        cb(null, `${numero}-${parseInt(index) + 1}.png`);
    }
});
const upload = multer({ storage: storage });

app.post('/upload', upload.single('imagem'), (req, res) => {
    res.json({ success: true });
});

let pedrasSorteadas = [];
let cartelas = [];
let patrocinadores = {};
let rastreioConfig = { todas: true, lista: [] };
let historicoJogos = [];

// 🔥 NOVO: GARANTE A PERSISTÊNCIA DO JOGO ATUAL MESMO SE O SERVIDOR REINICIAR 🔥
try { pedrasSorteadas = JSON.parse(fs.readFileSync('jogo_atual.json')); } catch (err) { fs.writeFileSync('jogo_atual.json', JSON.stringify([])); }

try { cartelas = JSON.parse(fs.readFileSync('cartelas.json')); } catch (err) {}
try { patrocinadores = JSON.parse(fs.readFileSync('patrocinadores.json')); } catch (err) { fs.writeFileSync('patrocinadores.json', JSON.stringify({})); }
try { rastreioConfig = JSON.parse(fs.readFileSync('rastreio.json')); } catch (err) { fs.writeFileSync('rastreio.json', JSON.stringify(rastreioConfig)); }
try { historicoJogos = JSON.parse(fs.readFileSync('historico_jogos.json')); } catch (err) { fs.writeFileSync('historico_jogos.json', JSON.stringify([])); }

function enviarRanking() {
    let rankingData = [];
    if (rastreioConfig.todas) {
        let ranking = cartelas.map(c => ({ tabela: c.tabela || c.id, faltam: c.numeros.filter(n => !pedrasSorteadas.includes(n)).length, numeros: c.numeros }));
        ranking.sort((a, b) => a.faltam - b.faltam);
        rankingData = ranking.slice(0, 50);
    } else {
        let selecionadas = cartelas.filter(c => rastreioConfig.lista.includes(c.tabela?.toString()) || rastreioConfig.lista.includes(c.id?.toString()));
        rankingData = selecionadas.map(c => ({ tabela: c.tabela || c.id, faltam: c.numeros.filter(n => !pedrasSorteadas.includes(n)).length, numeros: c.numeros }));
        rankingData.sort((a, b) => a.faltam - b.faltam);
    }
    io.emit('ranking_update', rankingData);
}

io.on('connection', (socket) => {
    socket.emit('init', { pedrasSorteadas, patrocinadores, rastreioConfig, historicoJogos });
    enviarRanking(); 

    socket.on('salvar_patrocinadores', (novos) => {
        patrocinadores = novos;
        fs.writeFileSync('patrocinadores.json', JSON.stringify(patrocinadores, null, 2));
        io.emit('patrocinadores_atualizados', patrocinadores);
    });

    socket.on('remover_imagem_patrocinador', ({ numero, index }) => {
        const filepath = path.join(uploadDir, `${numero}-${parseInt(index) + 1}.png`);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        io.emit('patrocinadores_atualizados', patrocinadores);
    });

    socket.on('pedir_relatorio', () => {
        let relatorioPatros = [];
        for (const [num, nomes] of Object.entries(patrocinadores)) {
            const listaNomes = Array.isArray(nomes) ? nomes : [nomes];
            listaNomes.forEach((nome, idx) => {
                const filepath = path.join(uploadDir, `${num}-${idx + 1}.png`);
                relatorioPatros.push({ pedra: num, nome: nome, statusImagem: fs.existsSync(filepath) ? 'Imagem Personalizada' : 'Imagem Brasão da Paróquia' });
            });
        }
        socket.emit('retorno_relatorio', { sorteados: pedrasSorteadas, patrocinadores: relatorioPatros });
    });

    socket.on('configurar_rastreio', (config) => {
        rastreioConfig = config;
        fs.writeFileSync('rastreio.json', JSON.stringify(rastreioConfig, null, 2));
        enviarRanking();
    });

    socket.on('sortear_pedra', (num) => {
        if (!pedrasSorteadas.includes(num)) {
            pedrasSorteadas.push(num);
            fs.writeFileSync('jogo_atual.json', JSON.stringify(pedrasSorteadas)); // Salva estado
            io.emit('pedra_sorteada', num);
            io.emit('update_sorteados', pedrasSorteadas);
            enviarRanking();
        }
    });

    socket.on('remover_pedra', (num) => {
        pedrasSorteadas = pedrasSorteadas.filter(n => n !== num);
        fs.writeFileSync('jogo_atual.json', JSON.stringify(pedrasSorteadas)); // Atualiza estado
        io.emit('update_sorteados', pedrasSorteadas);
        enviarRanking();
    });

    socket.on('buscar_cartela', (idBuscado) => {
        const cartela = cartelas.find(c => c.tabela == idBuscado || c.id == idBuscado);
        if (cartela) socket.emit('retorno_cartela', { id: cartela.tabela || cartela.id, numeros: cartela.numeros });
        else socket.emit('retorno_cartela', null);
    });

    socket.on('resetar', (dadosRodada) => {
        if (dadosRodada && dadosRodada.nome) {
            historicoJogos.unshift({
                id: Date.now(),
                nome: dadosRodada.nome,
                data: new Date().toLocaleString('pt-BR'),
                pedras: [...pedrasSorteadas]
            });
            fs.writeFileSync('historico_jogos.json', JSON.stringify(historicoJogos, null, 2));
            io.emit('historico_atualizado', historicoJogos);
        }
        pedrasSorteadas = [];
        fs.writeFileSync('jogo_atual.json', JSON.stringify([])); // Zera estado atual
        io.emit('update_sorteados', pedrasSorteadas);
        io.emit('reseta_jogo');
        enviarRanking(); 
    });

    socket.on('excluir_jogo_salvo', (id) => {
        historicoJogos = historicoJogos.filter(j => j.id !== id);
        fs.writeFileSync('historico_jogos.json', JSON.stringify(historicoJogos, null, 2));
        io.emit('historico_atualizado', historicoJogos);
    });
});

server.listen(5001, () => { console.log(`🚀 Servidor LOCAL rodando e blindado!`); });