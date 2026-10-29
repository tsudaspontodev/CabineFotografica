/* =====================================================================
   Mascote SENAI animado (substitui o GIF do passo 1)
   ---------------------------------------------------------------------
   Quadros em assets/mascote/ (recortados, sem fundo, mesma escala):
     aceno, parado ............ mascote do senaitds, melhorado (super-resolução + cores do vídeo novo)
     festa, coracao, aponta,
     camera, clique, procura .. mascote do vídeo animado
   Lugares onde ele aparece:
     painel  -> no passo 1, no lugar do antigo GIF (com o botão "Tirar foto comigo" embaixo)
     camera  -> dentro da imagem da câmera, posando para sair na foto junto com a pessoa
     mini    -> pequeno no canto da tela depois que a foto é tirada (passos 2 e 3)
   API usada pelo app.js:
     Mascote.passo(n) · rosto('nenhum'|'ajustar'|'ok') · foto() · conta(n) · flash()
     Mascote.moldura(temMoldura) · naCamera() · retrato(largura, altura) · reset()
   ===================================================================== */
(() => {
'use strict';
const PASTA = 'assets/mascote/';
const cv = document.getElementById('mascote');
const fala = document.getElementById('mascoteFala');
const dock = document.getElementById('mascoteDock');
const botao = document.getElementById('mascoteFotoBtn');
const palco = document.querySelector('.video-container');
if (!cv || !fala) return;
const X = cv.getContext('2d');
const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- utilidades ---------- */
const rnd = (a, b) => a + Math.random() * (b - a), pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), agora = () => performance.now() / 1000;
class Mola { constructor() { this.p = 0; this.v = 0; } step(alvo, k, c, dt) { const h = dt / 2; for (let i = 0; i < 2; i++) { this.v += (k * (alvo - this.p) - c * this.v) * h; this.p += this.v * h; } } }

/* ---------- frases ---------- */
const FR = {
    chama: ['Oi! Vem tirar foto comigo! 📸', 'Chega mais, a foto é por minha conta!', 'Quem vem ser a estrela da foto? ⭐', 'Eu sou o mascote do SENAI! Prazer! 🤝', 'Faça ✌️ para a câmera e a foto sai!', 'Quer sair na foto comigo? Toque no botão aqui embaixo! 👇'],
    procura: ['Cadê você? Fica de frente para a câmera! 👀', 'Tem alguém aí? 👀', 'Estou procurando um sorriso! 🔎'],
    ajustar: ['Fica ali na área marcada! 👈', 'Um pouquinho mais para o centro! 👈', 'Quase! Ajusta o rosto no quadro 👈'],
    ok: ['Perfeito! Agora é só capturar 📸', 'Ficou ótimo! Toque em Capturar ou faça ✌️', 'Que sorriso! Pode capturar! 💙'],
    cutuca: ['Hihi, cosquinha! 😆', 'Eba! Bora tirar foto! 🎉', 'Eu amo fotos! 💙', 'Olha o charme! 😎'],
    camera: ['Vou sair na foto com você! 🤩', 'Posição de foto! Faz pose também! 💙', 'Cabe nós dois aqui! 😄'],
    pronta: ['Ficou demais! 🎉', 'Que foto linda! 😍', 'Arrasou! ✨'],
    moldura: ['Essa moldura ficou show! ✨', 'Boa escolha! 😎', 'Combinou com você! 💙'],
    passo2: ['Agora escolha uma moldura! 🖼️', 'Escolha a moldura e toque em Continuar!']
};
const ultima = {};
const frase = (k) => { const l = FR[k]; let s, t = 0; do { s = pick(l); } while (s === ultima[k] && l.length > 1 && t++ < 6); ultima[k] = s; return s; };

/* ---------- balão de fala ---------- */
const cab = { x: 0, y: 0 };
function colocaFala() {
    const r = cv.getBoundingClientRect(), w = fala.offsetWidth, h = fala.offsetHeight;
    const cx = r.left + cab.x, L = clamp(cx - w / 2, 8, innerWidth - w - 8);
    fala.style.left = L + 'px';
    fala.style.top = Math.max(8, r.top + cab.y - h - 10) + 'px';
    fala.style.setProperty('--t', clamp(cx - L, 22, w - 22) + 'px');
}
let falaTimer = 0;
function diz(s, ms = 3200) { fala.textContent = s; fala.classList.add('on'); colocaFala(); clearTimeout(falaTimer); falaTimer = setTimeout(() => fala.classList.remove('on'), ms); }

/* ---------- quadros e clipes ---------- */
let META = null; const IMG = {};
let clip = 'parado', pos = 0, dir = 1, fim = null;         // pos = índice (com fração) dentro do clipe
let fadeImg = null, fade = 0, ultimaImg = null;                              // troca de clipe: dissolve curto
function quadros(c) { return META.clipes[c].quadros; }
function setClip(c, aoTerminar) {
    if (!META || !META.clipes[c]) return;
    fim = aoTerminar || null;
    if (c === clip) return;
    const q = quadros(clip);
    fadeImg = IMG[q[Math.min(q.length - 1, Math.round(pos))]] || null; fade = 1;
    clip = c; pos = 0; dir = 1;
    mola.sq.v -= 1.6;
}
function avanca(dt) {
    const C = META.clipes[clip], n = C.quadros.length;
    pos += dir * dt * C.fps;
    if (C.modo === 'uma') {
        if (pos >= n - 1) { pos = n - 1; if (fim) { const f = fim; fim = null; f(); } }
    } else {
        if (pos >= n - 1) { pos = n - 1; dir = -1; }
        if (pos <= 0) { pos = 0; dir = 1; }
    }
}
function imagens() {
    const q = quadros(clip), i0 = Math.floor(pos), fr = pos - i0;
    const a = IMG[q[i0]] || ultimaImg, b = IMG[q[Math.min(q.length - 1, i0 + 1)]] || a;   // quadro ainda carregando: segura o último
    if (a) ultimaImg = a;
    return [a, b, fr];
}

/* ---------- física ---------- */
const mola = { sq: new Mola(), roll: new Mola() };
let jy = 0, jv = 0, noAr = false, t = 0, flashT = 0;
function pula(f = 1) { if (noAr || reduz || lugar === 'camera') return; jv = 1.1 + .5 * f; noAr = true; mola.sq.v += 2.5; }

/* ---------- lugares na tela ---------- */
let lugar = 'painel';              // painel | camera | mini
let querCamera = false;            // botão "Tirar foto comigo" ligado
/* retângulo do mascote dentro da imagem da câmera, em frações do quadro (serve também para a foto) */
function retCamera(cw, ch) {
    const asp = META ? META.w / META.h : .87;
    let h = ch * .64, w = h * asp;
    if (w > cw * .42) { w = cw * .42; h = w / asp; }
    const cx = cw * .79;                                   // ao lado da área do rosto, para não cobrir a pessoa
    const left = clamp(cx - w / 2, 0, cw - w);
    return { x: left / cw, y: (ch - h) / ch, w: w / cw, h: h / ch };
}
function retMini() { const h = clamp(innerHeight * .24, 150, 260); return { left: 10, top: innerHeight - h - 6, width: h * .87, height: h }; }
function alvo() {
    if (lugar === 'mini') return retMini();
    if (lugar === 'camera' && palco && palco.offsetParent) {
        const r = palco.getBoundingClientRect(), f = retCamera(r.width, r.height);
        return { left: r.left + f.x * r.width, top: r.top + f.y * r.height, width: f.w * r.width, height: f.h * r.height };
    }
    if (dock && dock.offsetParent) { const r = dock.getBoundingClientRect(); if (r.width > 40 && r.height > 60) return r; }
    return retMini();
}
let ultimoRet = '';
function posiciona(animar) {
    const r = alvo(), k = [r.left, r.top, r.width, r.height].map(Math.round).join(',');
    if (k === ultimoRet && !animar) return;
    ultimoRet = k;
    if (animar) { cv.classList.add('anim'); clearTimeout(posiciona.t); posiciona.t = setTimeout(() => cv.classList.remove('anim'), 650); }
    cv.dataset.lugar = lugar; fala.dataset.lugar = lugar;
    Object.assign(cv.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
}
function vaiPara(l) { if (l === lugar) return; lugar = l; posiciona(true); atualizaBotao(); }
function atualizaBotao() {
    if (!botao) return;
    botao.classList.toggle('ativo', querCamera);
    botao.setAttribute('aria-pressed', querCamera ? 'true' : 'false');
    botao.innerHTML = querCamera
        ? '<span class="icon" aria-hidden="true">↩️</span> Voltar o mascote para cá'
        : '<span class="icon" aria-hidden="true">🤳</span> Tirar foto comigo';
}

/* ---------- desenho ---------- */
function desenha(ctx, W, H, o) {
    const [a, b, fr] = o.imgs, k = Math.min(W / META.w, H * .97 / META.h);
    const pe = H * .985, px = W / 2 + (o.dx || 0), py = pe - (o.pulo || 0) * META.altura * k * .5;
    if (o.sombra !== false) {
        const R = META.altura * k * .3 * (1 - clamp(o.pulo || 0, 0, 1) * .3), g = ctx.createRadialGradient(0, 0, R * .1, 0, 0, R);
        g.addColorStop(0, 'rgba(0,10,30,.38)'); g.addColorStop(1, 'rgba(0,10,30,0)');
        ctx.save(); ctx.translate(px, pe); ctx.scale(1, .2); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill(); ctx.restore();
    }
    ctx.save(); ctx.translate(px, py); ctx.rotate(o.rot || 0); ctx.scale(o.sx || 1, o.sy || 1);
    const dx = -META.ax * k, dy = -META.ay * k, dw = META.w * k, dh = META.h * k;
    if (a) ctx.drawImage(a, dx, dy, dw, dh);
    if (b && b !== a && fr > .04) { ctx.globalAlpha = fr; ctx.drawImage(b, dx, dy, dw, dh); ctx.globalAlpha = 1; }
    if (o.fade > 0 && o.fadeImg) { ctx.globalAlpha = o.fade; ctx.drawImage(o.fadeImg, dx, dy, dw, dh); ctx.globalAlpha = 1; }
    ctx.restore();
    return { k, px, py };
}
let dpr = 1;
function ajusta() {
    const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return false;
    dpr = Math.min(devicePixelRatio || 1, 2);
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    return true;
}

/* ---------- partículas ---------- */
const CORES = ['#00f0ff', '#0072ff', '#ffffff', '#3b82f6', '#ff2a6d', '#ffd400'], P = [];
function confete(x, y, n = 60) { if (reduz) n = 16; for (let i = 0; i < n; i++) P.push({ k: 'c', x, y, vx: rnd(-360, 360) * dpr, vy: -rnd(250, 900) * dpr, r: rnd(0, 6), vr: rnd(-7, 7), c: CORES[i % 6], l: rnd(1.1, 1.9), L: 1.9 }); }
function estrelas(x, y, n = 10) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), v = rnd(150, 400) * dpr; P.push({ k: 's', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 0, vr: rnd(-3, 3), c: pick(['#00f0ff', '#ffd400', '#ff2a6d']), l: rnd(.5, .9), L: .9, sz: rnd(7, 14) * dpr }); } }
function particulas(dt) {
    for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i]; p.l -= dt; if (p.l <= 0) { P.splice(i, 1); continue; }
        if (p.k === 'c') p.vy += 1400 * dpr * dt; else { p.vx *= .93; p.vy *= .93; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
        X.save(); X.translate(p.x, p.y); X.rotate(p.r); X.globalAlpha = clamp(p.l / (p.L * .45), 0, 1); X.fillStyle = p.c;
        if (p.k === 'c') X.fillRect(-6 * dpr, -3.5 * dpr, 12 * dpr, 7 * dpr);
        else { const s = p.sz; X.beginPath(); for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4, rr = j % 2 ? s * .3 : s; X.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } X.closePath(); X.fill(); }
        X.restore();
    }
}

