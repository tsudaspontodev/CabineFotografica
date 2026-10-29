<?php
// Painel do administrador: login, troca de senha e painel animado (atualiza sozinho)
require __DIR__ . '/lib.php';
session_set_cookie_params(['httponly' => true, 'samesite' => 'Strict']);
session_start();
$_SESSION['csrf'] ??= bin2hex(random_bytes(16));
$h = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
$admin = carregar_admin();
$msg = ''; $erro = '';
$csrf_ok = fn() => hash_equals($_SESSION['csrf'], (string)($_POST['csrf'] ?? ''));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $acao = $_POST['acao'] ?? '';
    if (!$csrf_ok()) { $erro = 'Sessão expirada. Tente de novo.'; }
    elseif ($acao === 'login') {
        if (($_SESSION['bloqueado_ate'] ?? 0) > time()) {
            $erro = 'Muitas tentativas. Aguarde um minuto.';
        } elseif (hash_equals((string)$admin['usuario'], (string)($_POST['usuario'] ?? ''))
               && password_verify((string)($_POST['senha'] ?? ''), (string)$admin['senha_hash'])) {
            session_regenerate_id(true);
            $_SESSION['admin'] = true; $_SESSION['falhas'] = 0;
            header('Location: index.php'); exit;
        } else {
            $_SESSION['falhas'] = ($_SESSION['falhas'] ?? 0) + 1;
            if ($_SESSION['falhas'] >= 5) { $_SESSION['bloqueado_ate'] = time() + 60; $_SESSION['falhas'] = 0; }
            sleep(1);
            $erro = 'Usuário ou senha incorretos.';
        }
    } elseif (!empty($_SESSION['admin']) && $acao === 'sair') {
        session_destroy(); header('Location: index.php'); exit;
    } elseif (!empty($_SESSION['admin']) && $acao === 'senha') {
        $nova = (string)($_POST['nova'] ?? '');
        if (!password_verify((string)($_POST['atual'] ?? ''), (string)$admin['senha_hash'])) $erro = 'Senha atual incorreta.';
        elseif (mb_strlen($nova) < 6) $erro = 'A nova senha precisa de 6 caracteres ou mais.';
        else {
            $admin['senha_hash'] = password_hash($nova, PASSWORD_DEFAULT); $admin['trocar'] = 0;
            salvar_admin($admin); $msg = 'Senha alterada com sucesso.';
        }
    }
}
$logado = !empty($_SESSION['admin']);

