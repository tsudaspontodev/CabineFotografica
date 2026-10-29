<?php
// Funções comuns. Sem banco de dados: tudo fica em arquivos de texto na pasta admin/data/
date_default_timezone_set('America/Sao_Paulo');
const DIR_DADOS = __DIR__ . '/data';
const CAMPOS = ['timer_s', 'moldura', 'filtro', 'brilho', 'contraste', 'saturacao', 'selo', 'perfil', 'metodo'];

function preparar_pasta(): void {
    if (!is_dir(DIR_DADOS)) mkdir(DIR_DADOS, 0775, true);
    $h = DIR_DADOS . '/.htaccess';   // impede abrir os arquivos de dados pelo navegador
    if (!file_exists($h)) file_put_contents($h,
        "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nOrder deny,allow\nDeny from all\n</IfModule>\n");
}

// Uma linha por evento, em um arquivo por mês (ex.: data/2026-10.log)
function gravar_evento(array $linha): void {
    preparar_pasta();
    $f = fopen(DIR_DADOS . '/' . date('Y-m') . '.log', 'ab');
    if (!$f) return;
    flock($f, LOCK_EX);
    fwrite($f, json_encode($linha, JSON_UNESCAPED_UNICODE) . "\n");
    flock($f, LOCK_UN);
    fclose($f);
}

// Junta os eventos de cada pessoa (sessão) em um único registro
function carregar_sessoes(string $desde): array {
    preparar_pasta();
    $s = [];
    $arquivos = glob(DIR_DADOS . '/*.log') ?: [];
    sort($arquivos);
    foreach ($arquivos as $a) {
        if (basename($a, '.log') < substr($desde, 0, 7)) continue;
        $h = fopen($a, 'rb');
        if (!$h) continue;
        while (($lin = fgets($h)) !== false) {
            $e = json_decode($lin, true);
            if (!is_array($e) || empty($e['sid'])) continue;
            $id = $e['sid'];
            if (!isset($s[$id])) $s[$id] = ['sid' => $id, 'criado_em' => $e['ts'], 'atualizado_em' => $e['ts'],
                'fotos' => 0, 'refeitas' => 0, 'erros' => 0, 'concluido' => 0, 'passo_final' => null,
                'timer_s' => null, 'moldura' => null, 'filtro' => null, 'brilho' => null, 'contraste' => null,
                'saturacao' => null, 'selo' => null, 'perfil' => null, 'metodo' => null];
            $r = &$s[$id];
            foreach (CAMPOS as $c) if (isset($e[$c])) $r[$c] = $e[$c];
            $r['atualizado_em'] = $e['ts'];
            switch ($e['evento'] ?? '') {
                case 'captura':  $r['fotos']++; break;
                case 'refeita':  $r['refeitas']++; break;
                case 'erro':     $r['erros']++; break;
                case 'concluir': $r['concluido'] = 1; break;
                case 'abandono': if (!$r['concluido'] && isset($e['passo_final'])) $r['passo_final'] = $e['passo_final']; break;
            }
            unset($r);
        }
        fclose($h);
    }
    return array_filter($s, fn($r) => $r['criado_em'] >= $desde && $r['fotos'] > 0);
}

// Login do administrador (arquivo data/admin.json; senha guardada com hash)
function carregar_admin(): array {
    preparar_pasta();
    $f = DIR_DADOS . '/admin.json';
    if (!file_exists($f)) {   // primeiro acesso: admin / senai123
        salvar_admin(['usuario' => 'admin', 'senha_hash' => password_hash('senai123', PASSWORD_DEFAULT), 'trocar' => 1]);
    }
    return json_decode((string)file_get_contents($f), true) ?: [];
}
function salvar_admin(array $a): void {
    preparar_pasta();
    file_put_contents(DIR_DADOS . '/admin.json', json_encode($a), LOCK_EX);
}

