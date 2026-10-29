// Elementos DOM


const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const capturedPhoto = document.getElementById('capturedPhoto');
const captureFaceBtn = document.getElementById('captureFace');
const timerButton = document.getElementById('timerButton');
const orientationButton = document.getElementById('orientationButton');
const continueBtn = document.getElementById('goToSend');
const retakeBtn = document.getElementById('retake');
const statusText = document.getElementById('statusText');
const faceBox = document.querySelector('.face-box');
const cancelSendBtn = document.getElementById('cancelSend');
const finalPhoto = document.getElementById('finalPhoto');
const downloadQrCode = document.getElementById('downloadQrCode');
const frameOptions = document.querySelectorAll('.frame-option');
const sendInstructions = document.getElementById('sendInstructions');
const instructionText = document.getElementById('instructionText');
const countdownTimer = document.getElementById('countdownTimer');
const countdownNumber = document.getElementById('countdownNumber');
const faqButton = document.getElementById('faqButton');
const tutorialModal = document.getElementById('tutorialModal');
const closeTutorial = document.getElementById('closeTutorial');
const stepperItems = document.querySelectorAll('.stepper-item');
const loadingProgress = document.getElementById('loadingProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

// Elementos de filtro
const brightnessInput = document.getElementById('brightness');
const contrastInput = document.getElementById('contrast');
const saturationInput = document.getElementById('saturation');
const resetFiltersBtn = document.getElementById('resetFilters');
const aiEnhanceBtn = document.getElementById('aiEnhanceBtn');
const mascotToggle = document.getElementById('mascotToggle');

// Elementos de controle de recorte avançado
const featherRadiusInput = document.getElementById('featherRadius');
const edgeSensitivityInput = document.getElementById('edgeSensitivity');
const resetRecorteBtn = document.getElementById('resetRecorte');
const featherValueDisplay = document.getElementById('featherValue');
const edgeValueDisplay = document.getElementById('edgeValue');

// Mascote animado (mascote.js): chamada segura, não quebra o app se ele não carregar
const M = (f, ...a) => { try { return window.Mascote && window.Mascote[f] ? window.Mascote[f](...a) : undefined; } catch (e) { console.warn('Mascote:', e); } };
let mascoteFoto = null;   // desenho do mascote no tamanho da foto (quando ele sai na foto)

// Valores de filtro
let filterValues = {
    brightness: 100,
    contrast: 100,
    saturation: 100
};

// Valores de refinamento de recorte
let recorteValues = {
    featherRadius: 2,
    edgeSensitivity: 0.3
};

// ===== Configuração da câmera (ajuste aqui) =====
const CONFIG_CAMERA = {
    contagemSegundos: 3,   // contagem regressiva antes da foto
    espelharFoto: true,    // true = prévia E foto salva espelhadas (como um espelho)
    som: true,             // bipes da contagem + som de obturador
    flash: true,           // clarão branco no momento da foto
    voz: true,             // fala a contagem regressiva (3, 2, 1) em português
    orientacao: 'landscape' // 'landscape' ou 'portrait'
};
const flashEl = document.getElementById('flash');

// Configurações de timer e voz
const TIMER_OPTIONS = [
    { seconds: 3, label: '3s', voice: 'pt-BR' },
    { seconds: 5, label: '5s', voice: 'pt-BR' },
    { seconds: 10, label: '10s', voice: 'pt-BR' }
];
let selectedTimerIndex = 0; // padrão: 3 segundos

// Variáveis de estado
let stream = null;
let faceDetectionInterval = null;
let capturedImageData = null;
let isModelLoaded = false;
let isCaptured = false;
let selectedFrame = null;
let frameApplied = false;
let semMolduraEscolhida = false;   // true quando a pessoa escolheu "Sem moldura"
let bodyPixModel = null;
let captureTimer = null;
let currentStep = 1;
let idleTimer = null;
const IDLE_MS = 60000; // volta ao passo 1 após 60 s sem toque (passos 2 e 3)
let mascotActive = false; // estado do filtro do mascote
let confirmaOverlay = null;   // diálogo de confirmação (não usado nesta versão; evita erro em resetToInitialState)
let envioAutoTimer = null;   // temporizador de envio automático (não usado nesta versão)

// ===== Passo a passo (1 Foto, 2 Moldura, 3 QR Code, 4 Enviando) =====
function setStep(n) {
    currentStep = n;
    document.body.dataset.step = String(n);

    // O passo 4 (enviando) conta como etapa 3 concluída/ativa no indicador
    const ativo = Math.min(n, 3);
    stepperItems.forEach(item => {
        const s = Number(item.dataset.s);
        item.classList.toggle('active', s === ativo);
        // Etapa 3 aparece como finalizada (com check) quando alcançada
        item.classList.toggle('done', s < ativo || (s === 3 && n >= 3));
    });
    resetIdleTimer();
    M('passo', n);
}

function resetIdleTimer() {
    clearTimeout(idleTimer);
    if (currentStep === 2 || currentStep === 3) {
        idleTimer = setTimeout(resetToInitialState, IDLE_MS);
    }
}
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, resetIdleTimer, true));

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    video.classList.toggle('espelhado', CONFIG_CAMERA.espelharFoto);
    setStep(1);
    loadModels();
    setupEventListeners();
    startCamera();
});

// Carregar modelos do face-api.js e BodyPix
async function loadModels() {
    updateStatus('Carregando recursos da câmera...');
    loadingProgress.style.display = 'flex';
    updateProgress(10);

    try {
        const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

        updateProgress(20);
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        updateProgress(40);

        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        updateProgress(55);

        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        updateProgress(70);

        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        updateProgress(85);

        // Carregar modelo BodyPix para remoção de fundo (balanceado entre qualidade e velocidade)
        updateStatus('Carregando modelo de recorte de fundo...');
        console.log('Iniciando carregamento do BodyPix...');
        bodyPixModel = await bodyPix.load({
            architecture: 'MobileNetV1',
            outputStride: 16,
            multiplier: 0.75,
            quantBytes: 2
        });
        console.log('BodyPix carregado com sucesso!');
        obterSegmentador().then(() => console.log('Segmentador preciso carregado!')).catch((e) => console.warn('Segmentador preciso não carregou (usa BodyPix):', e));
        updateProgress(100);

        isModelLoaded = true;
        loadingProgress.style.display = 'none';

        // A câmera normalmente abre ANTES dos modelos terminarem de carregar.
        // Se for o caso, liga a detecção de rosto agora.
        if (stream && !isCaptured && currentStep === 1) {
            startFaceDetection();
            updateStatus('Câmera ativa. Posicione o rosto no centro.');
        }
    } catch (error) {
        console.error('Erro ao carregar modelos:', error);
        loadingProgress.style.display = 'none';
        updateStatus('Erro ao carregar modelos. Recorte avançado indisponível.');
        // Sem detecção: mantém a câmera funcionando e a moldura do rosto fixa
        if (stream && !isCaptured && currentStep === 1) {
            faceBox.classList.add('active');
            updateStatus('Câmera ativa. Posicione o rosto no centro.');
        }
    }
}

// Atualizar barra de progresso
function updateProgress(percent) {
    if (progressFill && progressText) {
        progressFill.style.width = percent + '%';
        progressText.textContent = percent + '%';
    }
}

// Aplicar filtros à foto
function applyFilters() {
    if (!capturedPhoto || !capturedPhoto.src) return;

    const filterString = `brightness(${filterValues.brightness}%) contrast(${filterValues.contrast}%) saturate(${filterValues.saturation}%)`;
    capturedPhoto.style.filter = filterString;
}

// Aplicar filtros à imagem e retornar base64
async function applyFiltersToImage(imageSrc) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;

            ctx.filter = `brightness(${filterValues.brightness}%) contrast(${filterValues.contrast}%) saturate(${filterValues.saturation}%)`;
            ctx.drawImage(img, 0, 0);

            resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = imageSrc;
    });
}

// Resetar filtros
function resetFilters() {
    Stats.setFiltro('normal');
    filterValues = {
        brightness: 100,
        contrast: 100,
        saturation: 100
    };

    brightnessInput.value = 100;
    contrastInput.value = 100;
    saturationInput.value = 100;

    brightnessInput.nextElementSibling.textContent = '100%';
    contrastInput.nextElementSibling.textContent = '100%';
    saturationInput.nextElementSibling.textContent = '100%';

    applyFilters();
    // Não reseta os valores de recorte (botão separado para isso)
}

// Melhorar foto com IA (simulação com filtros avançados)
function enhanceWithAI() {
    updateStatus('Aplicando melhoria com IA...');

    // Simulação de melhoria com filtros otimizados
    filterValues = {
        brightness: 105,
        contrast: 115,
        saturation: 110
    };

    brightnessInput.value = filterValues.brightness;
    contrastInput.value = filterValues.contrast;
    saturationInput.value = filterValues.saturation;

    brightnessInput.nextElementSibling.textContent = filterValues.brightness + '%';
    contrastInput.nextElementSibling.textContent = filterValues.contrast + '%';
    saturationInput.nextElementSibling.textContent = filterValues.saturation + '%';

    applyFilters();

    setTimeout(() => {
        updateStatus('Melhoria aplicada! A foto está mais nítida e vibrante.');
    }, 500);
}

// Ciclar entre as opções de timer
function cycleTimer() {
    selectedTimerIndex = (selectedTimerIndex + 1) % TIMER_OPTIONS.length;
    const selectedOption = TIMER_OPTIONS[selectedTimerIndex];
    timerButton.innerHTML = `<span class="icon" aria-hidden="true">⏱️</span> Timer: ${selectedOption.label}`;
    updateStatus(`Timer alterado para ${selectedOption.label}`);
}

// Alternar orientação (Paisagem <-> Retrato)
// A câmera continua sempre em 16:9; a tela e a foto são cortadas na proporção escolhida.
// Assim os gestos funcionam igual nos dois modos e não é preciso reiniciar a câmera.
function aplicarOrientacao() {
    const retrato = CONFIG_CAMERA.orientacao === 'portrait';
    const videoContainer = document.querySelector('.video-container');
    if (videoContainer) videoContainer.classList.toggle('portrait', retrato);
    document.body.classList.toggle('modo-retrato', retrato);
    if (orientationButton) {
        orientationButton.innerHTML = `<span class="icon" aria-hidden="true">📐</span> ${retrato ? 'Retrato' : 'Paisagem'}`;
    }
}

function toggleOrientation() {
    if (isCaptured) return; // não troca depois que a foto foi tirada
    CONFIG_CAMERA.orientacao = CONFIG_CAMERA.orientacao === 'landscape' ? 'portrait' : 'landscape';
    aplicarOrientacao();
    updateStatus(`Orientação alterada para ${CONFIG_CAMERA.orientacao === 'portrait' ? 'Retrato' : 'Paisagem'}`);
}

aplicarOrientacao();

// Configurar event listeners
function setupEventListeners() {
    captureFaceBtn.addEventListener('click', captureFace);
    timerButton.addEventListener('click', cycleTimer);
    if (orientationButton) orientationButton.addEventListener('click', toggleOrientation);
    continueBtn.addEventListener('click', showWhatsAppModal);
    retakeBtn.addEventListener('click', retakePhoto);
    // No passo 3, "Fazer outra foto" volta direto para a câmera (passo 1)
    cancelSendBtn.addEventListener('click', resetToInitialState);

    // Event listeners para molduras
    frameOptions.forEach(option => {
        option.addEventListener('click', () => selectFrame(option));
    });

    // Event listeners para filtros
    brightnessInput.addEventListener('input', (e) => {
        filterValues.brightness = e.target.value;
        e.target.nextElementSibling.textContent = e.target.value + '%';
        applyFilters();
    });

    contrastInput.addEventListener('input', (e) => {
        filterValues.contrast = e.target.value;
        e.target.nextElementSibling.textContent = e.target.value + '%';
        applyFilters();
    });

    saturationInput.addEventListener('input', (e) => {
        filterValues.saturation = e.target.value;
        e.target.nextElementSibling.textContent = e.target.value + '%';
        applyFilters();
    });

    resetFiltersBtn.addEventListener('click', resetFilters);

    // Event listeners para controles de recorte avançado
    if (featherRadiusInput) {
        featherRadiusInput.addEventListener('input', (e) => {
            recorteValues.featherRadius = parseFloat(e.target.value);
            if (featherValueDisplay) featherValueDisplay.textContent = e.target.value;
            // Invalida apenas o cache de harmonização (recorte continua o mesmo)
            invalidarHarmonia();
            if (capturedImageData) renderFinal();
        });
    }

    if (edgeSensitivityInput) {
        edgeSensitivityInput.addEventListener('input', (e) => {
            recorteValues.edgeSensitivity = parseInt(e.target.value) / 100;
            if (edgeValueDisplay) edgeValueDisplay.textContent = e.target.value + '%';
            // Invalida apenas o cache de harmonização (recorte continua o mesmo)
            invalidarHarmonia();
            if (capturedImageData) renderFinal();
        });
    }

    if (resetRecorteBtn) {
        resetRecorteBtn.addEventListener('click', () => {
            recorteValues = { featherRadius: 2, edgeSensitivity: 0.3 };
            if (featherRadiusInput) featherRadiusInput.value = 2;
            if (featherValueDisplay) featherValueDisplay.textContent = '2';
            if (edgeSensitivityInput) edgeSensitivityInput.value = 30;
            if (edgeValueDisplay) edgeValueDisplay.textContent = '30%';
            // Invalida apenas o cache de harmonização
            invalidarHarmonia();
            if (capturedImageData) renderFinal();
            updateStatus('Ajustes de recorte resetados.');
        });
    }

    // Event listener para melhoria com IA
    aiEnhanceBtn.addEventListener('click', enhanceWithAI);

    // Event listener para filtro do mascote
    // "Mascote na foto": coloca ou tira o mascote da foto (mesmo depois de tirada)
    mascotToggle.addEventListener('change', async (e) => {
        mascotActive = e.target.checked;
        if (mascotActive && !mascoteFoto && capturedImageData) {
            const base = await carregarImagem(capturedImageData);
            mascoteFoto = M('retrato', base.width, base.height) || null;
        }
        if (mascotActive && !mascoteFoto) { mascotActive = false; e.target.checked = false; }
        updateStatus(mascotActive ? 'Mascote adicionado à foto!' : 'Mascote retirado da foto.');
        if (mascotActive) M('moldura', true);
        if (capturedImageData) renderFinal();
    });

    // Event listeners para Presets de Filtros Rápidos
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            if (preset === 'normal') {
                filterValues = { brightness: 100, contrast: 100, saturation: 100 };
            } else if (preset === 'mono') {
                filterValues = { brightness: 105, contrast: 120, saturation: 0 };
            } else if (preset === 'cyber') {
                filterValues = { brightness: 110, contrast: 130, saturation: 180 };
            } else if (preset === 'vintage') {
                filterValues = { brightness: 95, contrast: 110, saturation: 70 };
            }

            brightnessInput.value = filterValues.brightness;
            contrastInput.value = filterValues.contrast;
            saturationInput.value = filterValues.saturation;

            brightnessInput.nextElementSibling.textContent = filterValues.brightness + '%';
            contrastInput.nextElementSibling.textContent = filterValues.contrast + '%';
            saturationInput.nextElementSibling.textContent = filterValues.saturation + '%';

            applyFilters();
        });
    });

    // Event listeners para FAQ/Tutorial
    faqButton.addEventListener('click', () => showTutorial(true));
    closeTutorial.addEventListener('click', hideTutorial);
}