/* ---------- comportamento ---------- */
let passo = 1, ocupado = 0, contando = false, estadoRosto = 'nenhum', desdeRosto = agora(), ultimaFalaRosto = 0, proxIdle = agora() + 5;
const bloqueia = (s) => { ocupado = agora() + s; };
const livre = () => !contando && agora() > ocupado;
/* pose "de descanso" conforme o lugar e o passo */
function poseBase() {
    if (lugar === 'camera') return 'parado';
    if (passo === 1) return estadoRosto === 'nenhum' && agora() - desdeRosto > 6 ? 'procura' : 'parado';
    return 'parado';
}
function fazPose(c, seg, txt, ms) { setClip(c); bloqueia(seg); if (txt) diz(txt, ms || seg * 1000 + 400); }
function diretor() {
    const n = agora();
    if (!livre()) return;
    if (clip !== poseBase() && n > ocupado + .05 && !['clique'].includes(clip)) setClip(poseBase());
    if (n < proxIdle) return;
    proxIdle = n + rnd(6, 10);
    if (lugar === 'camera') { const p = pick(['aceno', 'festa', 'coracao']); fazPose(p, 2.6, frase('camera')); return; }
    if (passo === 1) {
        if (estadoRosto === 'nenhum') { const r = Math.random(); if (r < .55) { fazPose('aceno', 3, frase('chama')); pula(.6); } else fazPose('procura', 3, frase('procura')); }
        else if (Math.random() < .5) { fazPose('aceno', 2.4, frase('chama')); }
    } else if (passo === 2) { if (Math.random() < .5) fazPose('coracao', 2.4); else fazPose('aceno', 2.2); }
    else if (passo === 3) { fazPose('festa', 2, 'Escaneie o QR Code! 📱'); }
}