// ---------- Estatísticas para o painel ----------
function periodo_valido(string $p): string { return in_array($p, ['hoje', 'mes', '7', '30', 'tudo'], true) ? $p : '7'; }
function desde_periodo(string $p): string {
    return match ($p) {
        'hoje' => date('Y-m-d 00:00:00'),
        'mes'  => date('Y-m-01 00:00:00'),
        '30'   => date('Y-m-d 00:00:00', strtotime('-29 days')),
        'tudo' => '0000-00-00 00:00:00',
        default => date('Y-m-d 00:00:00', strtotime('-6 days')),
    };
}
function contar_por(array $sessoes, callable $chave, array $nomes = [], bool $soConcluidas = false): array {
    $c = [];
    foreach ($sessoes as $r) {
        if ($soConcluidas && !$r['concluido']) continue;
        $k = $chave($r);
        $k = ($k === null || $k === '') ? 'Não informado' : (string)$k;
        $k = $nomes[$k] ?? $k;
        $c[$k] = ($c[$k] ?? 0) + 1;      // conta pessoas atendidas
    }
    arsort($c);
    $l = [];
    foreach ($c as $n => $t) $l[] = ['nome' => (string)$n, 'total' => $t];
    return $l;
}
function agregar(array $sessoes): array {
    $nomesFiltro = ['normal' => 'Normal (sem filtro)', 'mono' => 'P&B', 'cyber' => 'Cyberpunk', 'vintage' => 'Vintage', 'personalizado' => 'Ajuste manual'];
    $nomesMetodo = ['whatsapp' => 'WhatsApp', 'qr' => 'QR Code para baixar'];
    $passos = [1 => 'Passo 1 (foto)', 2 => 'Passo 2 (moldura)', 3 => 'Passo 3 (QR/WhatsApp)', 4 => 'Passo 4 (enviando)'];
    $t = ['fotos' => 0, 'sessoes' => count($sessoes), 'concluidas' => 0, 'refeitas' => 0, 'erros' => 0];
    $tempo = 0; $dia = $mes = []; $hora = array_fill(0, 24, 0); $sem = array_fill(0, 7, 0); $abandono = []; $ultTs = 0;
    foreach ($sessoes as $r) {
        $t['fotos'] += $r['fotos']; $t['refeitas'] += $r['refeitas']; $t['erros'] += $r['erros'];
        if ($r['concluido']) { $t['concluidas']++; $tempo += strtotime($r['atualizado_em']) - strtotime($r['criado_em']); }
        elseif ($r['passo_final']) { $p = $passos[$r['passo_final']] ?? 'Outro'; $abandono[$p] = ($abandono[$p] ?? 0) + 1; }
        $ts = strtotime($r['criado_em']);
        $dia[date('Y-m-d', $ts)] = ($dia[date('Y-m-d', $ts)] ?? 0) + $r['fotos'];
        $mes[date('Y-m', $ts)]   = ($mes[date('Y-m', $ts)] ?? 0) + $r['fotos'];
        $hora[(int)date('G', $ts)] += $r['fotos']; $sem[(int)date('w', $ts)] += $r['fotos'];
        $ultTs = max($ultTs, strtotime($r['atualizado_em']));
    }
    $t['taxa'] = $t['sessoes'] ? round(100 * $t['concluidas'] / $t['sessoes']) : 0;
    $t['tempo_medio'] = $t['concluidas'] ? round($tempo / $t['concluidas']) : null;
    ksort($dia); ksort($mes);
    $lista = fn(array $a, callable $f) => array_map(fn($k, $v) => ['nome' => $f($k), 'total' => $v], array_keys($a), $a);
    $diasSem = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    $ab = []; foreach ($abandono as $n => $v) $ab[] = ['nome' => $n, 'total' => $v];
    $ult = [];
    foreach (array_slice(array_reverse(array_values($sessoes)), 0, 15) as $r) {
        $ts = strtotime($r['criado_em']);
        $ult[] = ['data' => date('d/m/Y', $ts), 'hora' => date('H:i', $ts), 'moldura' => $r['moldura'] ?? '—',
                  'filtro' => $nomesFiltro[$r['filtro']] ?? '—', 'timer' => $r['timer_s'] ? $r['timer_s'] . 's' : '—',
                  'perfil' => $r['perfil'] ?? '—', 'envio' => $r['concluido'] ? ($nomesMetodo[$r['metodo']] ?? '—') : 'Não concluiu'];
    }
    return [
        'totais' => $t,
        'por_dia' => $lista($dia, fn($k) => date('d/m', strtotime($k))),
        'por_mes' => $lista($mes, fn($k) => substr($k, 5) . '/' . substr($k, 0, 4)),
        'por_semana' => $lista($sem, fn($k) => $diasSem[$k]),
        'por_hora' => $lista($hora, fn($k) => $k . 'h'),
        'metodos' => contar_por($sessoes, fn($r) => $r['metodo'], $nomesMetodo, true),
        'timers' => contar_por($sessoes, fn($r) => $r['timer_s'] ? $r['timer_s'] . 's' : null),
        'molduras' => contar_por($sessoes, fn($r) => $r['moldura']),
        'filtros' => contar_por($sessoes, fn($r) => $r['filtro'], $nomesFiltro),
        'perfis' => contar_por($sessoes, fn($r) => $r['perfil']),
        'abandono' => $ab, 'ultimas' => $ult, 'gerado' => date('H:i:s'),
    ];
}