// Iniciar câmera automaticamente
async function startCamera() {
    try {
        updateStatus('Iniciando câmera...');

        const videoConstraints = {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
            frameRate: { ideal: 30 }
        };

        stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints
        });

        video.srcObject = stream;
        await video.play();

        captureFaceBtn.disabled = false;

        // Iniciar detecção facial (se os modelos ainda não carregaram,
        // loadModels() liga a detecção quando terminar)
        if (isModelLoaded) {
            startFaceDetection();
            updateStatus('Câmera ativa. Posicione o rosto no centro.');
        } else {
            faceBox.classList.add('active');
            updateStatus('Câmera ativa. Preparando detecção de rosto...');
        }

    } catch (error) {
        console.error('Erro ao acessar câmera:', error);
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            updateStatus('Erro: Permissão de câmera negada. Permita o acesso nas configurações do navegador.');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            updateStatus('Erro: Nenhuma câmera encontrada. Verifique se há uma câmera conectada.');
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            updateStatus('Erro: Câmera já está em uso por outro aplicativo.');
        } else {
            updateStatus('Erro ao acessar câmera: ' + error.message);
        }
    }
}

// ----- Posição do rosto em relação ao guia -----
function areaDoRosto(det) {
    const b = det && (det.box || (det.detection && det.detection.box));
    return b ? b.width * b.height : 0;
}

function avaliarPosicao(det) {
    const b = det && (det.box || (det.detection && det.detection.box));
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!b || !vw || !vh) return { ok: true };

    const largura = b.width / vw;                 // tamanho do rosto na imagem
    const cx = (b.x + b.width / 2) / vw;          // centro horizontal (0 a 1)
    const cy = (b.y + b.height / 2) / vh;         // centro vertical (0 a 1)

    if (largura < 0.14) return { ok: false, msg: 'Aproxime-se um pouco da câmera' };
    if (largura > 0.42) return { ok: false, msg: 'Afaste-se um pouco da câmera' };
    if (cx < 0.35 || cx > 0.65 || cy < 0.28 || cy > 0.68) {
        return { ok: false, msg: 'Centralize o rosto na área marcada' };
    }
    return { ok: true };
}

// Iniciar detecção facial
function startFaceDetection() {
    // Evita intervalos duplicados (ex.: ao refazer a foto)
    if (faceDetectionInterval) clearInterval(faceDetectionInterval);

    let detectando = false; // evita análises sobrepostas

    faceDetectionInterval = setInterval(async () => {
        if (detectando) return;
        if (!video.srcObject || video.readyState < 2 || isCaptured) return;
        // Durante a contagem regressiva não mexe na mensagem de status
        if (countdownTimer.style.display === 'flex') return;

        detectando = true;
        try {
            const opcoesDeteccao = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
            const detections = await faceapi.detectAllFaces(video, opcoesDeteccao);

            if (isCaptured || countdownTimer.style.display === 'flex') return;

            if (detections.length > 0) {
                // Usa o maior rosto (o mais próximo da câmera)
                const rosto = detections.reduce((a, b) => areaDoRosto(b) > areaDoRosto(a) ? b : a);
                const pos = avaliarPosicao(rosto);
                faceBox.classList.add('active');
                faceBox.classList.toggle('ok', pos.ok);
                M('rosto', pos.ok ? 'ok' : 'ajustar');
                updateStatus(pos.ok
                    ? 'Perfeito! Clique em "Capturar"'
                    : pos.msg);
            } else {
                faceBox.classList.remove('active', 'ok');
                updateStatus('Posicione seu rosto na área marcada');
                M('rosto', 'nenhum');
            }
        } catch (error) {
            console.warn('Falha na detecção de rosto:', error);
        } finally {
            detectando = false;
        }
    }, 150);
}

// Capturar rosto (congela a foto)
function captureFace() {
    // Desabilitar botão durante a contagem
    captureFaceBtn.disabled = true;

    let countdown = TIMER_OPTIONS[selectedTimerIndex].seconds;
    updateStatus(`Capturando em ${countdown}...`);

    falarNumero(countdown);
    M('foto');
    M('conta', countdown);
    // Mostrar timer visual
    countdownTimer.style.display = 'flex';
    countdownNumber.textContent = countdown;
    tocarBip(660);

    captureTimer = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            updateStatus(`Capturando em ${countdown}...`);
            countdownNumber.textContent = countdown;
            tocarBip(countdown === 1 ? 880 : 660);
            falarNumero(countdown);
            M('conta', countdown);
        } else {
            clearInterval(captureTimer);
            countdownTimer.style.display = 'none';
            captureFaceBtn.disabled = false;
            performCapture();
        }
    }, 1000);
}

// ----- Flash e sons -----
let audioCtx = null;

function obterAudio() {
    try {
        if (!audioCtx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) audioCtx = new AC();
        }
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { /* sem áudio: segue sem som */ }
    return audioCtx;
}
// O navegador só libera o áudio depois de um toque/tecla: "prepara" no primeiro
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, obterAudio, { once: true, capture: true }));

function tocarBip(freq = 660, dur = 0.12) {
    if (!CONFIG_CAMERA.som) return;
    const ctx = obterAudio();
    if (!ctx) return;
    try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = ctx.currentTime;
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    } catch (e) { /* ignora */ }
}

function tocarObturador() {
    if (!CONFIG_CAMERA.som) return;
    const ctx = obterAudio();
    if (!ctx) return;
    try {
        // dois "cliques" curtos de ruído = som de obturador
        [0, 0.08].forEach(atraso => {
            const dur = 0.07;
            const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
            const dados = buffer.getChannelData(0);
            for (let i = 0; i < dados.length; i++) {
                dados[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / dados.length, 2);
            }
            const fonte = ctx.createBufferSource();
            const filtro = ctx.createBiquadFilter();
            const gain = ctx.createGain();
            filtro.type = 'highpass';
            filtro.frequency.value = 1200;
            gain.gain.value = 0.6;
            fonte.buffer = buffer;
            fonte.connect(filtro);
            filtro.connect(gain);
            gain.connect(ctx.destination);
            fonte.start(ctx.currentTime + atraso);
        });
    } catch (e) { /* ignora */ }
}

function dispararFlash() {
    tocarObturador();
    if (!CONFIG_CAMERA.flash || !flashEl) return;
    flashEl.classList.remove('go');
    void flashEl.offsetWidth; // reinicia a animação
    flashEl.classList.add('go');
}

// Executar a captura da foto
function performCapture() {
    const context = canvas.getContext('2d');
    // Corta ao centro na mesma proporção que aparece na tela (9:16 em Retrato, 4:3 em Paisagem)
    const proporcao = CONFIG_CAMERA.orientacao === 'portrait' ? 9 / 16 : 4 / 3;
    let corteLargura = Math.round(video.videoHeight * proporcao);
    let corteAltura = video.videoHeight;
    if (corteLargura > video.videoWidth) {
        corteLargura = video.videoWidth;
        corteAltura = Math.round(video.videoWidth / proporcao);
    }
    const corteX = Math.round((video.videoWidth - corteLargura) / 2);
    const corteY = Math.round((video.videoHeight - corteAltura) / 2);
    canvas.width = corteLargura;
    canvas.height = corteAltura;

    // Desenhar o frame atual no canvas (espelhado = igual ao que a pessoa viu na tela)
    if (CONFIG_CAMERA.espelharFoto) {
        context.save();
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(video, corteX, corteY, corteLargura, corteAltura, 0, 0, canvas.width, canvas.height);
        context.restore();
    } else {
        context.drawImage(video, corteX, corteY, corteLargura, corteAltura, 0, 0, canvas.width, canvas.height);
    }

    // Se o mascote está na câmera, ele sai na foto exatamente onde aparecia na tela
    mascoteFoto = M('naCamera') ? (M('retrato', canvas.width, canvas.height) || null) : null;
    mascotActive = !!mascoteFoto;
    if (mascotToggle) mascotToggle.checked = mascotActive;

    dispararFlash();
    M('flash');      // comemora e vai para o canto da tela

    // Converter para imagem (com qualidade otimizada para processamento mais rápido)
    capturedImageData = canvas.toDataURL('image/jpeg', 0.92);

    // Mostrar imagem capturada sobre o vídeo (o vídeo continua ativo para detecção de gestos)
    capturedPhoto.src = capturedImageData;
    capturedPhoto.style.display = 'block';

    // Aplicar filtros atuais
    applyFilters();

    // Atualizar estado
    isCaptured = true;
    Stats.captura();

    // Monta a foto (selo/data) e analisa o rosto para acessórios e perfil
    iniciarPosCaptura();

    // Avança para o passo 2 (moldura)
    setStep(2);

    // Parar detecção facial
    if (faceDetectionInterval) {
        clearInterval(faceDetectionInterval);
    }

    // NÃO parar o stream da câmera - precisamos dela para detectar gestos na etapa 2
    frameApplied = false;
    semMolduraEscolhida = false;

    updateStatus(
    'Foto capturada! Escolha uma moldura e, depois, toque em CONTINUAR.'
);

}

// Selecionar moldura
async function selectFrame(option) {
    frameOptions.forEach(opt => opt.classList.remove('selected'));

    option.classList.add('selected');
    selectedFrame = option.dataset.frame || '';
    // "Sem moldura": remove qualquer moldura e volta à foto original
    semMolduraEscolhida = !selectedFrame;

    // A moldura ainda está sendo processada.
    frameApplied = false;

    const nomeMoldura = option.querySelector('span').textContent;
    updateStatus(`Aplicando moldura "${nomeMoldura}"...`);

    const minhaVersao = renderToken + 1;
    const ok = await renderFinal();   // moldura + acessório + selo (frameApplied é ligado lá dentro)

    if (ok) {
        Stats.atualizar();
        M('moldura', !!selectedFrame);
        if (selectedFrame) {
            updateStatus(
                `Moldura "${nomeMoldura}" aplicada! Toque em CONTINUAR.`
            );
        } else {
            updateStatus(
                `Sem moldura! Sua foto voltou ao normal. Toque em CONTINUAR.`
            );
        }
    } else if (renderToken === minhaVersao) {
        // ninguém substituiu esta montagem: foi erro de verdade
        frameApplied = false;
        updateStatus('Erro ao aplicar moldura. Tente outra opção.');
    }
}

// Refazer foto
function retakePhoto() {
    Stats.refeita();
    // Cancelar timer de captura se estiver ativo
    if (captureTimer) {
        clearInterval(captureTimer);
        captureTimer = null;
        captureFaceBtn.disabled = false;
    }

    // Esconder timer visual
    countdownTimer.style.display = 'none';

    // Reiniciar estado
    isCaptured = false;
    capturedImageData = null;
    selectedFrame = null;
    semMolduraEscolhida = false;
    frameApplied = false;

    limparPosCaptura();
    mascoteFoto = null; mascotActive = false; if (mascotToggle) mascotToggle.checked = false;
    // Resetar filtros
    resetFilters();
    // Resetar valores de recorte
    recorteValues = { featherRadius: 2, edgeSensitivity: 0.3 };
    if (featherRadiusInput) featherRadiusInput.value = 2;
    if (featherValueDisplay) featherValueDisplay.textContent = '2';
    if (edgeSensitivityInput) edgeSensitivityInput.value = 30;
    if (edgeValueDisplay) edgeValueDisplay.textContent = '30%';

    setStep(1);

    // Esconder foto e mostrar vídeo (câmera continua ativa)
    capturedPhoto.style.display = 'none';

    // Remover seleção de molduras
    frameOptions.forEach(opt => opt.classList.remove('selected'));

    // Esconder instruções
    sendInstructions.style.display = 'none';

    // Reiniciar detecção facial
    if (isModelLoaded) {
        startFaceDetection();
        updateStatus('Câmera ativa. Posicione o rosto no centro.');
    } else {
        faceBox.classList.add('active');
        updateStatus('Câmera ativa. Posicione o rosto no centro.');
    }
}