let antes = agora();
function quadro() {
    requestAnimationFrame(quadro);
    const n = agora(), dt = Math.min(n - antes || .016, .05); antes = n; t += dt;
    if (!META) return;
    posiciona(false);
    if (!ajusta()) return;
    const W = cv.width, H = cv.height;
    mola.sq.step(0, 170, 9, dt); mola.roll.step(0, 60, 7, dt); mola.roll.p = clamp(mola.roll.p, -.1, .1);
    if (noAr) { jy += jv * dt; jv -= 6.5 * dt; if (jy <= 0) { jy = 0; noAr = false; mola.sq.v -= 2.5; jv = 0; } }
    avanca(dt);
    if (fade > 0) fade = Math.max(0, fade - dt * 4.5);
    const parado = lugar === 'camera';
    const sq = mola.sq.p * .05, resp = parado ? 0 : Math.sin(t * 2.1) * .007;
    X.clearRect(0, 0, W, H); X.imageSmoothingEnabled = true; X.imageSmoothingQuality = 'high';
    const d = desenha(X, W, H, {
        imgs: imagens(), fade, fadeImg, pulo: jy,
        dx: parado ? 0 : Math.sin(t * .45) * W * .012,
        rot: parado ? 0 : mola.roll.p + Math.sin(t * 1.1) * .006,
        sx: 1 - sq * .5 - resp * .5, sy: 1 + sq + resp
    });
    if (flashT > 0) {
        const cy = d.py - META.altura * d.k * .62, R = META.altura * d.k * .5, g = X.createRadialGradient(d.px, cy, 2, d.px, cy, R);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        X.globalAlpha = Math.min(1, flashT); X.fillStyle = g; X.beginPath(); X.arc(d.px, cy, R, 0, 7); X.fill(); X.globalAlpha = 1;
        flashT = Math.max(0, flashT - dt * 2.4);
    }
    particulas(dt);
    cab.x = d.px / dpr; cab.y = (d.py - META.altura * d.k * 1.02) / dpr;
    caixa = { x0: (d.px - META.altura * d.k * .3) / dpr, x1: (d.px + META.altura * d.k * .3) / dpr, y0: cab.y, y1: d.py / dpr };
    if (fala.classList.contains('on')) colocaFala();
    diretor();
}
let caixa = { x0: 0, x1: 0, y0: 0, y1: 0 };

