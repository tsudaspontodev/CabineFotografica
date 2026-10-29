<?php
// Salva uma cópia da foto na pasta do dashboard.
// Coloque este arquivo na mesma pasta do index.html (dentro do htdocs do XAMPP).
header('Content-Type: application/json; charset=utf-8');

// Pasta de destino (criada automaticamente se não existir)
$pasta = 'C:\\xampp\\htdocs\\mgsenai dashboard\\Imagens';

function responder($ok, $dados = [], $codigo = 200) {
    http_response_code($codigo);
    echo json_encode(array_merge(['ok' => $ok], $dados), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    responder(false, ['erro' => 'Use o método POST.'], 405);
}

$entrada = json_decode(file_get_contents('php://input'), true);
$imagem  = is_array($entrada) ? ($entrada['imagem'] ?? '') : '';
$nome    = is_array($entrada) ? ($entrada['nome'] ?? '') : '';

// Aceita apenas JPEG/PNG em base64 (data URL)
if (!preg_match('#^data:image/(jpeg|jpg|png);base64,#i', $imagem, $m)) {
    responder(false, ['erro' => 'Imagem inválida.'], 400);
}
$ext   = strtolower($m[1]) === 'png' ? 'png' : 'jpg';
$dados = base64_decode(substr($imagem, strlen($m[0])), true);
if ($dados === false || strlen($dados) < 100) {
    responder(false, ['erro' => 'Não foi possível ler a imagem.'], 400);
}
if (strlen($dados) > 15 * 1024 * 1024) {
    responder(false, ['erro' => 'Imagem muito grande.'], 413);
}

// Nome seguro do arquivo
$nome = preg_replace('/\.[A-Za-z0-9]+$/', '', basename((string)$nome));
$nome = preg_replace('/[^A-Za-z0-9._-]/', '-', $nome);
if ($nome === '' || $nome === null) {
    $nome = 'foto-senai-' . date('Ymd-His');
}

if (!is_dir($pasta) && !@mkdir($pasta, 0777, true)) {
    responder(false, ['erro' => 'Não foi possível criar a pasta de destino.'], 500);
}

// Não sobrescreve arquivos existentes
$arquivo = $nome . '.' . $ext;
$n = 1;
while (file_exists($pasta . DIRECTORY_SEPARATOR . $arquivo)) {
    $arquivo = $nome . '-' . $n++ . '.' . $ext;
}

if (@file_put_contents($pasta . DIRECTORY_SEPARATOR . $arquivo, $dados) === false) {
    responder(false, ['erro' => 'Falha ao gravar o arquivo.'], 500);
}

responder(true, ['arquivo' => $arquivo]);