// Mostrar QR Code para download
async function showWhatsAppModal() {
    Stats.atualizar();
    setStep(3);
    updateStatus('Gerando QR Code para download...');

    try {
        // Usar a imagem atual que já tem a moldura aplicada
        let finalImageData = capturedPhoto.src;

        if (filterValues.brightness !== 100 || filterValues.contrast !== 100 || filterValues.saturation !== 100) {
            finalImageData = await applyFiltersToImage(capturedPhoto.src);
        }

        // Salvar a foto localmente
        saveImageLocally(finalImageData);

        // Fazer upload da imagem para ImgBB
        updateStatus('Fazendo upload da imagem...');
        let imageUrl = await uploadToImgBB(finalImageData);
        console.log('Imagem enviada para:', imageUrl);

        if (!imageUrl) {
            throw new Error('Upload falhou');
        }

        updateStatus('Gerando QR Code...');

        // Exibir a foto final
        finalPhoto.src = imageUrl;

        // Gerar QR Code para o link direto da imagem
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(imageUrl)}`;
        downloadQrCode.src = qrCodeUrl;

        updateStatus('QR Code pronto! Escaneie com seu celular.');
        Stats.concluir('download');

    } catch (error) {
        console.error('Erro ao preparar download:', error);
        Stats.erro();
        updateStatus('Erro ao preparar download. Tente novamente.');
        setStep(2);
    }
}

// Salvar imagem localmente (download automático)
function saveImageLocally(base64Image) {
    try {
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `foto-senai-${timestamp}.jpg`;
        link.href = base64Image;
        // Também guarda uma cópia na pasta do dashboard (C:\xampp\htdocs\mgsenai dashboard\Imagens)
        salvarNaPastaDashboard(base64Image, link.download);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log('Imagem salva localmente:', link.download);
    } catch (error) {
        console.error('Erro ao salvar imagem localmente:', error);
    }
}

// Esconder modal de download e voltar para moldura
function hideWhatsAppModal() {
    setStep(2);
    updateStatus('Escolha uma moldura ou toque em "Continuar"');
}

// Fazer upload da imagem para ImgBB
async function uploadToImgBB(base64Image) {
    // Remover o prefixo data:image/jpeg;base64, se existir
    const base64Data = base64Image.replace(/^data:image\/(jpeg|jpg|png);base64,/, '');

    const formData = new FormData();
    formData.append('image', base64Data);

    try {
        const response = await fetch('https://api.imgbb.com/1/upload?key=b83db2cb4f51c389a6c34943d37a2c12', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            if (response.status === 413) {
                throw new Error('Imagem muito grande. Tente uma foto menor.');
            } else if (response.status === 429) {
                throw new Error('Muitos uploads. Tente novamente em alguns minutos.');
            } else if (response.status === 401) {
                throw new Error('Erro de autenticação no serviço de upload.');
            } else {
                throw new Error(`Erro no upload (${response.status}). Tente novamente.`);
            }
        }

        const data = await response.json();

        if (data.success && data.data && data.data.url) {
            return data.data.url;
        } else {
            throw new Error('Resposta inválida do serviço de upload.');
        }
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Erro de conexão. Verifique sua internet.');
        }
        throw error;
    }
}

// Desenha a moldura preenchendo toda a área (sem distorcer)
function desenharMolduraCobrindo(ctx, frameImg, w, h) {
    const escala = Math.max(w / frameImg.width, h / frameImg.height);
    const fw = frameImg.width * escala, fh = frameImg.height * escala;
    ctx.drawImage(frameImg, (w - fw) / 2, (h - fh) / 2, fw, fh);
}

// Espera uma promessa por no máximo "ms" milissegundos; se estourar, rejeita (a foto nunca fica travada)
function comTempoLimite(promessa, ms, nome) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error((nome || 'operação') + ' demorou demais')), ms);
        promessa.then(v => { clearTimeout(t); resolve(v); },
                      e => { clearTimeout(t); reject(e); });
    });
}

// Remove da máscara (canal alfa) as pessoas ao fundo e pedaços soltos.
// rostos: caixas de rosto ordenadas da maior para a menor (a 1ª é a pessoa principal).
function removerTerceiros(px, w, h, rostos) {
    const principal = rostos[0];

    // 1) Apaga quem tem rosto bem menor que o da pessoa principal (está atrás)
    if (principal) {
        const mcx = principal.x + principal.w / 2;
        const protegido = (x, y) => {
            // cabeça da principal
            if (x >= principal.x - 0.3 * principal.w && x <= principal.x + 1.3 * principal.w &&
                y >= principal.y - 0.6 * principal.h && y <= principal.y + 1.3 * principal.h) return true;
            // corpo da principal (abaixo do queixo)
            return y >= principal.y + principal.h &&
                   x >= mcx - 1.25 * principal.w && x <= mcx + 1.25 * principal.w;
        };
        rostos.slice(1).forEach(f => {
            if (f.w >= principal.w * 0.7) return;           // tamanho parecido: é um acompanhante, mantém
            const cx = f.x + f.w / 2;
            const x0 = Math.max(0, Math.floor(cx - 1.6 * f.w));
            const x1 = Math.min(w - 1, Math.ceil(cx + 1.6 * f.w));
            const y0 = Math.max(0, Math.floor(f.y - 0.7 * f.h));
            for (let y = y0; y < h; y++) {
                for (let x = x0; x <= x1; x++) {
                    if (!protegido(x, y)) px[(y * w + x) * 4 + 3] = 0;
                }
            }
        });
    }

    // 2) Mantém só a maior mancha (e pedaços grandes perto da pessoa principal, como mãos e braços)
    const rotulo = new Int32Array(w * h);
    const manchas = [];
    const pilha = new Int32Array(w * h);
    for (let i = 0; i < w * h; i++) {
        if (px[i * 4 + 3] === 0 || rotulo[i]) continue;
        const id = manchas.length + 1;
        let topo = 0, area = 0, somaX = 0;
        pilha[topo++] = i; rotulo[i] = id;
        while (topo) {
            const p = pilha[--topo];
            area++; somaX += p % w;
            const x = p % w, y = (p / w) | 0;
            if (x > 0     && px[(p - 1) * 4 + 3] && !rotulo[p - 1]) { rotulo[p - 1] = id; pilha[topo++] = p - 1; }
            if (x < w - 1 && px[(p + 1) * 4 + 3] && !rotulo[p + 1]) { rotulo[p + 1] = id; pilha[topo++] = p + 1; }
            if (y > 0     && px[(p - w) * 4 + 3] && !rotulo[p - w]) { rotulo[p - w] = id; pilha[topo++] = p - w; }
            if (y < h - 1 && px[(p + w) * 4 + 3] && !rotulo[p + w]) { rotulo[p + w] = id; pilha[topo++] = p + w; }
        }
        manchas.push({ id, area, cx: somaX / area });
    }
    if (!manchas.length) return;
    const maior = manchas.reduce((m, c) => c.area > m.area ? c : m);
    const centroPrincipal = principal ? principal.x + principal.w / 2 : maior.cx;
    const larguraRef = principal ? principal.w : w * 0.2;
    const manter = new Set([maior.id]);
    manchas.forEach(m => {
        if (m.area >= maior.area * 0.03 && Math.abs(m.cx - centroPrincipal) <= 2.2 * larguraRef) manter.add(m.id);
    });
    for (let i = 0; i < w * h; i++) {
        if (rotulo[i] && !manter.has(rotulo[i])) px[i * 4 + 3] = 0;
    }
}

// ----- Refinamento do recorte da pessoa -----
// O BodyPix entrega um contorno "quadriculado" e que sobra para fora do corpo (halo do fundo).
// Aqui o contorno é alisado e encaixado nas bordas reais da foto (filtro guiado). Cores parecidas
// com o fundo NÃO são cortadas: só some o que é praticamente igual ao fundo vizinho.

// ===== MELHORIAS PARA RECORTES (VERSÃO SIMPLIFICADA E ESTÁVEL) =====
// As funções avançadas foram comentadas temporariamente para garantir estabilidade
// O sistema usa o filtro guiado original que já funcionava bem

// Pipeline simplificado de refinamento - usa apenas o filtro guiado original
function refinarMascaraCompleta(rgba, mascara, w, h) {
    return refinarMascaraPessoa(rgba, mascara, w, h);
}

// ===== FIM DAS MELHORIAS =====

function desfoqueCaixa(src, w, h, r) {
    if (r < 1) return Float32Array.from(src);
    const d = 2 * r + 1, tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
        const o = y * w; let soma = 0;
        for (let k = -r; k <= r; k++) soma += src[o + Math.min(w - 1, Math.max(0, k))];
        for (let x = 0; x < w; x++) {
            tmp[o + x] = soma / d;
            soma += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)];
        }
    }
    const acc = new Float32Array(w);
    for (let k = -r; k <= r; k++) {
        const o = Math.min(h - 1, Math.max(0, k)) * w;
        for (let x = 0; x < w; x++) acc[x] += tmp[o + x];
    }
    for (let y = 0; y < h; y++) {
        const o = y * w, oAdd = Math.min(h - 1, y + r + 1) * w, oSub = Math.max(0, y - r) * w;
        for (let x = 0; x < w; x++) {
            out[o + x] = acc[x] / d;
            acc[x] += tmp[oAdd + x] - tmp[oSub + x];
        }
    }
    return out;
}

function passoSuave(a, b, v) {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
}

// Filtro guiado (He et al.): alisa o contorno "quadriculado" da máscara e o encaixa nas bordas reais da foto.
// Onde as cores são parecidas (camisa cinza x parede cinza) não há borda para seguir, então a máscara
// do BodyPix é respeitada e nada é cortado por engano.
function filtroGuiadoMascara(rgba, mascara, w, h, rFrac, eps, lo, hi) {
    const n = w * h, lado = Math.min(w, h);
    const I = new Float32Array(n), p = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const j = i * 4;
        I[i] = (0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2]) / 255;
        p[i] = mascara[i] ? 1 : 0;
    }
    const r = Math.max(2, Math.round(lado * rFrac));
    const mI = desfoqueCaixa(I, w, h, r), mp = desfoqueCaixa(p, w, h, r);
    const II = new Float32Array(n), Ip = new Float32Array(n);
    for (let i = 0; i < n; i++) { II[i] = I[i] * I[i]; Ip[i] = I[i] * p[i]; }
    const mII = desfoqueCaixa(II, w, h, r), mIp = desfoqueCaixa(Ip, w, h, r);
    const a = new Float32Array(n), b = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const v = mII[i] - mI[i] * mI[i], c = mIp[i] - mI[i] * mp[i];
        a[i] = c / (v + eps);
        b[i] = mp[i] - a[i] * mI[i];
    }
    const ma = desfoqueCaixa(a, w, h, r), mb = desfoqueCaixa(b, w, h, r);
    const out = new Uint8ClampedArray(n);
    for (let i = 0; i < n; i++) out[i] = Math.round(passoSuave(lo, hi, ma[i] * I[i] + mb[i]) * 255);
    return out;
}

// rgba: pixels da foto | mascara: 1 (ou 255) onde o BodyPix achou a pessoa | devolve o alfa (0 a 255) refinado
function refinarMascaraPessoa(rgba, mascara, w, h) {
    const n = w * h, lado = Math.min(w, h);

    // 1) duas passadas do filtro guiado: a 1ª tira o "quadriculado" e o excesso para fora do corpo,
    //    a 2ª afina a borda sobre o contorno real
    const p1 = filtroGuiadoMascara(rgba, mascara, w, h, 0.025, 0.001, 0.4, 0.6);
    const bin = new Uint8Array(n);
    for (let i = 0; i < n; i++) bin[i] = p1[i] > 127 ? 1 : 0;
    const alfa = filtroGuiadoMascara(rgba, bin, w, h, 0.012, 0.0005, 0.45, 0.58);

    // 2) limpeza por cor, MUITO conservadora: só some o que é praticamente idêntico ao fundo vizinho
    //    (ex.: pedaço de lousa entre o braço e o corpo). Cores só "parecidas" são mantidas.
    const f = new Float32Array(n);
    for (let i = 0; i < n; i++) f[i] = alfa[i] / 255;
    const rbh = Math.max(3, Math.round(lado * 0.012));
    const mb = desfoqueCaixa(desfoqueCaixa(f, w, h, rbh), w, h, rbh);
    const peso = new Float32Array(n), cR = new Float32Array(n), cG = new Float32Array(n), cB = new Float32Array(n);
    let gN = 0;
    for (let i = 0; i < n; i++) {
        if (mb[i] < 0.01) { peso[i] = 1; const j = i * 4; cR[i] = rgba[j]; cG[i] = rgba[j + 1]; cB[i] = rgba[j + 2]; gN++; }
    }
    if (!gN) return alfa;                                    // sem fundo visível para comparar
    const Rg = Math.max(8, rbh * 3);
    const dd = desfoqueCaixa(desfoqueCaixa(peso, w, h, Rg), w, h, Rg);
    const fR = desfoqueCaixa(desfoqueCaixa(cR, w, h, Rg), w, h, Rg);
    const fG = desfoqueCaixa(desfoqueCaixa(cG, w, h, Rg), w, h, Rg);
    const fB = desfoqueCaixa(desfoqueCaixa(cB, w, h, Rg), w, h, Rg);
    const out = new Uint8ClampedArray(alfa);
    for (let i = 0; i < n; i++) {
        if (!alfa[i] || mb[i] >= 0.97 || dd[i] < 0.002) continue;   // só perto da borda e com fundo conhecido
        const j = i * 4, den = dd[i];
        const dr = rgba[j] - fR[i] / den, dg = rgba[j + 1] - fG[i] / den, db = rgba[j + 2] - fB[i] / den;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
        out[i] = Math.round(alfa[i] * passoSuave(8, 20, dist));
    }
    return out;
}

// Gera o canvas de máscara refinada (alfa) a partir da foto original e da máscara do BodyPix (alfa em maskData RGBA)
// Usa o pipeline simplificado e estável
function mascaraRefinadaCanvas(originalImg, maskRGBA, w, h) {
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    tctx.drawImage(originalImg, 0, 0, w, h);
    const rgba = tctx.getImageData(0, 0, w, h).data;
    const bin = new Uint8Array(w * h);
    for (let i = 0; i < bin.length; i++) bin[i] = maskRGBA[i * 4 + 3] > 127 ? 1 : 0;
    // Usa o pipeline simplificado
    const alfa = refinarMascaraCompleta(rgba, bin, w, h);
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const octx = out.getContext('2d');
    const img = octx.createImageData(w, h);
    for (let i = 0; i < alfa.length; i++) img.data[i * 4 + 3] = alfa[i];
    octx.putImageData(img, 0, 0);
    return out;
}

// ===== Segmentação precisa de TODAS as pessoas (MediaPipe "selfie multiclasse") =====
// Diferente do BodyPix, este modelo separa cabelo, pele, rosto e ROUPA do resto da cena. Cadeira, mochila, mesa,
// monitor e parede ficam como "fundo", então não entram na foto. Se não carregar, o BodyPix continua como reserva.
const SEG_VERSAO = '0.10.14';
const SEG_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${SEG_VERSAO}`;
// Para rodar 100% local: baixe este arquivo para a pasta do projeto e troque pelo caminho, ex.: 'modelos/selfie_multiclass_256x256.tflite'
const SEG_MODELO = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite';
let segmentadorPromessa = null;

function obterSegmentador() {
    if (!segmentadorPromessa) {
        segmentadorPromessa = (async () => {
            const vision = await import(`${SEG_CDN}/vision_bundle.mjs`);
            const arquivos = await vision.FilesetResolver.forVisionTasks(`${SEG_CDN}/wasm`);
            const criar = (delegate) => vision.ImageSegmenter.createFromOptions(arquivos, {
                baseOptions: { modelAssetPath: SEG_MODELO, delegate },
                runningMode: 'IMAGE',
                outputConfidenceMasks: true,
                outputCategoryMask: false
            });
            try { return await criar('GPU'); } catch (e) { return await criar('CPU'); }
        })().catch((e) => { segmentadorPromessa = null; throw e; });
    }
    return segmentadorPromessa;
}

// Probabilidade de "ser pessoa" (0 a 1) de um trecho da foto, já no tamanho do trecho
function probabilidadePessoa(seg, canvasTrecho) {
    const r = seg.segment(canvasTrecho);
    const masks = r.confidenceMasks || [];
    if (!masks.length) throw new Error('Segmentador sem máscaras');
    const mw = masks[0].width, mh = masks[0].height;
    const arr = masks.map((m) => Float32Array.from(m.getAsFloat32Array()));
    const pc = new Float32Array(mw * mh);
    if (arr.length >= 5) {
        // classes: 0 fundo | 1 cabelo | 2 pele do corpo | 3 pele do rosto | 4 roupa | 5 outros (óculos, boné...)
        for (let i = 0; i < pc.length; i++) {
            pc[i] = Math.min(1, arr[1][i] + arr[2][i] + arr[3][i] + arr[4][i] + 0.4 * (arr[5] ? arr[5][i] : 0));
        }
    } else {
        for (let i = 0; i < pc.length; i++) pc[i] = 1 - arr[0][i];
    }
    masks.forEach((m) => { try { m.close(); } catch (e) { /* ok */ } });
    try { if (r.close) r.close(); } catch (e) { /* ok */ }
    // amostragem bilinear para o tamanho do trecho (contorno liso, sem degraus)
    const cw = canvasTrecho.width, ch = canvasTrecho.height;
    if (mw === cw && mh === ch) return pc;
    const out = new Float32Array(cw * ch);
    for (let y = 0; y < ch; y++) {
        const sy = Math.min(mh - 1, Math.max(0, (y + 0.5) * mh / ch - 0.5)), y0 = Math.floor(sy), y1 = Math.min(mh - 1, y0 + 1), fy = sy - y0;
        for (let x = 0; x < cw; x++) {
            const sx = Math.min(mw - 1, Math.max(0, (x + 0.5) * mw / cw - 0.5)), x0 = Math.floor(sx), x1 = Math.min(mw - 1, x0 + 1), fx = sx - x0;
            const a = pc[y0 * mw + x0] * (1 - fx) + pc[y0 * mw + x1] * fx;
            const b = pc[y1 * mw + x0] * (1 - fx) + pc[y1 * mw + x1] * fx;
            out[y * cw + x] = a * (1 - fy) + b * fy;
        }
    }
    return out;
}

// Fecha pequenas reentrâncias no contorno (dilata e erode com a mesma largura); só acrescenta, nunca tira
function fecharMascara(bin, w, h, r) {
    const n = w * h, f = new Float32Array(n);
    for (let i = 0; i < n; i++) f[i] = bin[i] ? 1 : 0;
    const dil = desfoqueCaixa(f, w, h, r), d = new Float32Array(n);
    for (let i = 0; i < n; i++) d[i] = dil[i] > 0.02 ? 1 : 0;
    const ero = desfoqueCaixa(d, w, h, r), out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = (bin[i] || ero[i] > 0.98) ? 1 : 0;
    return out;
}

// Preenche buracos pequenos dentro da pessoa (ex.: aro dos óculos); não mexe no espaço entre braço e corpo se for grande
function preencherBuracos(bin, w, h, fracMax) {
    const n = w * h, visto = new Uint8Array(n), pilha = new Int32Array(n);
    let topo = 0;
    const entra = (i) => { if (!bin[i] && !visto[i]) { visto[i] = 1; pilha[topo++] = i; } };
    for (let x = 0; x < w; x++) { entra(x); entra((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { entra(y * w); entra(y * w + w - 1); }
    while (topo) {
        const p = pilha[--topo], x = p % w;
        if (x > 0) entra(p - 1);
        if (x < w - 1) entra(p + 1);
        if (p >= w) entra(p - w);
        if (p < n - w) entra(p + w);
    }
    const rot = new Int32Array(n), out = Uint8Array.from(bin), limite = n * fracMax;
    for (let i = 0; i < n; i++) {
        if (bin[i] || visto[i] || rot[i]) continue;
        const lista = []; topo = 0; pilha[topo++] = i; rot[i] = 1;
        while (topo) {
            const p = pilha[--topo]; lista.push(p);
            const x = p % w;
            if (x > 0 && !bin[p - 1] && !rot[p - 1]) { rot[p - 1] = 1; pilha[topo++] = p - 1; }
            if (x < w - 1 && !bin[p + 1] && !rot[p + 1]) { rot[p + 1] = 1; pilha[topo++] = p + 1; }
            if (p >= w && !bin[p - w] && !rot[p - w]) { rot[p - w] = 1; pilha[topo++] = p - w; }
            if (p < n - w && !bin[p + w] && !rot[p + w]) { rot[p + w] = 1; pilha[topo++] = p + w; }
        }
        if (lista.length <= limite) for (const p of lista) out[p] = 1;
    }
    return out;
}

// Recorta TODAS as pessoas da foto (canvas com fundo transparente). Lança erro se o segmentador não estiver disponível.
async function recorteComSegmentador(originalImg) {
    const w = originalImg.width, h = originalImg.height, n = w * h;
    const seg = await comTempoLimite(obterSegmentador(), 25000, 'Carregando segmentador');
    // A foto inteira + duas metades que se sobrepõem: pessoas pequenas ou nas laterais também são reconhecidas
    const trechos = [[0, 0, 1, 1, 1], [0, 0, 0.6, 1, 0.9], [0.4, 0, 0.6, 1, 0.9]];   // x, y, largura, altura (frações) e peso
    const p = new Float32Array(n);
    for (const [fx, fy, fw, fh, peso] of trechos) {
        const cx = Math.round(fx * w), cy = Math.round(fy * h), cw = Math.max(8, Math.round(fw * w)), ch = Math.max(8, Math.round(fh * h));
        const c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        c.getContext('2d').drawImage(originalImg, cx, cy, cw, ch, 0, 0, cw, ch);
        const pc = probabilidadePessoa(seg, c);
        for (let y = 0; y < ch; y++) {
            const o = (cy + y) * w + cx, oc = y * cw;
            for (let x = 0; x < cw && cx + x < w; x++) {
                const v = pc[oc + x] * peso;
                if (v > p[o + x]) p[o + x] = v;
            }
        }
    }
    let bin = new Uint8Array(n);
    for (let i = 0; i < n; i++) bin[i] = p[i] > 0.5 ? 1 : 0;

    // Tira manchas pequenas soltas (lixo da segmentação) e mantém TODAS as pessoas de tamanho real
    const { rotulo, manchas } = manchasDaMascara(bin, w, h);
    const minArea = Math.max(150, n * 0.0008);
    const ok = new Set(manchas.filter((m) => m.area >= minArea).map((m) => m.id));
    for (let i = 0; i < n; i++) if (bin[i] && !ok.has(rotulo[i])) bin[i] = 0;
    console.log('Pessoas/manchas mantidas:', ok.size);
    if (!ok.size) throw new Error('Nenhuma pessoa detectada pelo segmentador');

    bin = fecharMascara(bin, w, h, Math.max(2, Math.round(Math.min(w, h) * 0.006)));
    bin = preencherBuracos(bin, w, h, 0.003);

    // Contorno nítido: o modelo trabalha em baixa resolução, então o contorno é encaixado nas bordas reais da foto
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    tctx.drawImage(originalImg, 0, 0, w, h);
    const rgba = tctx.getImageData(0, 0, w, h).data;
    const p1 = filtroGuiadoMascara(rgba, bin, w, h, 0.02, 0.001, 0.42, 0.58);
    const bin2 = new Uint8Array(n);
    for (let i = 0; i < n; i++) bin2[i] = p1[i] > 127 ? 1 : 0;
    const alfa = filtroGuiadoMascara(rgba, bin2, w, h, 0.008, 0.0005, 0.47, 0.55);   // faixa estreita = borda firme, sem desfoque

    const mc = document.createElement('canvas');
    mc.width = w; mc.height = h;
    const mctx = mc.getContext('2d');
    const mi = mctx.createImageData(w, h);
    for (let i = 0; i < n; i++) mi.data[i * 4 + 3] = alfa[i];
    mctx.putImageData(mi, 0, 0);

    const pessoa = document.createElement('canvas');
    pessoa.width = w; pessoa.height = h;
    const pctx = pessoa.getContext('2d');
    pctx.drawImage(originalImg, 0, 0);
    pctx.globalCompositeOperation = 'destination-in';
    pctx.drawImage(mc, 0, 0);
    return pessoa;
}

// Aplicar moldura como fundo com remoção de fundo original, com borda nítida
async function gerarRecortePessoa(base64Image) {
    // 1ª opção: segmentador preciso (todas as pessoas, sem objetos). Se falhar, segue para o BodyPix abaixo.
    try {
        return await recorteComSegmentador(normalizarFoto(await carregarImagem(base64Image)));
    } catch (e) {
        console.warn('Segmentador preciso indisponível, usando BodyPix:', e);
    }

    if (!bodyPixModel) {
        console.log('BodyPix não carregado, usando recorte simples');
        return recorteSimples(await carregarImagem(base64Image));
    }

    try {
        const originalImg = normalizarFoto(await carregarImagem(base64Image));   // exposição/contraste/nitidez antes do recorte
        const w = originalImg.width, h = originalImg.height;

        // Separa as pessoas da imagem e mantém SÓ a principal (a maior e mais central),
        // para que quem está ao fundo não apareça na foto com a moldura.
        const opcoesSeg = {
            flipHorizontal: false,
            internalResolution: 'high',      // contorno mais preciso; se o computador ficar lento, volte para 'medium'
            segmentationThreshold: 0.5       // mais inclusivo: não perde braços finos
        };
        let dados = null;
        try {
            const pessoas = await comTempoLimite(bodyPixModel.segmentMultiPerson(originalImg, {
                ...opcoesSeg,
                maxDetections: 5,
                scoreThreshold: 0.15,  // detecta também pessoas pequenas/parcialmente escondidas ao fundo
                nmsRadius: 20
            }), 8000, 'Separação das pessoas');
            if (pessoas && pessoas.length) {
                // MUDANÇA: UNIR todas as pessoas detectadas, não selecionar apenas a principal
                const uniao = new Uint8Array(w * h);
                pessoas.forEach((pessoa) => {
                    const d = pessoa.data;
                    for (let i = 0; i < d.length; i++) if (d[i] === 1) uniao[i] = 1;
                });
                dados = uniao;
                console.log(`Unindo ${pessoas.length} pessoas detectadas`);
            }
        } catch (e) {
            console.warn('Segmentação por pessoa indisponível, usando a geral:', e);
        }
        if (!dados) {
            const seg = await comTempoLimite(bodyPixModel.segmentPerson(originalImg, { ...opcoesSeg, maxDetections: 1 }), 10000, 'Recorte da pessoa');
            dados = seg.data;
        }

        // Máscara (alfa) da pessoa principal
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = w;
        maskCanvas.height = h;
        const maskCtx = maskCanvas.getContext('2d');
        const maskImg = maskCtx.createImageData(w, h);
        for (let i = 0; i < dados.length; i++) {
            if (dados[i] === 1) maskImg.data[i * 4 + 3] = 255;
        }
        // Rostos da foto: mantém TODAS as pessoas detectadas (não remove terceiros)
        // Comentado para permitir que múltiplas pessoas apareçam na foto
        // let rostosCaixa = [];
        // if (isModelLoaded && typeof faceapi !== 'undefined') {
        //     try {
        //         const dets = await comTempoLimite(faceapi.detectAllFaces(
        //             originalImg,
        //             new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 })
        //         ), 4000, 'Detecção de rostos');
        //         rostosCaixa = dets
        //             .map(d => ({ x: d.box.x, y: d.box.y, w: d.box.width, h: d.box.height }))
        //             .sort((p, q) => q.w * q.h - p.w * p.h);
        //     } catch (e) { /* segue só com a segmentação */ }
        // }
        // removerTerceiros(maskImg.data, w, h, rostosCaixa);  // DESABILITADO - mantém todas as pessoas
        maskCtx.putImageData(maskImg, 0, 0);

        // Alisa o contorno e decide a borda pela cor do fundo (sem halo da lousa)
        const suave = mascaraRefinadaCanvas(originalImg, maskImg.data, w, h);

        // Pessoa recortada pela máscara suave (SEM clip elíptico - usa o recorte real do BodyPix)
        const pessoa = document.createElement('canvas');
        pessoa.width = w;
        pessoa.height = h;
        const pessoaCtx = pessoa.getContext('2d');
        pessoaCtx.drawImage(originalImg, 0, 0);
        pessoaCtx.globalCompositeOperation = 'destination-in';
        pessoaCtx.drawImage(suave, 0, 0);

        return pessoa;   // canvas com a pessoa recortada (fundo transparente)
    } catch (error) {
        console.error('Erro no processamento BodyPix:', error);
        return recorteSimples(await carregarImagem(base64Image));
    }
}

// Recorte com lousa: detecta as duas faixas amarelas e mantém apenas o que está entre elas
async function gerarRecorteLousa(base64Image) {
    if (!bodyPixModel) {
        console.log('BodyPix não carregado, usando recorte simples');
        return recorteSimples(await carregarImagem(base64Image));
    }

    try {
        const originalImg = normalizarFoto(await carregarImagem(base64Image));   // exposição/contraste/nitidez antes do recorte
        const w = originalImg.width, h = originalImg.height;

        // Detectar a área entre as faixas amarelas
        const lousaArea = detectarAreaEntreFaixasAmarelas(originalImg);

        if (!lousaArea) {
            // Menos de duas faixas visíveis (ex.: Retrato, pessoa fora da lousa): não dá para limitar pela lousa,
            // então recorta só a pessoa do fundo, sem cortar um retângulo fixo no meio da cena
            console.warn('Duas faixas amarelas não detectadas: recortando só a pessoa');
            return gerarRecortePessoa(base64Image);
        }

        console.log('Área entre as faixas amarelas detectada:', lousaArea);

        // 1ª opção: segmentador preciso (todas as pessoas, sem objetos) limitado à área entre as faixas
        try {
            const todas = await recorteComSegmentador(originalImg);
            const recortada = document.createElement('canvas');
            recortada.width = w; recortada.height = h;
            const rctx = recortada.getContext('2d');
            rctx.beginPath();
            rctx.rect(lousaArea.x, lousaArea.y, lousaArea.width, lousaArea.height);
            rctx.clip();
            rctx.drawImage(todas, 0, 0);
            return recortada;
        } catch (e) {
            console.warn('Segmentador preciso indisponível (lousa), usando BodyPix:', e);
        }

        // Segmentar todas as pessoas
        const opcoesSeg = {
            flipHorizontal: false,
            internalResolution: 'high',
            segmentationThreshold: 0.5
        };

        let pessoas = [];
        try {
            const segmentacao = await comTempoLimite(bodyPixModel.segmentMultiPerson(originalImg, {
                ...opcoesSeg,
                maxDetections: 5,
                scoreThreshold: 0.15,
                nmsRadius: 20
            }), 8000, 'Separação das pessoas (lousa)');
            if (segmentacao && segmentacao.length) {
                pessoas = segmentacao;
            }
        } catch (e) {
            console.warn('Segmentação por pessoa indisponível, usando a geral:', e);
        }

        if (!pessoas.length) {
            const seg = await comTempoLimite(bodyPixModel.segmentPerson(originalImg, { ...opcoesSeg, maxDetections: 1 }), 10000, 'Recorte da pessoa (lousa)');
            pessoas = [seg];
        }

        // Para cada pessoa, verificar se está dentro da área
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = w;
        maskCanvas.height = h;
        const maskCtx = maskCanvas.getContext('2d');
        const maskImg = maskCtx.createImageData(w, h);

        // Junta tudo o que o BodyPix achou e mantém TODAS as pessoas (não filtra por lousa)
        // MUDANÇA: agora mantém todas as manchas detectadas, não apenas as dentro da área
        const uniao = new Uint8Array(w * h);
        pessoas.forEach((pessoa) => {
            const dados = pessoa.data;
            for (let i = 0; i < dados.length; i++) if (dados[i] === 1) uniao[i] = 1;
        });
        const { rotulo, manchas } = manchasDaMascara(uniao, w, h);
        const minArea = Math.max(200, w * h * 0.0005);

        // MUDANÇA: mantém TODAS as manchas grandes o suficiente (sem filtro de localização)
        // Isso permite que múltiplas pessoas apareçam na foto
        let manter = manchas.filter((m) => m.area >= minArea);

        console.log('Manchas:', manchas.map((m) => `${Math.round(m.cx)},${Math.round(m.cy)} (${m.area}px)`).join(' | '), '→ mantidas:', manter.length);
        if (!manter.length) {
            console.warn('Nenhuma pessoa detectada: recortando a pessoa principal');
            return gerarRecortePessoa(base64Image);
        }
        const ids = new Set(manter.map((m) => m.id));
        for (let i = 0; i < rotulo.length; i++) if (rotulo[i] && ids.has(rotulo[i])) maskImg.data[i * 4 + 3] = 255;

        maskCtx.putImageData(maskImg, 0, 0);

        // Alisa o contorno e decide a borda pela cor do fundo (sem halo da lousa)
        const suave = mascaraRefinadaCanvas(originalImg, maskImg.data, w, h);

        // Criar canvas final com clip da área entre as faixas amarelas
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = w;
        finalCanvas.height = h;
        const finalCtx = finalCanvas.getContext('2d');

        // Clip para a área entre as faixas amarelas - TUDO fora será removido
        finalCtx.save();
        finalCtx.beginPath();
        finalCtx.rect(lousaArea.x, lousaArea.y, lousaArea.width, lousaArea.height);
        finalCtx.clip();

        // Desenhar imagem original
        finalCtx.drawImage(originalImg, 0, 0);

        // Aplicar máscara de segmentação para remover fundo das pessoas dentro da área
        finalCtx.globalCompositeOperation = 'destination-in';
        finalCtx.drawImage(suave, 0, 0);
        finalCtx.globalCompositeOperation = 'source-over';
        finalCtx.restore();

        return finalCanvas; // canvas com apenas a área entre as faixas amarelas e as pessoas dentro dela
    } catch (error) {
        console.error('Erro no processamento com lousa:', error);
        return recorteSimples(await carregarImagem(base64Image));
    }
}

// Separa a máscara em manchas conexas (cada uma com área, centro e largura)
function manchasDaMascara(bin, w, h) {
    const rotulo = new Int32Array(w * h), manchas = [], pilha = new Int32Array(w * h);
    let id = 0;
    for (let i = 0; i < bin.length; i++) {
        if (!bin[i] || rotulo[i]) continue;
        id++;
        let topo = 0, area = 0, sx = 0, sy = 0, x0 = w, x1 = 0;
        pilha[topo++] = i; rotulo[i] = id;
        while (topo) {
            const p = pilha[--topo], x = p % w, y = (p - x) / w;
            area++; sx += x; sy += y;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (x > 0     && bin[p - 1] && !rotulo[p - 1]) { rotulo[p - 1] = id; pilha[topo++] = p - 1; }
            if (x < w - 1 && bin[p + 1] && !rotulo[p + 1]) { rotulo[p + 1] = id; pilha[topo++] = p + 1; }
            if (y > 0     && bin[p - w] && !rotulo[p - w]) { rotulo[p - w] = id; pilha[topo++] = p - w; }
            if (y < h - 1 && bin[p + w] && !rotulo[p + w]) { rotulo[p + w] = id; pilha[topo++] = p + w; }
        }
        manchas.push({ id, area, cx: sx / area, cy: sy / area, x0, x1 });
    }
    return { rotulo, manchas };
}

// Calcular centro de uma pessoa na máscara de segmentação
function calcularCentroPessoa(dados, width) {
    let somaX = 0, somaY = 0, count = 0;
    for (let i = 0; i < dados.length; i++) {
        if (dados[i] === 1) {
            const x = i % width;
            const y = Math.floor(i / width);
            somaX += x;
            somaY += y;
            count++;
        }
    }
    if (count === 0) return null;
    return { x: somaX / count, y: somaY / count };
}

// Detectar as duas faixas amarelas da lousa e devolver a área ENTRE elas (tudo fora será removido)
// Função pura (só números), para ficar fácil de testar: data = RGBA, w/h = tamanho da imagem
function acharAreaEntreFaixasAmarelas(data, w, h) {
    // Pixel amarelo pelo MATIZ (não pelo brilho): funciona com a webcam clara ou escura
    // (ex.: 230,210,40 ou 160,147,47). Exige cor viva (saturação) e o azul como menor componente.
    const colunas = new Uint32Array(w);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const mx = r > g ? r : g, mn = b;                  // b precisa ser o menor
            if (mx < 90 || b > r || b > g) continue;
            const d = mx - mn;
            if (d < mx * 0.5) continue;                        // saturação mínima de 50%
            const matiz = r >= g ? 60 * (g - b) / d : 120 - 60 * (r - b) / d;   // 0..120
            if (matiz >= 42 && matiz <= 72) colunas[x]++;      // amarelo (laranja e verde ficam de fora)
        }
    }
    // Uma coluna faz parte de uma faixa se pelo menos 12% da altura é amarela (objetos amarelos pequenos não contam)
    const minAltura = Math.max(8, h * 0.12);
    const faixas = [];
    let ini = -1, ultimo = -1, total = 0;
    const fecha = () => {
        if (ini >= 0 && (ultimo - ini + 1) >= Math.max(3, w * 0.008)) faixas.push({ x0: ini, x1: ultimo, total });
        ini = -1; total = 0;
    };
    const folga = Math.max(2, Math.round(w * 0.004));   // junta colunas separadas por pequenas falhas
    for (let x = 0; x < w; x++) {
        if (colunas[x] >= minAltura) {
            if (ini < 0) ini = x;
            ultimo = x; total += colunas[x];
        } else if (ini >= 0 && x - ultimo > folga) fecha();
    }
    fecha();
    if (faixas.length < 2) return null;
    // Se houver mais de duas manchas amarelas (ex.: roupa), usa as duas maiores
    const duas = faixas.sort((p, q) => q.total - p.total).slice(0, 2).sort((p, q) => p.x0 - q.x0);
    const esquerda = duas[0], direita = duas[1];
    const margem = Math.max(2, Math.round(w * 0.004));   // pequena folga para a faixa não aparecer na foto
    const x0 = esquerda.x1 + 1 + margem, x1 = direita.x0 - margem;
    if (x1 - x0 < w * 0.1) return null;                  // faixas muito juntas: não é a lousa
    return { x: x0, y: 0, width: x1 - x0, height: h };
}

function detectarAreaEntreFaixasAmarelas(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const dados = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    return acharAreaEntreFaixasAmarelas(dados, canvas.width, canvas.height);
}

// Recorte por cor simples (fallback intermediário): remove cor de fundo similar
function recortePorCor(img) {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    try {
        const imageData = ctx.getImageData(0, 0, c.width, c.height);
        const data = imageData.data;
        const n = c.width * c.height;

        // Amostra cor do fundo (cantos da imagem)
        const cornerColors = [
            { r: data[0], g: data[1], b: data[2] },
            { r: data[(c.width - 1) * 4], g: data[(c.width - 1) * 4 + 1], b: data[(c.width - 1) * 4 + 2] },
            { r: data[(c.height - 1) * c.width * 4], g: data[(c.height - 1) * c.width * 4 + 1], b: data[(c.height - 1) * c.width * 4 + 2] },
            { r: data[(c.height * c.width - 1) * 4], g: data[(c.height * c.width - 1) * 4 + 1], b: data[(c.height * c.width - 1) * 4 + 2] }
        ];

        // Média das cores dos cantos
        const bgR = cornerColors.reduce((s, c) => s + c.r, 0) / 4;
        const bgG = cornerColors.reduce((s, c) => s + c.g, 0) / 4;
        const bgB = cornerColors.reduce((s, c) => s + c.b, 0) / 4;

        // Remove pixels similares ao fundo
        const threshold = 30; // tolerância de cor
        for (let i = 0; i < n; i++) {
            const idx = i * 4;
            const r = data[idx], g = data[idx + 1], b = data[idx + 2];
            const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

            if (dist < threshold) {
                data[idx + 3] = 0; // transparente
            }
        }

        ctx.putImageData(imageData, 0, 0);
        console.log('Recorte por cor aplicado como fallback');
        return c;
    } catch (e) {
        console.warn('Recorte por cor falhou:', e);
        return recorteEliptico(img);
    }
}

// Recorte elíptico (último recurso)
function recorteEliptico(img) {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const x = c.getContext('2d');
    const retratoImg = c.height > c.width;
    x.save();
    x.beginPath();
    x.ellipse(c.width / 2, c.height / 2, c.width * (retratoImg ? 0.75 : 0.4), c.height * (retratoImg ? 0.75 : 0.6), 0, 0, 2 * Math.PI);
    x.clip();
    x.drawImage(img, 0, 0);
    x.restore();
    return c;
}

// Recorte simples (plano B): usa recorte por cor diretamente, sem tentar BodyPix novamente
async function recorteSimples(img) {
    // Fallback direto: recorte por cor (evita loop infinito)
    console.warn('Usando recorte por cor como fallback...');
    return recortePorCor(img);
}

// ----- Cache: o recorte da pessoa é feito UMA vez por foto (logo após a captura),
// assim trocar de moldura só desenha camadas e é instantâneo -----
let recorteCache = null;   // { dados, promessa, resultado }
let harmoniaCache = {};     // chave -> canvas harmonizado

function obterRecorte(dados) {
    if (!recorteCache || recorteCache.dados !== dados) {
        const promessa = comTempoLimite(gerarRecorteLousa(dados), 25000, 'Recorte com lousa')
            .catch(async err => {
                console.warn('Recorte com lousa falhou, usando o simples:', err);
                return recorteSimples(await carregarImagem(dados));
            });
        recorteCache = { dados, promessa, resultado: null };
        // Guarda o resultado quando pronto
        promessa.then(resultado => {
            recorteCache.resultado = resultado;
        });
    }
    return recorteCache.promessa;
}

// Invalida o cache de harmonização quando parâmetros mudam
function invalidarHarmonia() {
    harmoniaCache = {};
}

// Molduras já carregadas na memória (evita ler o arquivo a cada clique)
const molduraCache = {};
function obterMoldura(src) {
    if (!molduraCache[src]) molduraCache[src] = carregarImagem(src);
    return molduraCache[src];
}
// Pré-carrega todas as molduras ao iniciar
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.frame-option').forEach(o => {
        if (o.dataset.frame) {
            obterMoldura(o.dataset.frame).catch(() => { delete molduraCache[o.dataset.frame]; });
        }
    });
    console.log('Pré-carregando molduras...');
});