// Exportar CSV (uma linha por pessoa atendida)
if ($logado && ($_GET['csv'] ?? '') === '1') {
    $sess = carregar_sessoes(desde_periodo(periodo_valido($_GET['periodo'] ?? '7')));
    $seguro = fn($v) => (is_string($v) && $v !== '' && strpbrk($v[0], "=+-@\t\r")) ? "'" . $v : $v;
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="estatisticas-' . date('Y-m-d') . '.csv"');
    $o = fopen('php://output', 'w'); fwrite($o, "\xEF\xBB\xBF");
    fputcsv($o, ['data', 'dia', 'mes', 'ano', 'hora', 'fotos', 'refeitas', 'timer_s', 'moldura', 'filtro', 'brilho',
                 'contraste', 'saturacao', 'selo', 'perfil', 'envio', 'concluido', 'abandonou_no_passo', 'erros'], ';');
    foreach ($sess as $r) {
        $t = strtotime($r['criado_em']);
        fputcsv($o, [date('d/m/Y', $t), date('d', $t), date('m', $t), date('Y', $t), date('H:i', $t), $r['fotos'], $r['refeitas'],
            $r['timer_s'], $seguro($r['moldura']), $r['filtro'], $r['brilho'], $r['contraste'], $r['saturacao'], $r['selo'],
            $seguro($r['perfil']), $r['metodo'], $r['concluido'], $r['passo_final'], $r['erros']], ';');
    }
    exit;
}
$periodo = periodo_valido($_GET['periodo'] ?? '7');
?><!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Painel · Dashboard Administrativo</title>
<style>
:root{--bg:#f2f5fa;--card:#fff;--tx:#10213d;--mut:#5b6b85;--az:#0b4ea2;--az2:#7fb0ea;--ver:#d7261e;--ok:#1a9c4a;--bd:#d9e1ee;--sombra:0 6px 18px rgba(11,78,162,.14)}
@media (prefers-color-scheme:dark){:root{--bg:#0c1626;--card:#13233b;--tx:#e8eefa;--mut:#9fb0cc;--az:#5aa2ff;--az2:#2d5a99;--ver:#ff6a60;--ok:#3ddc84;--bd:#25395a;--sombra:0 6px 18px rgba(0,0,0,.4)}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);font:16px/1.45 "Segoe UI",system-ui,sans-serif}
h1,h2{margin:0;font-weight:700}h2{font-size:1.05em}
button,input,select{font:inherit}
.btn{background:var(--az);color:#fff;border:0;border-radius:8px;padding:10px 16px;cursor:pointer;text-decoration:none;display:inline-block;transition:transform .15s,filter .15s}
.btn:hover{filter:brightness(1.1);transform:translateY(-1px)}.btn:active{transform:none}
.btn.sec{background:transparent;color:var(--tx);border:1px solid var(--bd)}
:focus-visible{outline:3px solid var(--az2);outline-offset:2px}
input,select{padding:10px 12px;border:1px solid var(--bd);border-radius:8px;background:var(--card);color:var(--tx);width:100%}
label{display:block;margin:12px 0 4px;color:var(--mut);font-size:.9em}
.erro{color:var(--ver);margin:8px 0 0}.okm{color:var(--ok);margin:8px 0 0}
.login{max-width:360px;margin:12vh auto;background:var(--card);padding:28px;border-radius:12px;border:1px solid var(--bd)}
.login .btn{width:100%;margin-top:16px}
header{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;padding:16px 24px;background:#0b4ea2;color:#fff;position:sticky;top:0;z-index:5}
header .grupo{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0}
header select{width:auto;background:#fff;color:#10213d;border-color:#fff}
header select option{background:#fff;color:#10213d}
header .btn.sec{color:#fff;border-color:rgba(255,255,255,.55)}
.vivo{display:flex;align-items:center;gap:8px;font-size:.9em;opacity:.95}
.dot{width:10px;height:10px;border-radius:50%;background:#3ddc84;animation:pulso 1.6s infinite}
.pausado .dot{background:#ffc94d;animation:none}
@keyframes pulso{0%{box-shadow:0 0 0 0 rgba(61,220,132,.7)}100%{box-shadow:0 0 0 10px rgba(61,220,132,0)}}
main{max-width:1100px;margin:0 auto;padding:20px}
.aviso{background:#fff3cd;color:#5c4400;border-radius:8px;padding:12px 16px;margin-bottom:16px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.kpi,.painel{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:14px;transition:transform .2s,box-shadow .2s}
.kpi:hover,.painel:hover{transform:translateY(-3px);box-shadow:var(--sombra)}
.kpi b{display:block;font-size:2em;line-height:1.1;font-variant-numeric:tabular-nums}
.kpi span{color:var(--mut);font-size:.9em}
.kpi.sobe{animation:sobe .9s}
@keyframes sobe{0%{box-shadow:0 0 0 0 var(--az)}100%{box-shadow:0 0 0 14px transparent}}
.grade{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-top:16px}
.painel{padding:16px;min-width:0}
.painel .topo{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.largo{grid-column:1/-1}
.abas{display:flex;gap:4px;background:var(--bg);padding:3px;border-radius:8px}
.abas button{border:0;background:transparent;color:var(--mut);padding:4px 10px;border-radius:6px;cursor:pointer}
.abas button[aria-pressed=true]{background:var(--az);color:#fff}
.entra{opacity:0;transform:translateY(10px);transition:opacity .5s,transform .5s}
.entra.in{opacity:1;transform:none}
.vazio{color:var(--mut);margin:0;padding:18px;border:1px dashed var(--bd);border-radius:8px;text-align:center}
.barra{display:grid;grid-template-columns:minmax(80px,36%) 1fr auto;gap:8px;align-items:center;margin:4px 0;padding:3px 6px;border-radius:6px;font-size:.95em;cursor:default;transition:background .15s}
.barra:hover{background:var(--bg)}
.barra .n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.barra .t{background:var(--bd);border-radius:5px;height:14px;overflow:hidden}
.barra .t i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--az2),var(--az));border-radius:5px;transition:width .9s cubic-bezier(.2,.8,.2,1)}
.mais{margin-top:6px;background:none;border:0;color:var(--az);cursor:pointer;padding:4px 0}
.colunas{display:flex;align-items:flex-end;gap:4px;height:170px;overflow-x:auto;padding-bottom:2px}
.col{flex:1;min-width:30px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;font-size:.72em;color:var(--mut);cursor:default}
.col i{display:block;width:100%;height:0;min-height:2px;background:linear-gradient(0deg,var(--az),var(--az2));border-radius:4px 4px 0 0;transition:height .9s cubic-bezier(.2,.8,.2,1),filter .15s}
.col:hover i{filter:brightness(1.25)}.col:hover{color:var(--tx)}
svg{display:block;width:100%;height:auto;overflow:visible}
.eixo{stroke:var(--bd);stroke-width:1}.rot{fill:var(--mut);font-size:11px}
.linha{fill:none;stroke:var(--az);stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
.pt{fill:var(--card);stroke:var(--az);stroke-width:3;opacity:0;transition:opacity .15s}
.g:hover .pt{opacity:1}.g:hover .guia{opacity:1}
.guia{stroke:var(--az2);stroke-dasharray:4 4;opacity:0;transition:opacity .15s}
.hit{fill:transparent}
.rosca{display:flex;gap:20px;align-items:center;flex-wrap:wrap;justify-content:center}
.rosca circle.seg{fill:none;stroke-width:22;transition:stroke-dasharray 1s cubic-bezier(.2,.8,.2,1),stroke-width .2s,opacity .2s}
.rosca svg{width:170px;flex:none}
.rosca.foco circle.seg{opacity:.35}.rosca.foco circle.seg.on{opacity:1;stroke-width:27}
.leg div{display:flex;gap:8px;align-items:center;padding:4px 8px;border-radius:6px;cursor:default}
.leg div:hover{background:var(--bg)}.leg i{width:12px;height:12px;border-radius:3px;display:inline-block}
.centro{fill:var(--tx);font-size:26px;font-weight:700;text-anchor:middle}.centro2{fill:var(--mut);font-size:11px;text-anchor:middle}
.tab{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:.92em}
th,td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--bd);white-space:nowrap}
th{color:var(--mut);font-weight:600}
tr.nova{animation:nova 2.4s}
@keyframes nova{0%{background:var(--az2);transform:translateX(-14px);opacity:0}15%{opacity:1;transform:none}100%{background:transparent}}
#tip{position:fixed;z-index:20;pointer-events:none;background:#10213d;color:#fff;padding:6px 10px;border-radius:6px;font-size:.85em;opacity:0;transition:opacity .12s;max-width:260px;box-shadow:var(--sombra)}
#aviso-toast{position:fixed;right:20px;bottom:20px;background:var(--az);color:#fff;padding:12px 18px;border-radius:10px;box-shadow:var(--sombra);transform:translateY(80px);opacity:0;transition:.4s;z-index:30}
#aviso-toast.mostra{transform:none;opacity:1}
details{margin-top:20px}summary{cursor:pointer;color:var(--az)}details form{max-width:340px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.entra{opacity:1;transform:none}}
</style>
</head>
<body>
<?php if (!$logado): ?>
<form class="login" method="post" action="index.php">
  <h1>Painel do administrador</h1>
  <input type="hidden" name="acao" value="login">
  <input type="hidden" name="csrf" value="<?= $h($_SESSION['csrf']) ?>">
  <label for="usuario">Usuário</label>
  <input id="usuario" name="usuario" autocomplete="username" required autofocus>
  <label for="senha">Senha</label>
  <input id="senha" name="senha" type="password" autocomplete="current-password" required>
  <?php if ($erro): ?><p class="erro" role="alert"><?= $h($erro) ?></p><?php endif; ?>
  <button class="btn">Entrar</button>
</form>
</body></html>
<?php exit; endif; ?>
<header>
  <h1>Sua foto Mundo SENAI · Estatísticas</h1>
  <div class="grupo">
    <div class="vivo" id="vivo"><span class="dot"></span><span id="vivoTxt">Ao vivo</span></div>
    <select id="periodo" aria-label="Período">
      <?php foreach (['hoje' => 'Hoje', '7' => 'Últimos 7 dias', '30' => 'Últimos 30 dias', 'mes' => 'Este mês', 'tudo' => 'Tudo'] as $k => $v): ?>
      <option value="<?= $h($k) ?>"<?= $k === $periodo ? ' selected' : '' ?>><?= $h($v) ?></option><?php endforeach; ?>
    </select>
    <button class="btn sec" id="pausar" type="button">Pausar</button>
    <a class="btn sec" id="csv" href="index.php?csv=1&amp;periodo=<?= $h($periodo) ?>">Exportar CSV</a>
    <form method="post" action="index.php" style="margin:0">
      <input type="hidden" name="acao" value="sair"><input type="hidden" name="csrf" value="<?= $h($_SESSION['csrf']) ?>">
      <button class="btn sec">Sair</button>
    </form>
  </div>
</header>
<main>
  <?php if (!empty($admin['trocar'])): ?><div class="aviso">Você ainda usa a senha padrão. Troque-a em “Trocar senha” no fim da página.</div><?php endif; ?>
  <?php if ($msg): ?><p class="okm" role="status"><?= $h($msg) ?></p><?php endif; ?>
  <?php if ($erro): ?><p class="erro" role="alert"><?= $h($erro) ?></p><?php endif; ?>
  <div class="kpis" id="kpis"></div>
  <div class="grade" id="grade">
    <section class="painel entra"><div class="topo"><h2>Quando as fotos são tiradas</h2><div class="abas" id="abasTempo">
      <button type="button" data-k="por_dia" aria-pressed="true">Dia</button><button type="button" data-k="por_mes" aria-pressed="false">Mês</button><button type="button" data-k="por_semana" aria-pressed="false">Semana</button></div></div><div id="tempo"></div></section>
    <section class="painel entra"><div class="topo"><h2>Fotos por horário</h2></div><div id="horas"></div></section>
    <section class="painel entra"><div class="topo"><h2>Como receberam a foto</h2></div><div id="metodos"></div></section>
    <section class="painel entra"><div class="topo"><h2>Molduras mais usadas</h2></div><div id="molduras"></div></section>
    <section class="painel entra"><div class="topo"><h2>Filtros usados</h2></div><div id="filtros"></div></section>
    <section class="painel entra"><div class="topo"><h2>Timer usado</h2></div><div id="timers"></div></section>
    <section class="painel entra"><div class="topo"><h2>Perfis profissionais</h2></div><div id="perfis"></div></section>
    <section class="painel entra"><div class="topo"><h2>Onde desistiram</h2></div><div id="abandono"></div></section>
    <section class="painel largo entra"><div class="topo"><h2>Últimas fotos</h2></div><div class="tab" id="ultimas"></div></section>
  </div>
  <details>
    <summary>Trocar senha</summary>
    <form method="post" action="index.php">
      <input type="hidden" name="acao" value="senha"><input type="hidden" name="csrf" value="<?= $h($_SESSION['csrf']) ?>">
      <label for="atual">Senha atual</label><input id="atual" name="atual" type="password" autocomplete="current-password" required>
      <label for="nova">Nova senha (mínimo 6 caracteres)</label><input id="nova" name="nova" type="password" autocomplete="new-password" required>
      <button class="btn" style="margin-top:12px">Salvar senha</button>
    </form>
  </details>
</main>
<div id="tip" role="tooltip"></div>
<div id="aviso-toast" role="status" aria-live="polite"></div>

<script>
(() => {
const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const sv = (t, a = {}) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
const SEM_ANIM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CORES = ['#0b4ea2', '#d7261e', '#2f9e8f', '#e0a100', '#7a4fd1', '#4aa3ff'];
let periodo = <?= json_encode($periodo) ?>, abaTempo = 'por_dia', dados = null, cache = {}, pausado = false, ultimaAtualiz = 0, primeira = true;

// ----- tooltip (mouse e teclado) -----
const tip = $('tip');
document.addEventListener('mousemove', e => {
  const t = e.target.closest && e.target.closest('[data-tip]');
  if (!t) { tip.style.opacity = 0; return; }
  tip.textContent = t.dataset.tip; tip.style.opacity = 1;
  tip.style.left = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8) + 'px';
  tip.style.top = (e.clientY + 16) + 'px';
});
document.addEventListener('mouseleave', () => tip.style.opacity = 0);

// ----- números que "sobem" -----
function contar(e, ate, fmt = v => Math.round(v)) {
  const de = e._v ?? 0; e._v = ate;
  if (SEM_ANIM || de === ate) { e.textContent = fmt(ate); return; }
  const ini = performance.now(), dur = 800;
  (function f(t) {
    const p = Math.min(1, (t - ini) / dur), v = de + (ate - de) * (1 - Math.pow(1 - p, 3));
    e.textContent = fmt(v); if (p < 1) requestAnimationFrame(f);
  })(ini);
}
function toast(txt) {
  const t = $('aviso-toast'); t.textContent = txt; t.classList.add('mostra');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('mostra'), 4000);
}

// ----- KPIs -----
const KPIS = [['fotos', 'Fotos tiradas'], ['sessoes', 'Pessoas atendidas'], ['concluidas', 'Envios concluídos'],
  ['taxa', 'Taxa de conclusão', v => Math.round(v) + '%'], ['refeitas', 'Fotos refeitas'], ['tempo_medio', 'Tempo médio até enviar', v => Math.round(v) + ' s'], ['erros', 'Erros de envio']];
function kpis(t) {
  const box = $('kpis');
  if (!box.children.length) KPIS.forEach(([k, r]) => { const c = el('div', 'kpi entra'); c.id = 'k_' + k; c.append(el('b', null, '0'), el('span', null, r)); box.append(c); });
  KPIS.forEach(([k, , fmt]) => {
    const c = $('k_' + k), b = c.firstChild, v = t[k];
    if (v == null) { b.textContent = '—'; b._v = 0; return; }
    if (b._v != null && v > b._v && !primeira) { c.classList.remove('sobe'); void c.offsetWidth; c.classList.add('sobe'); }
    contar(b, +v, fmt);
  });
}

// ----- barras horizontais -----
function barras(id, lista, top = 5) {
  const box = $(id);
  const chave = JSON.stringify(lista) + box.dataset.todos;
  if (cache[id] === chave) return; cache[id] = chave;
  box.replaceChildren();
  if (!lista.length) { box.append(el('p', 'vazio', 'Ainda sem dados.')); return; }
  const todos = box.dataset.todos === '1', soma = lista.reduce((s, d) => s + d.total, 0), max = lista[0].total || 1;
  (todos ? lista : lista.slice(0, top)).forEach(d => {
    const l = el('div', 'barra'), t = el('div', 't'), i = el('i');
    l.dataset.tip = `${d.nome}: ${d.total} (${Math.round(100 * d.total / soma)}%)`;
    t.append(i); l.append(el('span', 'n', d.nome), t, el('span', null, `${d.total} · ${Math.round(100 * d.total / soma)}%`)); box.append(l);
    requestAnimationFrame(() => requestAnimationFrame(() => i.style.width = (100 * d.total / max) + '%'));
  });
  if (lista.length > top) {
    const b = el('button', 'mais', todos ? 'Ver menos' : `Ver todos (${lista.length})`); b.type = 'button';
    b.onclick = () => { box.dataset.todos = todos ? '0' : '1'; cache[id] = null; barras(id, lista, top); };
    box.append(b);
  }
}

// ----- colunas (dia / mês / semana) -----
function tempo() {
  const lista = dados[abaTempo], box = $('tempo'), chave = abaTempo + JSON.stringify(lista);
  if (cache.tempo === chave) return; cache.tempo = chave;
  box.replaceChildren();
  if (!lista.length || Math.max(...lista.map(d => d.total)) <= 0) { box.append(el('p', 'vazio', 'Ainda sem dados.')); return; }
  const max = Math.max(...lista.map(d => d.total)), c = el('div', 'colunas');
  lista.forEach(d => {
    const col = el('div', 'col'), i = el('i');
    col.dataset.tip = `${d.nome}: ${d.total} foto(s)`; col.tabIndex = 0;
    col.append(el('span', null, d.total), i, el('span', null, d.nome)); c.append(col);
    requestAnimationFrame(() => requestAnimationFrame(() => i.style.height = (100 * d.total / max) + '%'));
  });
  box.append(c);
}
$('abasTempo').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  abaTempo = b.dataset.k; cache.tempo = null;
  $('abasTempo').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
  if (dados) tempo();
});

// ----- gráfico de linha por horário -----
function horas() {
  const lista = dados.por_hora, box = $('horas'), chave = JSON.stringify(lista);
  if (cache.horas === chave) return; cache.horas = chave;
  box.replaceChildren();
  const max = Math.max(...lista.map(d => d.total));
  if (max <= 0) { box.append(el('p', 'vazio', 'Ainda sem dados.')); return; }
  const W = 600, H = 220, pl = 30, pr = 10, pt = 14, pb = 28, iw = W - pl - pr, ih = H - pt - pb;
  const x = i => pl + iw * i / 23, y = v => pt + ih - ih * v / max;
  const s = sv('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Fotos por horário' });
  const gid = 'grad' + Date.now();
  const defs = sv('defs'), lg = sv('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
  lg.append(sv('stop', { offset: '0%', 'stop-color': CORES[0], 'stop-opacity': .35 }), sv('stop', { offset: '100%', 'stop-color': CORES[0], 'stop-opacity': 0 }));
  defs.append(lg); s.append(defs);
  for (let k = 0; k <= 4; k++) {
    const v = max * k / 4, yy = y(v);
    s.append(sv('line', { class: 'eixo', x1: pl, x2: W - pr, y1: yy, y2: yy }));
    const r = sv('text', { class: 'rot', x: pl - 6, y: yy + 4, 'text-anchor': 'end' }); r.textContent = Math.round(v); s.append(r);
  }
  [0, 6, 12, 18, 23].forEach(h => { const r = sv('text', { class: 'rot', x: x(h), y: H - 8, 'text-anchor': 'middle' }); r.textContent = h + 'h'; s.append(r); });
  const pts = lista.map((d, i) => [x(i), y(d.total)]);
  const dLinha = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = sv('path', { d: dLinha + ` L${x(23)} ${pt + ih} L${x(0)} ${pt + ih} Z`, fill: `url(#${gid})`, style: 'opacity:0;transition:opacity 1s .6s' });
  const linha = sv('path', { class: 'linha', d: dLinha });
  s.append(area, linha);
  lista.forEach((d, i) => {
    const g = sv('g', { class: 'g', 'data-tip': `${d.nome}: ${d.total} foto(s)` });
    g.append(sv('rect', { class: 'hit', x: x(i) - iw / 46, y: pt, width: iw / 23, height: ih }),
      sv('line', { class: 'guia', x1: x(i), x2: x(i), y1: pt, y2: pt + ih }),
      sv('circle', { class: 'pt', cx: x(i), cy: y(d.total), r: 5 }));
    s.append(g);
  });
  box.append(s);
  const L = linha.getTotalLength ? linha.getTotalLength() : 0;
  if (!SEM_ANIM && L) {
    linha.style.strokeDasharray = L; linha.style.strokeDashoffset = L;
    requestAnimationFrame(() => requestAnimationFrame(() => { linha.style.transition = 'stroke-dashoffset 1.4s ease'; linha.style.strokeDashoffset = 0; }));
  }
  requestAnimationFrame(() => area.style.opacity = 1);
}

// ----- rosca (QR x WhatsApp) -----
function rosca() {
  const lista = dados.metodos, box = $('metodos'), chave = JSON.stringify(lista);
  if (cache.metodos === chave) return; cache.metodos = chave;
  box.replaceChildren();
  const soma = lista.reduce((s, d) => s + d.total, 0);
  if (!soma) { box.append(el('p', 'vazio', 'Ainda sem envios concluídos.')); return; }
  const wrap = el('div', 'rosca'), s = sv('svg', { viewBox: '0 0 170 170', role: 'img', 'aria-label': 'Como receberam a foto' });
  const R = 62, C = 2 * Math.PI * R; let acum = 0;
  const leg = el('div', 'leg'), segs = [];
  lista.forEach((d, i) => {
    const f = d.total / soma, cor = CORES[i % CORES.length];
    const c = sv('circle', { class: 'seg', cx: 85, cy: 85, r: R, stroke: cor, 'stroke-dasharray': `0 ${C}`, 'stroke-dashoffset': -acum * C, transform: 'rotate(-90 85 85)', 'data-tip': `${d.nome}: ${d.total} (${Math.round(f * 100)}%)` });
    s.append(c); segs.push([c, f * C]); acum += f;
    const l = el('div'), q = el('i'); q.style.background = cor;
    l.append(q, el('span', null, `${d.nome}: ${d.total} (${Math.round(f * 100)}%)`)); leg.append(l);
    const on = v => { wrap.classList.toggle('foco', v); c.classList.toggle('on', v); };
    l.onmouseenter = () => on(true); l.onmouseleave = () => on(false); c.onmouseenter = () => on(true); c.onmouseleave = () => on(false);
  });
  const n = sv('text', { class: 'centro', x: 85, y: 88 }); n.textContent = soma;
  const n2 = sv('text', { class: 'centro2', x: 85, y: 106 }); n2.textContent = 'envios';
  s.append(n, n2); wrap.append(s, leg); box.append(wrap);
  requestAnimationFrame(() => requestAnimationFrame(() => segs.forEach(([c, len]) => c.setAttribute('stroke-dasharray', `${Math.max(0, len - 2)} ${C}`))));
}

// ----- tabela -----
let vistas = new Set();
function ultimas() {
  const lista = dados.ultimas, box = $('ultimas'), chave = JSON.stringify(lista);
  if (cache.ultimas === chave) return; cache.ultimas = chave;
  box.replaceChildren();
  if (!lista.length) { box.append(el('p', 'vazio', 'Nenhuma foto ainda. Tire uma foto no app e ela aparece aqui sozinha.')); return; }
  const t = el('table'), cab = el('tr');
  ['Data', 'Hora', 'Moldura', 'Filtro', 'Timer', 'Perfil', 'Envio'].forEach(x => cab.append(el('th', null, x))); t.append(cab);
  const novas = new Set();
  lista.forEach(r => {
    const k = [r.data, r.hora, r.moldura, r.envio].join('|'), tr = el('tr');
    if (!primeira && !vistas.has(k)) tr.className = 'nova';
    novas.add(k);
    [r.data, r.hora, r.moldura, r.filtro, r.timer, r.perfil, r.envio].forEach(x => tr.append(el('td', null, x))); t.append(tr);
  });
  vistas = novas; box.append(t);
}

// ----- carregar e atualizar -----
async function carregar(recomecar) {
  if (recomecar) { cache = {}; primeira = true; $('kpis').replaceChildren(); vistas = new Set(); }
  try {
    const r = await fetch('dados.php?periodo=' + encodeURIComponent(periodo), { cache: 'no-store' });
    if (r.status === 401) { location.reload(); return; }
    const novo = await r.json(), antes = dados ? dados.totais.fotos : null;
    dados = novo; ultimaAtualiz = Date.now();
    kpis(dados.totais); tempo(); horas(); rosca();
    barras('molduras', dados.molduras); barras('filtros', dados.filtros); barras('timers', dados.timers);
    barras('perfis', dados.perfis); barras('abandono', dados.abandono); ultimas();
    if (antes !== null && dados.totais.fotos > antes) toast('📸 ' + (dados.totais.fotos - antes) + ' nova(s) foto(s) registrada(s)!');
    if (primeira) document.querySelectorAll('.entra').forEach((e, i) => setTimeout(() => e.classList.add('in'), SEM_ANIM ? 0 : 60 * i));
    primeira = false;
  } catch (e) { $('vivoTxt').textContent = 'Sem conexão com o servidor'; }
}
$('periodo').onchange = e => {
  periodo = e.target.value; $('csv').href = 'index.php?csv=1&periodo=' + periodo;
  history.replaceState(null, '', '?periodo=' + periodo); carregar(true);
};
$('pausar').onclick = e => { pausado = !pausado; e.target.textContent = pausado ? 'Retomar' : 'Pausar'; $('vivo').classList.toggle('pausado', pausado); if (!pausado) carregar(); };
setInterval(() => { if (!pausado && !document.hidden) carregar(); }, 8000);
setInterval(() => {
  if (!ultimaAtualiz) return;
  const s = Math.round((Date.now() - ultimaAtualiz) / 1000);
  $('vivoTxt').textContent = pausado ? 'Pausado' : (s < 3 ? 'Ao vivo' : `Ao vivo · atualizado há ${s}s`);
}, 1000);
carregar(true);
})();
</script>
</body>
</html>
