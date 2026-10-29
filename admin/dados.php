<?php
// Entrega os números do painel em JSON (só para admin logado)
require __DIR__ . '/lib.php';
session_set_cookie_params(['httponly' => true, 'samesite' => 'Strict']);
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if (empty($_SESSION['admin'])) { http_response_code(401); exit('{"erro":"login"}'); }
session_write_close();
echo json_encode(agregar(carregar_sessoes(desde_periodo(periodo_valido($_GET['periodo'] ?? '7')))), JSON_UNESCAPED_UNICODE);