// Método simplificado como fallback
function applyFrameAsBackgroundSimple(base64Image, framePath) {
    return new Promise((resolve) => {
        const originalImg = new Image();
        originalImg.onload = () => {
            const frameImg = new Image();
            frameImg.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = originalImg.width;
                canvas.height = originalImg.height;
                
                // Desenhar a moldura como fundo
                ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
                
                // Criar máscara circular/elíptica no centro para a pessoa
                const centerX = canvas.width / 2;
                const centerY = canvas.height / 2;
                const retratoImg = canvas.height > canvas.width;
                const radiusX = canvas.width * (retratoImg ? 0.75 : 0.35);
                const radiusY = canvas.height * (retratoImg ? 0.75 : 0.5);
                
                // Desenhar a pessoa dentro de uma elipse
                ctx.save();
                ctx.beginPath();
                ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
                ctx.clip();
                ctx.drawImage(originalImg, 0, 0);
                ctx.restore();
                
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            frameImg.onerror = () => {
                console.error('Erro ao carregar moldura:', framePath);
                resolve(base64Image);
            };
            frameImg.src = framePath;
        };
        originalImg.src = base64Image;
    });
}

// Voltar para estado inicial
function resetToInitialState() {
    Stats.encerrar();
    // Se o diálogo de confirmação estiver aberto (ex.: usuário saiu de perto), cancela-o
    if (confirmaOverlay) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }
    // Cancelar timer de captura se estiver ativo
    if (captureTimer) {
        clearInterval(captureTimer);
        captureTimer = null;
        captureFaceBtn.disabled = false;
    }

    // Esconder timer visual
    countdownTimer.style.display = 'none';

    isCaptured = false;
    capturedImageData = null;
    selectedFrame = null;
    semMolduraEscolhida = false;
    frameApplied = false;

    limparPosCaptura();
    mascoteFoto = null; mascotActive = false; if (mascotToggle) mascotToggle.checked = false;
    M('reset');      // próxima pessoa: o mascote volta para o painel
    // Resetar filtros
    resetFilters();
    // Resetar valores de recorte
    recorteValues = { featherRadius: 2, edgeSensitivity: 0.3 };
    if (featherRadiusInput) featherRadiusInput.value = 2;
    if (featherValueDisplay) featherValueDisplay.textContent = '2';
    if (edgeSensitivityInput) edgeSensitivityInput.value = 30;
    if (edgeValueDisplay) edgeValueDisplay.textContent = '30%';

    setStep(1);

    // Esconder foto
    capturedPhoto.style.display = 'none';

    // Remover seleção de molduras
    frameOptions.forEach(opt => opt.classList.remove('selected'));

    // Esconder instruções
    sendInstructions.style.display = 'none';

    // Reiniciar detecção facial
    if (isModelLoaded) {
        startFaceDetection();
        updateStatus('Câmera ativa. Posicione o rosto no centro.');
    } else {
        faceBox.classList.add('active');
        updateStatus('Câmera ativa. Posicione o rosto no centro.');
    }
}

