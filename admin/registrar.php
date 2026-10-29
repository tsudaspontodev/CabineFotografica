<?php
// Recebe os eventos do app (anônimo: sem foto e sem número de telefone)
require __DIR__ . '/lib.php';
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit('{}'); }

try {
    $bruto = file_get_contents('php://input');
    if (strlen($bruto) > 4096) { http_response_code(413); exit('{}'); }
    $in = json_decode($bruto, true);
    if (!is_array($in)) { http_response_code(400); exit('{}'); }

    $sid = (string)($in['sid'] ?? '');
    $evento = (string)($in['evento'] ?? '');
    if (!preg_match('/^[A-Za-z0-9-]{8,40}$/', $sid) ||
        !in_array($evento, ['captura', 'atualizar', 'refeita', 'erro', 'concluir', 'abandono'], true)) {
        http_response_code(400); exit('{}');
    }
    $d = is_array($in['dados'] ?? null) ? $in['dados'] : [];
    $txt = fn($v) => is_string($v) ? mb_substr(trim($v), 0, 60) : null;
    $int = fn($v, $a, $b) => is_numeric($v) ? max($a, min($b, (int)$v)) : null;

    $campos = [
        'timer_s'     => $int($d['timer_s'] ?? null, 1, 60),
        'moldura'     => $txt($d['moldura'] ?? null),
        'filtro'      => in_array($d['filtro'] ?? '', ['normal', 'mono', 'cyber', 'vintage', 'personalizado'], true) ? $d['filtro'] : null,
        'brilho'      => $int($d['brilho'] ?? null, 0, 300),
        'contraste'   => $int($d['contraste'] ?? null, 0, 300),
        'saturacao'   => $int($d['saturacao'] ?? null, 0, 300),
        'selo'        => $int($d['selo'] ?? null, 0, 1),
        'perfil'      => $txt($d['perfil'] ?? null),
        'metodo'      => in_array($d['metodo'] ?? '', ['whatsapp', 'qr'], true) ? $d['metodo'] : null,
        'passo_final' => $int($d['passo_final'] ?? null, 1, 4),
    ];
    $linha = [
        'ts' => date('Y-m-d H:i:s'), 'dia' => (int)date('d'), 'mes' => (int)date('m'),
        'ano' => (int)date('Y'), 'hora' => (int)date('H'), 'sid' => $sid, 'evento' => $evento,
    ] + array_filter($campos, fn($v) => $v !== null);

    gravar_evento($linha);
    echo '{"ok":true}';
} catch (Throwable $e) {
    http_response_code(500);
    echo '{"erro":"falha ao registrar"}';
}