/* ---------- toque no mascote ---------- */
cv.addEventListener('pointerdown', (e) => {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (x < caixa.x0 || x > caixa.x1 || y < caixa.y0 || y > caixa.y1 || contando) return;
    fazPose(pick(['festa', 'coracao', 'aceno']), 2.4, frase('cutuca'), 2600);
    pula(1); mola.roll.v += pick([-1, 1]) * 2.2;
    estrelas(cab.x * dpr, (cab.y + 50) * dpr, 10);
});

/* ---------- botão "Tirar foto comigo" ---------- */
if (botao) botao.addEventListener('click', () => {
    if (contando || passo !== 1) return;
    querCamera = !querCamera;
    if (querCamera) {
        vaiPara('camera');
        setTimeout(() => { fazPose('festa', 1.6); diz('Opa! Vou sair na foto com você! 🤩', 3000); }, 500);
        setTimeout(() => { if (lugar === 'camera' && !contando) { fazPose('coracao', 3, 'Fica do meu lado e capture! 📸', 3200); } }, 2200);
    } else {
        vaiPara('painel');
        setTimeout(() => { fazPose('aceno', 2.4, 'Voltei! Quando quiser, é só chamar 😄'); }, 500);
    }
    atualizaBotao();
});

/* ---------- API usada pelo app.js ---------- */
window.Mascote = {
    passo(n) {
        const antes = passo; passo = n; ocupado = 0; proxIdle = agora() + 5;
        if (n === 1) {
            contando = false;
            vaiPara(querCamera ? 'camera' : 'painel');
            if (antes !== 1) setTimeout(() => { fazPose('aceno', 2.6, querCamera ? 'Bora mais uma juntos? 😄' : 'Bora mais uma? 😄'); pula(.8); }, 500);
        } else {
            vaiPara('mini');
            if (n === 2 && antes === 1) setTimeout(() => diz(frase('passo2'), 3200), 3200);
            if (n === 3) setTimeout(() => { fazPose('festa', 2.4, 'Escaneie o QR Code e leve sua foto! 📱', 4000); pula(1); }, 400);
            if (n === 4) diz('Só um instante... ⏳', 2500);
        }
    },
    rosto(estado) {
        if (passo !== 1 || contando) return;
        const n = agora();
        if (estado !== estadoRosto) { estadoRosto = estado; desdeRosto = n; } else return;
        if (n - ultimaFalaRosto < 4 || !livre()) return;
        ultimaFalaRosto = n;
        if (estado === 'ok') fazPose('coracao', 2.4, frase('ok'));
        else if (estado === 'ajustar') fazPose('aponta', 2.8, frase('ajustar'));
    },
    foto() {
        contando = true; ocupado = 0;
        if (lugar === 'camera') { setClip('coracao'); diz('Pose! Faz um coração comigo! 💙', 2500); }
        else { setClip('camera'); diz('Olha o passarinho! 📸', 2500); }
    },
    conta(n) { mola.sq.v -= n > 1 ? 1.4 : 2.4; diz(n > 1 ? String(n) : 'Sorria! 😁', 950); },
    flash() {
        const naFoto = lugar === 'camera';
        if (!naFoto) { flashT = 1; setClip('clique'); }
        confete(cab.x * dpr, (cab.y + 70) * dpr, 70);
        setTimeout(() => {
            contando = false;
            fazPose('festa', 2.6); pula(1.2);
            setTimeout(() => diz(naFoto ? 'Saímos lindos! 🎉' : frase('pronta'), 3000), 550);
        }, naFoto ? 250 : 520);
    },
    moldura(tem) { if (!livre()) return; fazPose(tem ? 'coracao' : 'aceno', 2.4, tem ? frase('moldura') : 'Sem moldura também fica lindo! 😊'); },
    naCamera() { return lugar === 'camera' && !!META; },
    /* desenha o mascote (na pose atual, ou coração se ele não está na câmera) do jeito que aparece na imagem da câmera */
    retrato(largura, altura) {
        if (!META) return null;
        const c = document.createElement('canvas'); c.width = largura; c.height = altura;
        const f = retCamera(largura, altura), w = Math.round(f.w * largura), h = Math.round(f.h * altura);
        const o = document.createElement('canvas'); o.width = w; o.height = h;
        const imgs = lugar === 'camera' ? imagens() : (() => { const q = quadros('coracao'); return [IMG[q[Math.floor(q.length / 2)]], null, 0]; })();
        desenha(o.getContext('2d'), w, h, { imgs });
        c.getContext('2d').drawImage(o, Math.round(f.x * largura), Math.round(f.y * altura));
        return c;
    },
    reset() { querCamera = false; contando = false; atualizaBotao(); }
};

/* ---------- carregamento ---------- */
addEventListener('resize', () => posiciona(false));
atualizaBotao();
fetch(PASTA + 'meta.json').then((r) => r.json()).then((M) => {
    const lista = [...new Set(Object.values(M.clipes).flatMap((c) => c.quadros))];
    /* carrega primeiro o que aparece logo de cara */
    const prim = new Set([...M.clipes.parado.quadros, ...M.clipes.aceno.quadros]);
    const carrega = (n) => new Promise((ok) => { const im = new Image(); im.decoding = 'async'; im.onload = () => { IMG[n] = im; ok(); }; im.onerror = () => ok(); im.src = PASTA + n; });
    return Promise.all(lista.filter((n) => prim.has(n)).map(carrega)).then(() => {
        META = M; clip = 'parado'; cv.classList.add('pronto');
        requestAnimationFrame(quadro);
        setTimeout(() => { fazPose('aceno', 3, FR.chama[0], 3500); pula(1); }, 600);
        return Promise.all(lista.filter((n) => !prim.has(n)).map(carrega));
    });
}).catch((e) => console.warn('Mascote não carregou:', e));
})();