// Mostrar modal de tutorial
function showTutorial(imediato) {
    // Clique no botão de ajuda abre na hora; o aviso de 3 s fica só para o gesto
    if (imediato === true) {
        tutorialModal.classList.add('active');
        updateStatus('Tutorial aberto. Toque em "Entendi!" ou faça ✋ para fechar.');
        return;
    }
    // Criar e mostrar notificação temporária
    const notificacao = document.createElement('div');
    notificacao.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 240, 255, 0.95);
        color: #000;
        padding: 20px 40px;
        border-radius: 15px;
        font-size: 1.2em;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 0 30px rgba(0, 240, 255, 0.6);
        animation: fadeInOut 3s ease-in-out forwards;
    `;
    notificacao.textContent = 'Tutorial Aberto, Para fechar faça o mesmo gesto';

    // Adicionar animação CSS se não existir
    if (!document.getElementById('temp-notification-style')) {
        const style = document.createElement('style');
        style.id = 'temp-notification-style';
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notificacao);

    // Remover notificação após 3 segundos e abrir o tutorial
    setTimeout(() => {
        document.body.removeChild(notificacao);
        tutorialModal.classList.add('active');
        updateStatus('Tutorial Aberto. Faça o mesmo sinal (✋) para fechar.');
    }, 3000);
}

// Esconder modal de tutorial
function hideTutorial() {
    tutorialModal.classList.remove('active');
    // Restaurar mensagem de status baseada no passo atual
    if (currentStep === 1 && !isCaptured) {
        updateStatus('Câmera ativa. Posicione o rosto no centro.');
    } else if (currentStep === 2 && isCaptured) {
        updateStatus(frameApplied
            ? 'Toque em CONTINUAR'
            : 'Escolha uma moldura primeiro');
    } else if (currentStep === 3) {
        updateStatus('Digite seu número e toque em "Enviar"');
    }
}

// Alternar visibilidade do FAQ (para gesto)
function toggleFAQ() {
    const isOpen = tutorialModal.classList.contains('active');
    console.log('[FAQ] Alternando FAQ. Está aberto?', isOpen);
    if (isOpen) {
        hideTutorial();
    } else {
        showTutorial();
    }
}

// Atualizar status
function updateStatus(message) {
    statusText.textContent = message;
    console.log(message);
}

// Cleanup ao sair da página
window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    if (faceDetectionInterval) {
        clearInterval(faceDetectionInterval);
    }
    if (captureTimer) {
        clearInterval(captureTimer);
    }
});


// ===================================================================
// Tela de sucesso (confete + check animado)
// ===================================================================
/*
 * Tela de sucesso — uso:
 *   mostrarSucesso();                                   // padrão
 *   mostrarSucesso({ segundos: 10, onFechar: () => {} });
 *   fecharSucesso();                                    // fecha manualmente
 *
 * Chame mostrarSucesso() no ponto do seu código em que o envio
 * pelo WhatsApp foi concluído com sucesso.
 */
(function () {
    const CORES = ['#00f0ff', '#0072ff', '#ffffff', '#3b82f6', '#ff2a6d'];
    let overlay, canvas, ctx, raf, timer, particulas = [], opcoes = {};

    function criar() {
        if (overlay) return;
        overlay = document.createElement('div');
        overlay.className = 'sucesso-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-live', 'polite');
        overlay.innerHTML = `
            <canvas class="sucesso-confete"></canvas>
            <div class="sucesso-card">
                <img class="sucesso-mascote" alt="" hidden>
                <svg class="sucesso-check" viewBox="0 0 84 84" aria-hidden="true">
                    <circle cx="42" cy="42" r="30"/>
                    <path d="M28 43 L38 53 L57 32"/>
                </svg>
                <h2 class="sucesso-titulo"></h2>
                <p class="sucesso-texto"></p>
                <div class="sucesso-qrcode-container" id="sucessoQrBox" style="display:none;">
                    <img id="sucessoQrImg" alt="QR Code para Download">
                    <span style="font-size: 0.8em; color: #00f0ff;">Aponte a câmera para baixar</span>
                </div>
                <button type="button" class="sucesso-botao"></button>
                <div class="sucesso-barra"></div>
            </div>`;
        document.body.appendChild(overlay);
        canvas = overlay.querySelector('.sucesso-confete');
        ctx = canvas.getContext('2d');
        overlay.querySelector('.sucesso-botao').addEventListener('click', fechar);
        overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') fechar(); });
        window.addEventListener('resize', ajustarCanvas);
    }

    function ajustarCanvas() {
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = innerWidth * dpr;
        canvas.height = innerHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function lancarConfete() {
        const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduzir) return;
        particulas = [];
        const lados = [[0, 1], [innerWidth, -1]];
        for (let i = 0; i < 160; i++) {
            const [x, dir] = lados[i % 2];
            particulas.push({
                x, y: innerHeight * 0.75,
                vx: dir * (4 + Math.random() * 9) * (0.6 + Math.random()),
                vy: -(9 + Math.random() * 12),
                g: 0.28 + Math.random() * 0.12,
                w: 6 + Math.random() * 6, h: 10 + Math.random() * 8,
                rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
                cor: CORES[(Math.random() * CORES.length) | 0],
                vida: 0
            });
        }
        cancelAnimationFrame(raf);
        (function quadro() {
            ctx.clearRect(0, 0, innerWidth, innerHeight);
            particulas.forEach(p => {
                p.vida++; p.vx *= 0.992; p.vy += p.g;
                p.x += p.vx; p.y += p.vy; p.rot += p.vr;
                ctx.save();
                ctx.globalAlpha = Math.max(0, 1 - p.vida / 200);
                ctx.translate(p.x, p.y); ctx.rotate(p.rot);
                ctx.fillStyle = p.cor;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            });
            particulas = particulas.filter(p => p.vida < 200 && p.y < innerHeight + 40);
            if (particulas.length) raf = requestAnimationFrame(quadro);
            else ctx.clearRect(0, 0, innerWidth, innerHeight);
        })();
    }

    function mostrar(o) {
        opcoes = Object.assign({
            titulo: 'Foto enviada!',
            mensagem: 'Confira o seu WhatsApp. Sua foto já está a caminho.',
            botao: 'Nova foto',
            segundos: 8,
            mascote: true,
            onFechar: null
        }, o || {});
        criar();
        ajustarCanvas();
        const qrBox = overlay.querySelector('#sucessoQrBox');
        const qrImg = overlay.querySelector('#sucessoQrImg');
        if (opcoes.qrUrl) {
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(opcoes.qrUrl)}`;
            qrBox.style.display = 'flex';
        } else {
            qrBox.style.display = 'none';
        }

        overlay.querySelector('.sucesso-titulo').textContent = opcoes.titulo;
        overlay.querySelector('.sucesso-texto').textContent = opcoes.mensagem;
        overlay.querySelector('.sucesso-botao').textContent = opcoes.botao;

        const img = overlay.querySelector('.sucesso-mascote');
        const origem = document.getElementById('promotionalImage');
        if (opcoes.mascote && origem && origem.src) { img.src = origem.src; img.hidden = false; }
        else img.hidden = true;

        // reinicia as animações de check e da barra de tempo
        const card = overlay.querySelector('.sucesso-card');
        overlay.classList.remove('ativo'); void card.offsetWidth;
        overlay.classList.add('ativo');

        const barra = overlay.querySelector('.sucesso-barra');
        barra.style.transition = 'none'; barra.style.transform = 'scaleX(1)'; void barra.offsetWidth;
        if (opcoes.segundos > 0) {
            barra.style.transition = `transform ${opcoes.segundos}s linear`;
            barra.style.transform = 'scaleX(0)';
            clearTimeout(timer);
            timer = setTimeout(fechar, opcoes.segundos * 1000);
        }
        lancarConfete();
        overlay.querySelector('.sucesso-botao').focus({ preventScroll: true });
    }

    function fechar() {
        if (!overlay || !overlay.classList.contains('ativo')) return;
        clearTimeout(timer); cancelAnimationFrame(raf);
        overlay.classList.remove('ativo');
        if (ctx) ctx.clearRect(0, 0, innerWidth, innerHeight);
        if (typeof opcoes.onFechar === 'function') opcoes.onFechar();
    }

    window.mostrarSucesso = mostrar;
    window.fecharSucesso = fechar;
})();


// ===================================================================
// Captura por gestos (MediaPipe Gesture Recognizer)
// Faça o sinal e segure ~1 s: a contagem regressiva começa sozinha.
// ===================================================================
(function () {
    // ----- CONFIGURAÇÃO: ajuste aqui -----
    const CFG = {
        ativadoPorPadrao: true,
        // Nomes do MediaPipe: Victory ✌️ (para tirar fotos) | Open_Palm ✋ (para FAQ) | Thumb_Up 👍 (para alternar orientação)
        gestos: { Victory: '✌️', Open_Palm: '✋', Thumb_Up: '👍' },
        confianca: 0.3,      // 0 a 1 (maior = menos falsos positivos) - reduzido ainda mais para detectar melhor o 👍
        exigirRosto: false,  // true = só dispara se um rosto foi visto nos últimos 4 s
        debug: true,         // mostra no console (F12) o gesto que a câmera está vendo
        segurarMs: 500,      // tempo segurando o sinal para disparar - reduzido para ser mais responsivo
        intervaloMs: 150,    // frequência de análise (aumentado para melhor performance)
        versao: '0.10.14'
    };
    const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CFG.versao}`;
    const MODELO = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

    const container = document.querySelector('.video-container');
    const controles = document.querySelector('.controls');
    const emojis = Object.values(CFG.gestos);

    let reconhecedor = null, loop = null;
    let ativo = localStorage.getItem('gestosAtivos') !== null
        ? localStorage.getItem('gestosAtivos') === '1'
        : CFG.ativadoPorPadrao;
    let armado = true, atual = null, desde = 0, ultimoRosto = 0, ultimoLog = '';

    // ----- Interface -----
    const dica = document.createElement('div');
    dica.className = 'gesto-dica';
    dica.hidden = true;
    dica.textContent = '✌️ para tirar a foto | ✋ para abrir Ajuda | 👍 para alternar orientação';

    const progresso = document.createElement('div');
    progresso.className = 'gesto-progresso';
    progresso.hidden = true;
    progresso.innerHTML = '<span class="gesto-emoji"></span><span class="gesto-trilho"><span class="gesto-barra"></span></span>';
    const emojiEl = progresso.querySelector('.gesto-emoji');
    const barraEl = progresso.querySelector('.gesto-barra');

    container.appendChild(dica);
    container.appendChild(progresso);

    function esconder() {
        dica.hidden = true; progresso.hidden = true;
        atual = null; desde = 0;
    }

    // Exposto para a mensagem de status do app
    window.gestosAtivos = () => !!(reconhecedor && ativo);

    // ----- Análise -----
    // ----- Análise de gestos e movimento da mão -----
let swipeStartX = null;
let swipeStartAt = 0;

function tick() {
    try {
        const pronto =
            ativo &&
            reconhecedor &&
            video.srcObject &&
            video.readyState >= 2;

        if (!pronto) {
            esconder();
            swipeStartX = null;
            swipeStartAt = 0;
            return;
        }

        // Na etapa 2, reconhecer o movimento da mão para avançar.
        if (currentStep === 2 && isCaptured) {
            dica.hidden = false;
            dica.textContent = frameApplied
                ? 'Toque em CONTINUAR'
                : 'Escolha uma moldura primeiro';

            progresso.hidden = true;

            // Só permite avançar quando a moldura terminar de ser aplicada.
            if (!frameApplied || (!selectedFrame && !semMolduraEscolhida)) {
                swipeStartX = null;
                swipeStartAt = 0;
                return;
            }

            const res = reconhecedor.recognizeForVideo(
                video,
                performance.now()
            );

            // Debug: logar gestos detectados
            if (CFG.debug && res.gestures && res.gestures[0] && res.gestures[0][0]) {
                const gestoDetectado = res.gestures[0][0];
                console.log('[gestos] Etapa 2 - Gesto detectado:', gestoDetectado.categoryName, 'Score:', gestoDetectado.score.toFixed(2));
            }

            // Verifica se há gesto válido para avançar (Victory ✌️ ou Pointing_Up 👉)
            const top = res.gestures && res.gestures[0] && res.gestures[0][0];
            const nomeGesto = top && CFG.gestos[top.categoryName] && top.score >= CFG.confianca
                ? top.categoryName
                : null;

            if (nomeGesto === 'Victory' || nomeGesto === 'Pointing_Up') {
                console.log('[gestos] Gesto detectado na etapa 2 - avançando para WhatsApp:', nomeGesto);
                swipeStartX = null;
                swipeStartAt = 0;
                esconder();
                showWhatsAppModal();
                return;
            }

            // Se não for gesto Pointing_Up, verifica movimento de swipe
            const mao = res.landmarks && res.landmarks[0];
            const pulso = mao && mao[0];

            if (!pulso || typeof pulso.x !== 'number') {
                swipeStartX = null;
                swipeStartAt = 0;
                return;
            }

            const agora = performance.now();
            const xAtual = pulso.x;

            // Inicia ou reinicia a medição do movimento.
            if (
                swipeStartX === null ||
                agora - swipeStartAt > 700
            ) {
                swipeStartX = xAtual;
                swipeStartAt = agora;
                return;
            }

            const deslocamento = xAtual - swipeStartX;

            // Como a prévia está espelhada, o movimento visual
            // para a direita normalmente corresponde a x diminuindo.
            // Ajustar threshold baseado na orientação
            // A câmera é sempre 16:9; no Retrato só a faixa central (~32% da largura) aparece na tela,
            // então o deslocamento necessário é proporcionalmente menor.
            const threshold = CONFIG_CAMERA.orientacao === 'portrait' ? 0.10 : 0.18;
            const moveuParaDireita = CONFIG_CAMERA.espelharFoto
                ? deslocamento <= -threshold
                : deslocamento >= threshold;

            if (moveuParaDireita) {
                console.log(
                    '[gestos] Movimento para a direita detectado.'
                );

                // Impede chamadas repetidas ao abrir o WhatsApp.
                swipeStartX = null;
                swipeStartAt = 0;

                esconder();
                showWhatsAppModal();
                return;
            }

            // Atualiza o ponto inicial se a mão se mover muito
            // para o lado oposto.
            const moveuParaEsquerda = CONFIG_CAMERA.espelharFoto
                ? deslocamento >= threshold
                : deslocamento <= -threshold;

            if (moveuParaEsquerda) {
                swipeStartX = xAtual;
                swipeStartAt = agora;
            }

            return;
        }

        // Fora das etapas de captura e moldura, não medir movimento.
        swipeStartX = null;
        swipeStartAt = 0;

        // Na etapa 1, manter os gestos habituais para tirar a foto
        // e abrir ou fechar o tutorial.
        const prontoParaCapturar =
            !isCaptured &&
            !captureFaceBtn.disabled &&
            currentStep === 1 &&
            video.readyState >= 2; // Garantir que o vídeo está pronto

        if (!prontoParaCapturar) {
            esconder();
            return;
        }

        if (tutorialModal.classList.contains('active')) {
            progresso.hidden = false;
            dica.textContent = '✋ para fechar Ajuda';
        } else {
            dica.textContent = '✌️ para tirar a foto. ✋ para abrir Ajuda. 👍 para alternar orientação';
        }

        dica.hidden = false;

        const res = reconhecedor.recognizeForVideo(
            video,
            performance.now()
        );

        // Se não detectar nenhuma mão, retornar cedo para economizar recursos
        if (!res.landmarks || res.landmarks.length === 0) {
            armado = true;
            atual = null;
            desde = 0;

            if (!tutorialModal.classList.contains('active')) {
                progresso.hidden = true;
            }

            return;
        }

        const top =
            res.gestures &&
            res.gestures[0] &&
            res.gestures[0][0];

        const nome =
            top &&
            CFG.gestos[top.categoryName] &&
            top.score >= CFG.confianca
                ? top.categoryName
                : null;

        if (CFG.debug) {
            const txt = top
                ? `${top.categoryName} ${top.score.toFixed(2)}`
                : 'nenhuma mão';

            const chave = top ? top.categoryName : '-';

            if (chave !== ultimoLog) {
                ultimoLog = chave;
                console.log('[gestos] vendo:', txt);
            }
        }

        if (!nome) {
            armado = true;
            atual = null;
            desde = 0;

            if (!tutorialModal.classList.contains('active')) {
                progresso.hidden = true;
            }

            return;
        }

        if (!armado) return;

        if (CFG.exigirRosto) {
            if (faceBox.classList.contains('active')) {
                ultimoRosto = performance.now();
            }

            if (performance.now() - ultimoRosto > 4000) {
                atual = null;
                desde = 0;
                progresso.hidden = true;
                return;
            }
        }

        const agora = performance.now();

        if (nome !== atual) {
            atual = nome;
            desde = agora;
        }

        const p = Math.min(
            1,
            (agora - desde) / CFG.segurarMs
        );

        emojiEl.textContent = CFG.gestos[nome];
        barraEl.style.transform = `scaleX(${p})`;
        progresso.hidden = false;

        if (p >= 1) {
            armado = false;

            if (nome === 'Open_Palm') {
                console.log('[gestos] Executando toggleFAQ()');
                toggleFAQ();
                esconder();
            } else if (nome === 'Victory') {
                esconder();
                captureFace();
            } else if (nome === 'Thumb_Up') {
                console.log('[gestos] Executando toggleOrientation()');
                toggleOrientation();
                esconder();
            }
        }

    } catch (e) {
        console.warn('Falha na análise de gestos:', e);
    }
}

    // ----- Carregamento -----
    async function iniciar() {
        try {
            const vision = await import(`${CDN}/vision_bundle.mjs`);
            const arquivos = await vision.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
            const criar = delegate => vision.GestureRecognizer.createFromOptions(arquivos, {
                baseOptions: { modelAssetPath: MODELO, delegate },
                runningMode: 'VIDEO',
                numHands: 1
            });
            try { reconhecedor = await criar('GPU'); }
            catch (e) { console.warn('GPU indisponível, usando CPU:', e); reconhecedor = await criar('CPU'); }
            loop = setInterval(tick, CFG.intervaloMs);
            console.log('Reconhecimento de gestos pronto.');
        } catch (erro) {
            console.warn('Gestos indisponíveis:', erro);
        }
    }
    iniciar();
})();


// ===================================================================
// EXTRAS: selo/data, perfil profissional,
// QR Code e contagem falada
// ===================================================================
const SITE_CURSOS = 'https://www.senaipr.org.br'; // confira/ajuste o endereço usado na mensagem do WhatsApp

let seloAtivo = true;
let framedCache = null;      // { frame, src } -> foto já recortada sobre a moldura
let rostosFoto = [];         // rostos achados na foto capturada (landmarks + expressões)
let analiseConcluida = false;
let perfilAtual = null;
let renderToken = 0;

const logoSelo = new Image();
let logoSeloOk = false;
logoSelo.onload = () => { logoSeloOk = true; };
logoSelo.src = 'assets/mundo_senai_4.png';

const PERFIS = [
    { id: 'solda',     icone: '🔥', nome: 'Soldagem',             frase: 'Precisão e firmeza: você nasceu para unir metais!',        frame: 'assets/bg-solda.jpg'     },
    { id: 'usinagem',  icone: '⚙️', nome: 'Usinagem',             frase: 'Olho clínico e mão firme: a peça perfeita é com você!',     frame: 'assets/bg-tornearia.jpg' },
    { id: 'automotiva',icone: '🚗', nome: 'Mecânica Automotiva',  frase: 'Você tem o motor da inovação!',                             frame: 'assets/bg-carros.jpg'    },
    { id: 'motos',     icone: '🏍️', nome: 'Mecânica de Motos',    frase: 'Velocidade e estilo: sua praia é a oficina!',               frame: 'assets/bg-motos.jpg'     },
    { id: 'industria', icone: '🏭', nome: 'Indústria e Automação', frase: 'Tecnologia e processo: o futuro da indústria é seu!',      frame: 'assets/bg-industria.jpg' }
];

// ----- Utilidades -----
function carregarImagem(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('failed to load ' + src));
        img.src = src;
    });
}

function retanguloArredondado(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// ----- Contagem falada -----
function falarNumero(n) {
    if (!CONFIG_CAMERA.voz || !('speechSynthesis' in window)) return;
    try {
        speechSynthesis.cancel();
        const fala = new SpeechSynthesisUtterance(String(n));
        const selectedVoice = TIMER_OPTIONS[selectedTimerIndex].voice;
        fala.lang = selectedVoice;
        fala.rate = 1.1;
        speechSynthesis.speak(fala);
    } catch (e) { /* sem voz: segue sem som */ }
}

// ----- Selo (logo + nome do projeto + data) no rodapé da foto -----
function desenharSelo(ctx, w, h) {
    const retrato = h > w;
    // Em Retrato a largura é pequena: a faixa e as letras se baseiam na largura
    const faixa = Math.round(retrato ? Math.min(h * 0.085, w * 0.17) : h * 0.085);
    const topo = h - faixa * 1.5;
    const grad = ctx.createLinearGradient(0, topo, 0, h);
    grad.addColorStop(0, 'rgba(1, 18, 54, 0)');
    grad.addColorStop(1, 'rgba(1, 18, 54, 0.88)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, topo, w, h - topo);

    const margem = Math.round(w * 0.025);
    const meioY = h - faixa * 0.55;
    let xTexto = margem;

    if (logoSeloOk && logoSelo.naturalWidth) {
        const lh = faixa * 0.62;
        const lw = lh * (logoSelo.naturalWidth / logoSelo.naturalHeight);
        ctx.drawImage(logoSelo, margem, meioY - lh / 2, lw, lh);
        xTexto = margem + lw + margem * 0.8;
    }

    const data = new Date().toLocaleDateString('pt-BR');
    const titulo = 'Sua foto Mundo Senai';
    const larguraLivre = w - margem - xTexto;
    const fam = "'Segoe UI', Arial, sans-serif";

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = faixa * 0.15;
    ctx.textBaseline = 'middle';

    let tTitulo = Math.round(faixa * 0.4);
    let tData = Math.round(faixa * 0.36);
    ctx.font = `800 ${tTitulo}px ${fam}`;
    const wTitulo = ctx.measureText(titulo).width;
    ctx.font = `600 ${tData}px ${fam}`;
    const wData = ctx.measureText(data).width;
    const folga = margem * 1.5;

    if (wTitulo + wData + folga <= larguraLivre) {
        // Cabe tudo na mesma linha: título à esquerda, data à direita
        ctx.textAlign = 'left';
        ctx.font = `800 ${tTitulo}px ${fam}`;
        ctx.fillText(titulo, xTexto, meioY);
        ctx.textAlign = 'right';
        ctx.font = `600 ${tData}px ${fam}`;
        ctx.fillText(data, w - margem, meioY);
    } else {
        // Espaço curto (Retrato): título em cima e data embaixo, ajustando o tamanho para caber
        ctx.font = `800 ${tTitulo}px ${fam}`;
        if (wTitulo > larguraLivre) tTitulo = Math.floor(tTitulo * larguraLivre / wTitulo);
        tData = Math.min(tData, Math.round(tTitulo * 0.9));
        ctx.textAlign = 'left';
        ctx.font = `800 ${tTitulo}px ${fam}`;
        ctx.fillText(titulo, xTexto, meioY - tTitulo * 0.6);
        ctx.font = `600 ${tData}px ${fam}`;
        ctx.fillText(data, xTexto, meioY + tData * 0.75);
    }
    ctx.shadowBlur = 0;
}

// ----- Pipeline de composição: normalização -> recorte -> remoção de "color spill" -> harmonização -----

// 1) Pré-processamento: ajusta exposição, contraste e nitidez da foto antes do recorte.
// Estica os níveis (percentis 1% e 99%, com limite para não estourar), corrige a luminosidade média por gamma
// (sem mudar o matiz) e aplica um leve aumento de nitidez para as bordas ficarem bem definidas.
function normalizarPixels(d, w, h) {
    const n = w * h, hist = new Uint32Array(256);
    for (let i = 0; i < n; i++) {
        const j = i * 4;
        hist[Math.round(0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2])]++;
    }
    const perc = (q) => { let acc = 0; const alvo = n * q; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= alvo) return v; } return 255; };
    const lo = Math.min(perc(0.01), 45), hi = Math.max(perc(0.99), 200);   // estica no máximo ~20%: sem estourar
    let soma = 0;
    for (let v = 0; v < 256; v++) soma += hist[v] * Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
    const media = Math.min(0.8, Math.max(0.2, soma / n));
    const gamma = Math.min(1.35, Math.max(0.75, Math.log(0.48) / Math.log(media)));   // clareia foto escura / escurece a estourada
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) lut[v] = Math.round(255 * Math.pow(Math.min(1, Math.max(0, (v - lo) / (hi - lo))), gamma));
    for (let i = 0; i < n; i++) { const j = i * 4; d[j] = lut[d[j]]; d[j + 1] = lut[d[j + 1]]; d[j + 2] = lut[d[j + 2]]; }
    // nitidez (máscara de nitidez leve, só na luminosidade para não criar franjas coloridas)
    const Y = new Float32Array(n);
    for (let i = 0; i < n; i++) { const j = i * 4; Y[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2]; }
    const Yb = desfoqueCaixa(Y, w, h, 2);
    for (let i = 0; i < n; i++) {
        const j = i * 4, delta = 0.7 * (Y[i] - Yb[i]);
        d[j] = d[j] + delta; d[j + 1] = d[j + 1] + delta; d[j + 2] = d[j + 2] + delta;   // Uint8ClampedArray satura sozinho
    }
    return { lo, hi, gamma };
}
function normalizarFoto(img) {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    try {
        const im = ctx.getImageData(0, 0, w, h);
        const info = normalizarPixels(im.data, w, h);
        ctx.putImageData(im, 0, 0);
        console.log('Normalização da foto:', info);
    } catch (e) { console.warn('Normalização indisponível:', e); ctx.drawImage(img, 0, 0, w, h); }
    return c;
}

// 2 + 4) Remove o vazamento de cor (color spill) das bordas e harmoniza a pessoa com o novo fundo.
// sub = pixels RGBA da pessoa recortada | fun = pixels RGBA do fundo já desenhado | funBlur = fundo bem desfocado
function harmonizarPixels(sub, fun, funBlur, w, h) {
    const n = w * h, out = new Uint8ClampedArray(sub);
    // --- estatísticas da pessoa (só o miolo, alfa alto) e caixa que ela ocupa ---
    let sR = 0, sG = 0, sB = 0, sN = 0, bx0 = w, bx1 = 0, by0 = h, by1 = 0;
    const histS = new Uint32Array(256);
    for (let i = 0; i < n; i++) {
        const a = sub[i * 4 + 3];
        if (a > 20) { const x = i % w, y = (i - x) / w; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
        if (a >= 240) { const j = i * 4; sR += sub[j]; sG += sub[j + 1]; sB += sub[j + 2]; sN++; histS[Math.round(0.299 * sub[j] + 0.587 * sub[j + 1] + 0.114 * sub[j + 2])]++; }
    }
    if (sN < 300 || bx1 <= bx0) return out;
    sR /= sN; sG /= sN; sB /= sN;
    const Ls = 0.299 * sR + 0.587 * sG + 0.114 * sB;

    // --- análise do fundo ao redor da pessoa (região da caixa ampliada em 25%) ---
    const mx = Math.round((bx1 - bx0) * 0.25), my = Math.round((by1 - by0) * 0.25);
    const rx0 = Math.max(0, bx0 - mx), rx1 = Math.min(w - 1, bx1 + mx), ry0 = Math.max(0, by0 - my), ry1 = Math.min(h - 1, by1 + my);
    const cxR = (rx0 + rx1) / 2, cyR = (ry0 + ry1) / 2;
    let fR = 0, fG = 0, fB = 0, fN = 0, Le = 0, Ld = 0, Lc = 0, Lb = 0, nE = 0, nD = 0, nC = 0, nB = 0;
    const histF = new Uint32Array(256);
    for (let y = ry0; y <= ry1; y += 3) {
        for (let x = rx0; x <= rx1; x += 3) {
            const j = (y * w + x) * 4, L = 0.299 * fun[j] + 0.587 * fun[j + 1] + 0.114 * fun[j + 2];
            fR += fun[j]; fG += fun[j + 1]; fB += fun[j + 2]; fN++; histF[Math.round(L)]++;
            if (x < cxR) { Le += L; nE++; } else { Ld += L; nD++; }
            if (y < cyR) { Lc += L; nC++; } else { Lb += L; nB++; }
        }
    }
    fR /= fN; fG /= fN; fB /= fN;
    const Lf = 0.299 * fR + 0.587 * fG + 0.114 * fB;
    const dirX = nE && nD ? (Ld / nD - Le / nE) / ((Ld / nD + Le / nE) || 1) : 0;   // + = luz vem da direita
    const dirY = nC && nB ? (Lc / nC - Lb / nB) / ((Lc / nC + Lb / nB) || 1) : 0;   // + = luz vem de cima
    const p5F = (() => { let acc = 0; for (let v = 0; v < 256; v++) { acc += histF[v]; if (acc >= fN * 0.05) return v; } return 0; })();

    // --- ganhos: temperatura de cor, exposição, direção da luz (todos parciais, para não "pintar" a pessoa) ---
    const cl = (v, a, b) => Math.min(b, Math.max(a, v));
    const gR = cl(Math.pow((fR / fG) / (sR / sG), 0.25), 0.94, 1.06);
    const gB = cl(Math.pow((fB / fG) / (sB / sG), 0.25), 0.94, 1.06);
    const gE = cl(Math.pow(Lf / Ls, 0.15), 0.96, 1.04);   // exposição: quase não escurece/clareia a pessoa
    const levanta = 0.08 * p5F;                                  // preto do cenário: sombras da pessoa não ficam mais escuras que ele
    const larg = Math.max(1, (bx1 - bx0) / 2), alt = Math.max(1, (by1 - by0) / 2), cxS = (bx0 + bx1) / 2, cyS = (by0 + by1) / 2;

    // --- cor "limpa" do miolo (para tirar o vazamento do fundo original nas bordas) ---
    const alfa = new Float32Array(n), solido = new Float32Array(n), cR = new Float32Array(n), cG = new Float32Array(n), cB = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const a = sub[i * 4 + 3] / 255; alfa[i] = a;
        if (a >= 0.95) { solido[i] = 1; const j = i * 4; cR[i] = sub[j]; cG[i] = sub[j + 1]; cB[i] = sub[j + 2]; }
    }
    const dd = desfoqueCaixa(desfoqueCaixa(solido, w, h, 4), w, h, 4);
    const iR = desfoqueCaixa(desfoqueCaixa(cR, w, h, 4), w, h, 4);
    const iG = desfoqueCaixa(desfoqueCaixa(cG, w, h, 4), w, h, 4);
    const iB = desfoqueCaixa(desfoqueCaixa(cB, w, h, 4), w, h, 4);
    const ab = desfoqueCaixa(alfa, w, h, 3);

    for (let i = 0; i < n; i++) {
        if (!sub[i * 4 + 3]) continue;
        const j = i * 4;
        let r = sub[j], g = sub[j + 1], b = sub[j + 2];
        const e = cl((0.97 - ab[i]) / 0.6, 0, 1);                // 0 = miolo, 1 = borda
        // a) color spill: na borda, troca a cor contaminada pela cor do miolo vizinho
        if (e > 0 && dd[i] > 0.02) {
            const t = e * 0.85;
            r += (iR[i] / dd[i] - r) * t; g += (iG[i] / dd[i] - g) * t; b += (iB[i] / dd[i] - b) * t;
        }
        // b) color grading: temperatura, exposição e direção da luz do novo cenário
        const x = i % w, y = (i - x) / w;
        const luz = cl(1 + 0.25 * (dirX * cl((x - cxS) / larg, -1, 1) + dirY * cl((cyS - y) / alt, -1, 1)), 0.96, 1.04);   // luz direcional leve: sem manchas
        const k = gE * luz;
        r *= gR * k; g *= k; b *= gB * k;
        // c) sombras levantadas até o preto do cenário
        const l = cl((0.299 * r + 0.587 * g + 0.114 * b) / 255, 0, 1), lift = levanta * (1 - l) * (1 - l);
        r += lift; g += lift; b += lift;
        // d) "light wrap": a luz do cenário contorna a borda da pessoa
        if (e > 0) {
            const lw = 0.06 * e;   // light wrap discreto: sem aro escuro/roxo em volta da pessoa
            r += (funBlur[j] - r) * lw; g += (funBlur[j + 1] - g) * lw; b += (funBlur[j + 2] - b) * lw;
        }
        out[j] = r; out[j + 1] = g; out[j + 2] = b;
    }
    return out;
}

// Versão com canvas: recorte = pessoa (fundo transparente), fundoCanvas = moldura já desenhada no mesmo tamanho
// O cache agora é gerenciado externamente pelo renderFinal para troca rápida de moldura
function harmonizarSujeito(recorte, fundoCanvas, chave) {
    const w = recorte.width, h = recorte.height;
    try {
        const sub = recorte.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h);
        const fun = fundoCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h);
        const bl = document.createElement('canvas');
        bl.width = w; bl.height = h;
        const bctx = bl.getContext('2d', { willReadFrequently: true });
        bctx.filter = `blur(${Math.max(6, Math.round(Math.min(w, h) * 0.02))}px)`;
        bctx.drawImage(fundoCanvas, 0, 0);
        bctx.filter = 'none';
        const blur = bctx.getImageData(0, 0, w, h);
        const saida = harmonizarPixels(sub.data, fun.data, blur.data, w, h);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const cctx = c.getContext('2d');
        cctx.putImageData(new ImageData(saida, w, h), 0, 0);
        return c;
    } catch (e) {
        console.warn('Harmonização indisponível, usando a pessoa sem ajuste:', e);
        return recorte;
    }
}

// ----- Composição final: moldura -> selo -----
async function comporFoto(baseSrc) {
    const img = await carregarImagem(baseSrc);
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);

    if (seloAtivo) desenharSelo(ctx, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.9);
}

// Devolve true se esta chamada foi a que atualizou a foto na tela
async function renderFinal() {
    if (!capturedImageData) return false;
    const token = ++renderToken;
    const dados = capturedImageData;
    try {
        const original = await carregarImagem(dados);
        let molduraImg = null, recorte = null;

        if (selectedFrame) {
            // Só processa recorte se tiver moldura selecionada
            // Usa o cache do recorte se já estiver pronto
            if (recorteCache && recorteCache.resultado) {
                recorte = recorteCache.resultado;
            } else {
                // Se não está pronto, espera (só acontece na primeira vez)
                recorte = await obterRecorte(dados);
            }
            molduraImg = await obterMoldura(selectedFrame);
        }

        if (token !== renderToken || dados !== capturedImageData) return false;

        // Tudo é desenhado em um único canvas: moldura -> pessoa -> selo
        const c = document.createElement('canvas');
        c.width = original.width;
        c.height = original.height;
        const ctx = c.getContext('2d');

        if (molduraImg) {
            // Com moldura: desenha moldura + pessoa harmonizada
            desenharMolduraCobrindo(ctx, molduraImg, c.width, c.height);

            // Cache de harmonização para troca rápida de moldura
            const chaveHarmonia = selectedFrame + '|' + c.width + 'x' + c.height + '|' +
                                  recorteValues.featherRadius + '|' + recorteValues.edgeSensitivity;

            if (!harmoniaCache[chaveHarmonia]) {
                harmoniaCache[chaveHarmonia] = harmonizarSujeito(recorte, c, chaveHarmonia);
            }

            ctx.drawImage(harmoniaCache[chaveHarmonia], 0, 0);
        } else {
            // Sem moldura: desenha a FOTO ORIGINAL sem alterações
            ctx.drawImage(original, 0, 0);
        }

        if (mascotActive && mascoteFoto) ctx.drawImage(mascoteFoto, 0, 0, c.width, c.height);   // mascote na foto
        if (seloAtivo) desenharSelo(ctx, c.width, c.height);

        capturedPhoto.src = c.toDataURL('image/jpeg', 0.9);
        applyFilters();
        frameApplied = !!selectedFrame || semMolduraEscolhida;   // libera o gesto/botão de avançar
        return true;
    } catch (e) {
        console.error('Erro ao montar a foto:', e);
        return false;
    }
}

// ----- Análise do rosto na foto capturada -----
function iniciarPosCaptura() {
    framedCache = null;
    rostosFoto = [];
    analiseConcluida = false;
    perfilAtual = null;
    recorteCache = null;
    harmoniaCache = {}; // Invalida cache de harmonização
    atualizarPerfilUI();
    renderFinal();       // já mostra a foto com selo/data
    obterRecorte(capturedImageData);   // prepara o recorte da pessoa em segundo plano (molduras ficam instantâneas)
    analisarRosto();
}

function limparPosCaptura() {
    renderToken++;       // cancela montagens em andamento
    recorteCache = null;
    harmoniaCache = {}; // Invalida cache de harmonização
    framedCache = null;
    rostosFoto = [];
    analiseConcluida = false;
    perfilAtual = null;
    atualizarAcessoriosUI();
    atualizarPerfilUI();
}

async function analisarRosto() {
    const dados = capturedImageData;
    let achados = [];
    if (isModelLoaded) {
        try {
            const img = await carregarImagem(dados);
            const rs = await faceapi
                .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }))
                .withFaceLandmarks()
                .withFaceExpressions();
            achados = rs.map(r => ({
                pts: r.landmarks.positions.map(p => ({ x: p.x, y: p.y })),
                expressions: r.expressions,
                area: r.detection.box.width * r.detection.box.height
            }));
        } catch (e) {
            console.warn('Falha ao analisar o rosto da foto:', e);
        }
    }
    if (dados !== capturedImageData) return;   // refez a foto no meio da análise
    achados.sort((a, b) => b.area - a.area);
    rostosFoto = achados;
    analiseConcluida = true;
    perfilAtual = escolherPerfil(achados[0]);
    atualizarPerfilUI();
}

// Perfil lúdico: o mesmo rosto sempre cai no mesmo perfil (baseado na posição dos pontos)
function escolherPerfil(rosto) {
    let semente = Math.random() * 1000;
    if (rosto) {
        semente = rosto.pts.reduce((s, p, i) => s + (p.x * 3 + p.y * 7) * (i + 1), 0);
    }
    const idx = Math.floor(Math.abs(Math.sin(semente)) * PERFIS.length) % PERFIS.length;
    return PERFIS[idx];
}

function mensagemPerfil() {
    if (!perfilAtual) return '';
    return `\n\n${perfilAtual.icone} Seu perfil SENAI: ${perfilAtual.nome}. ${perfilAtual.frase}\nConheça os cursos da área: ${SITE_CURSOS}`;
}

// ----- Interface: selo, perfil -----
function atualizarAcessoriosUI() {
    const toggle = document.getElementById('seloToggle');
    if (toggle) toggle.checked = seloAtivo;
}

function atualizarPerfilUI() {
    const card = document.getElementById('perfilCard');
    if (!card) return;
    card.hidden = !perfilAtual;
    if (!perfilAtual) return;
    card.querySelector('.perfil-icone').textContent = perfilAtual.icone;
    card.querySelector('.perfil-nome').textContent = 'Seu perfil: ' + perfilAtual.nome;
    card.querySelector('.perfil-frase').textContent = perfilAtual.frase;
}



function aplicarPerfil() {
    if (!perfilAtual || !isCaptured) return;
    const opcao = Array.from(frameOptions).find(o => o.dataset.frame === perfilAtual.frame);
    if (opcao) selectFrame(opcao);
    else renderFinal();
}

// ----- QR Code (sem informar número) -----
async function enviarPorQr() {
    if (currentStep !== 3) return;
    clearTimeout(envioAutoTimer);

    const qrBtn = document.getElementById('sendQr');
    const originalText = qrBtn.innerHTML;
    qrBtn.innerHTML = `<span class="icon" aria-hidden="true">📱</span> Gerando seu QR Code...`;
    qrBtn.disabled = true;

    setStep(4);
    updateStatus('Gerando o QR Code...');
    try {
        let imagem = capturedPhoto.src;
        if (filterValues.brightness != 100 || filterValues.contrast != 100 || filterValues.saturation != 100) {
            imagem = await applyFiltersToImage(imagem);
        }
        // Cópia na pasta do dashboard (ignora se esta mesma foto já foi salva)
        salvarNaPastaDashboard(imagem, `foto-senai-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`);
        const url = await uploadToImgBB(imagem);
        mostrarSucesso({
            titulo: 'Escaneie e baixe!',
            mensagem: 'Aponte a câmera do celular para o QR Code e salve a sua foto.',
            segundos: 45,
            mascote: false,
            qrUrl: url,
            onFechar: resetToInitialState
        });
        updateStatus('QR Code pronto!');
        Stats.concluir('qr');
    } catch (erro) {
        console.error('Erro ao gerar QR Code:', erro);
        Stats.erro();
        updateStatus('Não foi possível gerar o QR Code. Tente de novo ou envie pelo WhatsApp.');
        setStep(3);
        qrBtn.innerHTML = originalText;
        qrBtn.disabled = false;
    }
}

// ----- Ligações com a página -----
document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('seloToggle');
    if (toggle) {
        toggle.addEventListener('change', () => {
            seloAtivo = toggle.checked;
            if (isCaptured) renderFinal();
        });
    }
    const aplicar = document.getElementById('aplicarPerfil');
    if (aplicar) aplicar.addEventListener('click', aplicarPerfil);
    const qr = document.getElementById('sendQr');
    if (qr) qr.addEventListener('click', enviarPorQr);

    atualizarAcessoriosUI();
});


// ===================================================================
// Estatísticas de uso (anônimas: sem foto e sem número de telefone)
// Uma "sessão" = uma pessoa, da primeira foto até o envio (ou desistência).
// Se o servidor não responder, o app segue funcionando normalmente.
// ===================================================================
const Stats = (() => {
    const URL_REGISTRO = 'admin/registrar.php';
    let sid = null, filtro = 'normal', concluido = false;

    const novoId = () => (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2, 12);

    function nomeMoldura() {
        const op = Array.from(frameOptions).find(o => o.dataset.frame === selectedFrame);
        return op ? op.querySelector('span').textContent.trim() : 'Sem moldura';
    }

    function enviar(evento, extra = {}) {
        if (!sid) return;
        const dados = {
            moldura: nomeMoldura(),
            filtro,
            brilho: Number(filterValues.brightness),
            contraste: Number(filterValues.contrast),
            saturacao: Number(filterValues.saturation),
            selo: seloAtivo ? 1 : 0,
            perfil: perfilAtual ? perfilAtual.nome : null,
            ...extra
        };
        try {
            fetch(URL_REGISTRO, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sid, evento, dados }),
                keepalive: true
            }).catch(() => {});
        } catch (e) { /* estatística nunca atrapalha o app */ }
    }

    return {
        captura()   { if (!sid) { sid = novoId(); concluido = false; } enviar('captura', { timer_s: TIMER_OPTIONS[selectedTimerIndex].seconds }); },
        atualizar() { enviar('atualizar'); },
        refeita()   { enviar('refeita'); },
        erro()      { enviar('erro'); },
        concluir(metodo) { concluido = true; enviar('concluir', { metodo }); },
        encerrar()  { if (sid && !concluido) enviar('abandono', { passo_final: currentStep }); sid = null; concluido = false; filtro = 'normal'; },
        setFiltro(f) { filtro = f; }
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.preset-btn').forEach(b => b.addEventListener('click', () => Stats.setFiltro(b.dataset.preset)));
    ['brightness', 'contrast', 'saturation'].forEach(id => {
        const inp = document.getElementById(id);
        if (inp) inp.addEventListener('input', () => Stats.setFiltro('personalizado'));
    });
});


// ===================================================================
// Cópia da foto na pasta do dashboard (via salvar_foto.php, no XAMPP)
// Pasta: C:\xampp\htdocs\mgsenai dashboard\Imagens
// ===================================================================
let ultimaFotoSalvaNaPasta = null;   // evita salvar a mesma foto duas vezes

async function salvarNaPastaDashboard(base64Image, nome) {
    if (!base64Image || base64Image === ultimaFotoSalvaNaPasta) return;
    ultimaFotoSalvaNaPasta = base64Image;
    try {
        const resposta = await fetch('salvar_foto.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imagem: base64Image, nome })
        });
        const dados = await resposta.json().catch(() => null);
        if (!resposta.ok || !dados || !dados.ok) {
            throw new Error((dados && dados.erro) || `HTTP ${resposta.status}`);
        }
        console.log('Foto copiada para a pasta do dashboard:', dados.arquivo);
    } catch (erro) {
        ultimaFotoSalvaNaPasta = null;   // permite tentar de novo
        console.warn('Não foi possível copiar a foto para a pasta do dashboard:', erro);
    }
}

// ===================================================================
// Sem barra de rolagem: o passo atual é reduzido (zoom) só o necessário
// para caber na altura disponível do painel lateral.
// ===================================================================
(function () {
    let ocupado = false, agendado = null;

    function ajustar() {
        const side = document.querySelector('.side');
        const passo = document.getElementById('step' + currentStep);
        if (!side || !passo || ocupado) return;
        ocupado = true;
        passo.style.zoom = '';                         // mede no tamanho real
        let fator = 1;
        for (let i = 0; i < 4; i++) {
            const excesso = side.scrollHeight - side.clientHeight;
            if (excesso <= 1) break;
            // reduz proporcionalmente ao que sobrou e mede de novo
            fator = Math.max(0.4, fator * (side.clientHeight / side.scrollHeight));
            passo.style.zoom = String(fator);
            if (fator <= 0.4) break;
        }
        ocupado = false;
    }

    function agendar() {
        clearTimeout(agendado);
        agendado = setTimeout(() => requestAnimationFrame(ajustar), 80);
    }
    window.ajustarSemRolagem = agendar;

    document.addEventListener('DOMContentLoaded', () => {
        const side = document.querySelector('.side');
        if (!side) return;
        window.addEventListener('resize', agendar);
        new MutationObserver(agendar).observe(side, {
            subtree: true, childList: true, characterData: true,
            attributes: true, attributeFilter: ['hidden', 'class', 'src', 'data-step']
        });
        new MutationObserver(agendar).observe(document.body, { attributes: true, attributeFilter: ['data-step'] });
        if (window.ResizeObserver) new ResizeObserver(agendar).observe(side);
        ['finalPhoto', 'downloadQrCode', 'promotionalImage'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('load', agendar);
        });
        agendar();
    });
})();