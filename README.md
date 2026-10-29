# Sistema de Reconhecimento Facial para TV/Multimídia

Projeto web completo para captura de imagens com reconhecimento facial, edição avançada e compartilhamento via WhatsApp ou QR Code, com painel administrativo de estatísticas.

## Funcionalidades

### Captura de Foto
- ✅ Câmera inicia automaticamente ao abrir a página
- ✅ Detecção facial em tempo real usando face-api.js com feedback visual
- ✅ Guia de posicionamento com validação (centralize, aproxime-se, afaste-se)
- ✅ Timer configurável (3s, 5s ou 10s) com ciclagem entre opções
- ✅ Contagem regressiva visual e sonora (fala os números em português)
- ✅ Efeito de flash visual e som de obturador ao capturar
- ✅ Espelhamento opcional da câmera (como um espelho)
- ✅ Mascote animado durante o passo de captura

### Edição de Imagem
- ✅ Filtros de imagem ajustáveis: brilho, contraste e saturação
- ✅ Presets de filtros rápidos: Normal, Preto & Branco, Cyberpunk, Vintage
- ✅ Preview ao vivo de todos os ajustes
- ✅ Botão de reset para restaurar configurações originais
- ✅ Selo opcional que pode ser ativado/desativado
- ✅ Perfil profissional gerado automaticamente (resultado lúdico)

### Molduras
- ✅ Diversas molduras disponíveis (mascotes, cenários temáticos)
- ✅ Opção "Sem moldura" para fotos limpas
- ✅ Preview instantâneo ao selecionar moldura
- ✅ Molduras temáticas: Indústria, Carros, Motos, Solda, Tornearia, Backdrop Senai
- ✅ Mascotes em diferentes poses (acenando, comemorando, paz e amor, coração, joia, mecânico)

### Compartilhamento
- ✅ Envio via WhatsApp com mensagem personalizada
- ✅ Geração de QR Code para baixar a foto diretamente
- ✅ Teclado numérico na tela (ideal para TV/touch screen)
- ✅ Campo pré-preenchido com +55
- ✅ Validação de número de telefone
- ✅ Página dedicada para visualização da foto via QR Code

### Interface e UX
- ✅ Interface otimizada para TV/Multimídia com elementos grandes
- ✅ Tutorial interativo com instruções passo a passo
- ✅ Stepper de progresso visual (Foto → Moldura → QR Code)
- ✅ Design responsivo e moderno com tema cyberpunk
- ✅ Animações fluidas e feedback visual em todas as interações
- ✅ Acessibilidade com atributos ARIA
- ✅ Reset automático após 60 segundos de inatividade (passos 2 e 3)

### Painel Administrativo
- ✅ Dashboard em tempo real com estatísticas detalhadas
- ✅ KPIs: fotos tiradas, pessoas atendidas, taxa de conclusão, tempo médio
- ✅ Gráficos de distribuição por dia, mês, semana e horário
- ✅ Análise de molduras mais usadas
- ✅ Análise de filtros e timers preferidos
- ✅ Estatísticas de métodos de envio (WhatsApp vs QR Code)
- ✅ Tracking de abandono (em qual passo os usuários desistem)
- ✅ Últimas 15 fotos com detalhes completos
- ✅ Exportação de dados em CSV
- ✅ Filtro por período: hoje, 7 dias, 30 dias, mês, tudo
- ✅ Atualização automática com indicador "Ao vivo"
- ✅ Sistema de login seguro com proteção contra tentativas excessivas
- ✅ Troca de senha obrigatória no primeiro acesso
- ✅ Proteção de dados via .htaccess

### Sistema de Backend
- ✅ Logging de eventos por sessão (capturas, refazer, erros, conclusão)
- ✅ Armazenamento em arquivos JSON (sem banco de dados)
- ✅ Rastreamento completo de métricas de uso
- ✅ Proteção CSRF em todas as operações
- ✅ Cookies seguros com httponly e samesite

## Como Usar

### Método 1: Abrir diretamente no navegador

1. Abra o arquivo `index.html` em um navegador moderno (Chrome, Firefox, Edge)
2. A câmera inicia automaticamente
3. Posicione seu rosto na área marcada (quadro verde/azul)
4. O sistema valida sua posição (se precisar aproximar, afastar ou centralizar)
5. Ajuste o timer clicando no botão "Timer" (3s, 5s ou 10s)
6. Quando o rosto estiver detectado e bem posicionado, clique em "Capturar"
7. Uma contagem regressiva com sons e fala ocorre antes da foto
8. A foto congela na tela e avança automaticamente para o passo de edição
9. Escolha filtros ou use presets rápidos (Normal, P&B, Cyberpunk, Vintage)
10. Ajuste brilho, contraste e saturação conforme preferência
11. Selecione uma moldura ou use "Sem moldura"
12. Ative/desative o selo conforme desejado
13. Clique em "Continuar" para avançar
14. Escolha como receber a foto:
    - **QR Code para BAIXAR**: Gera QR Code para baixar a foto sem informar número
    - **WhatsApp**: Digite seu número usando o teclado na tela (DDD + número)
15. Clique em "Gerar QR Code WhatsApp"
16. Escaneie o QR Code ou abra o link gerado
17. Na página do QR Code, clique em "Enviar para meu WhatsApp" ou "Baixar foto"
18. Após o envio, a aplicação volta automaticamente para a tela inicial

### Método 2: Usar servidor local (recomendado)

Para melhor funcionamento, especialmente em TVs:

```bash
# Com Python instalado:
cd "C:\xampp\htdocs\mgsenai dashboard"
python -m http.server 8080

# Ou com Node.js:
npm install -g http-server
cd "C:\xampp\htdocs\mgsenai dashboard"
http-server -p 8080
```

Depois acesse: `http://localhost:8080`

### Painel Administrativo

Para acessar as estatísticas:

1. Navegue até `admin/index.php`
2. Login padrão: usuário `admin`, senha `senai123`
3. **Importante**: Altere a senha no primeiro acesso
4. O painel mostra estatísticas em tempo real com atualização automática
5. Exporte CSV clicando em "Exportar CSV" no período desejado

## Como Funciona o Envio para WhatsApp

1. Ao clicar em "Gerar QR Code WhatsApp", o sistema processa a foto com todos os filtros e molduras aplicados
2. A foto é enviada para um serviço de upload (imgbb ou similar)
3. Um link da foto processada é gerado
4. Um QR Code é gerado com o link para a página `qr-viewer.html`
5. O usuário escaneia o QR Code com o celular
6. Na página do QR Code, o usuário pode:
   - Clicar em "Enviar para meu WhatsApp" (abre o WhatsApp com a foto)
   - Clicar em "Baixar foto" (download direto)
7. A aplicação volta automaticamente para a tela inicial após 60 segundos de inatividade

## Como Funciona o QR Code para Download

1. Ao clicar em "Gerar QR Code para BAIXAR", o sistema processa a foto
2. Um QR Code é gerado para a página `qr-viewer.html` sem número de telefone
3. O usuário escaneia o QR Code com o celular
4. Na página, pode baixar a foto diretamente ou compartilhar manualmente
5. Ideal para usuários que não querem informar o número

## Formato do Número

O campo já vem pré-preenchido com +55. Digite apenas:
- DDD + número (ex: 11999999999)
- Não é necessário digitar o código do país

## Requisitos

### Frontend
- Navegador moderno com suporte a:
  - WebRTC (acesso à câmera)
  - Canvas API
  - ES6 JavaScript
  - Web Audio API (para sons de captura)
  - Speech Synthesis API (para fala da contagem)
- Permissão de acesso à câmera
- Conexão com internet (para carregar os modelos de IA e upload da imagem)

### Backend (painel administrativo)
- PHP 7.4 ou superior
- Servidor web (Apache, Nginx, ou servidor embutido do PHP)
- Permissão de escrita na pasta `admin/data/`
- Extensões PHP: JSON, session

## Tecnologias Utilizadas

### Frontend
- **HTML5**: Estrutura da página e elementos semânticos
- **CSS3**: Estilização, design responsivo e animações
- **JavaScript (ES6+)**: Lógica da aplicação
- **face-api.js**: Biblioteca de reconhecimento facial baseada em TensorFlow.js
- **TensorFlow.js**: Framework de machine learning para detecção facial
- **BodyPix**: Modelo para segmentação e remoção de fundo
- **WebRTC**: Acesso à câmera
- **Canvas API**: Captura e processamento de imagens
- **Web Audio API**: Geração de sons de captura e contagem
- **Speech Synthesis API**: Fala da contagem regressiva
- **QRCode.js**: Geração de QR Codes

### Backend
- **PHP**: Lógica do painel administrativo
- **JSON**: Armazenamento de dados (sem banco de dados)
- **File System**: Logging de eventos e estatísticas
- **Sessions**: Autenticação e proteção CSRF

### Serviços Externos
- **imgbb API**: Upload gratuito de imagens (ou similar)
- **WhatsApp API**: Envio de mensagens via deeplink

## Estrutura do Projeto

```
mgsenai dashboard/
├── index.html                  # Página principal da aplicação
├── styles.css                  # Estilos e design responsivo
├── app.js                      # Lógica JavaScript (captura, filtros, compartilhamento)
├── qr-viewer.html              # Página de visualização via QR Code
├── assets/                     # Pasta de molduras e imagens
│   ├── logo.png                # Logo do sistema
│   ├── mundo_senai_4.png       # Logo Mundo Senai
│   ├── Senai - azul.png        # Moldura padrão
│   ├── mascote_1.jpg           # Mascote acenando
│   ├── mascote_2.jpg           # Mascote comemorando
│   ├── mascote_3.jpg           # Mascote paz e amor
│   ├── mascote_4.jpg           # Mascote fazendo coração
│   ├── mascote_5.jpg           # Mascote fazendo joia
│   ├── mascote_6.jpg           # Mascote Mecânico
│   ├── bg-carros.jpg           # Fundo Carros
│   ├── bg-industria.jpg        # Fundo Indústria
│   ├── bg-motos.jpg            # Fundo Motos
│   ├── bg-solda.jpg            # Fundo Solda
│   ├── bg-tornearia.jpg        # Fundo Tornearia
│   ├── Mundo-senai.png         # Moldura Mundo Senai
│   ├── backdrop senai.jpg      # Backdrop Senai
│   └── video_promocional_boneco_transparente.gif  # Mascote animado
├── admin/                      # Painel administrativo
│   ├── index.php               # Dashboard e login
│   ├── dados.php               # API de dados em JSON
│   ├── lib.php                 # Funções comuns do backend
│   ├── registrar.php           # Registro de eventos
│   └── data/                   # Armazenamento de dados
│       ├── admin.json          # Credenciais do administrador
│       └── *.log               # Logs de eventos por mês
└── README.md                   # Este arquivo
```

## Adicionar Novas Molduras

Para adicionar novas molduras ao projeto:

1. Coloque as imagens na pasta `assets/`
2. Formatos suportados: PNG, JPG, JPEG
3. Edite o arquivo `index.html` e adicione novas opções na seção `framesSection`:

```html
<div class="frame-option" data-frame="assets/sua-imagem.jpg" role="button" tabindex="0" aria-label="Moldura Nome da Moldura">
    <img src="assets/sua-imagem.jpg" class="frame-preview" alt="Preview da moldura Nome da Moldura">
    <span>Nome da Moldura</span>
</div>
```

4. Recarregue a página para ver as novas molduras

## Configuração da Câmera

No arquivo `app.js`, você pode ajustar as configurações da câmera editando o objeto `CONFIG_CAMERA`:

```javascript
const CONFIG_CAMERA = {
    contagemSegundos: 3,   // contagem regressiva antes da foto
    espelharFoto: true,    // true = prévia E foto salva espelhadas (como um espelho)
    som: true,             // bipes da contagem + som de obturador
    flash: true,           // clarão branco no momento da foto
    voz: true              // fala a contagem regressiva (3, 2, 1) em português
};
```

### Timer Configurável

O sistema oferece 3 opções de timer que podem ser cicladas clicando no botão "Timer":
- 3 segundos (padrão)
- 5 segundos
- 10 segundos

As opções podem ser ajustadas editando o array `TIMER_OPTIONS` no `app.js`.

## Funcionamento da Detecção Facial

O sistema usa a biblioteca face-api.js para:

1. **Detecção de faces**: Identifica rostos na imagem usando TinyFaceDetector
2. **Landmarks faciais**: Pontos de referência no rosto (olhos, nariz, boca)
3. **Expressões**: Detecta expressões faciais (opcional)
4. **Validação de posição**: Verifica se o rosto está bem posicionado
   - Tamanho adequado (nem muito perto, nem muito longe)
   - Centralizado na área marcada
   - Feedback visual com mudança de cor da moldura (verde quando ok, vermelho quando não)

### Guia de Posicionamento

O sistema fornece feedback em tempo real:
- **"Perfeito! Clique em 'Capturar'"**: Rosto bem posicionado
- **"Aproxime-se um pouco da câmera"**: Rosto muito pequeno
- **"Afaste-se um pouco da câmera"**: Rosto muito grande
- **"Centralize o rosto na área marcada"**: Rosto fora do centro

Os modelos são carregados diretamente do CDN, então não é necessário download adicional.

## Compatibilidade

### Navegadores Suportados
- Chrome 60+
- Firefox 55+
- Edge 79+
- Safari 11+

### Dispositivos
- Desktops e laptops
- Smart TVs com navegador
- Tablets
- Smartphones

## Limitações

- Requer permissão de acesso à câmera
- Funciona melhor em ambientes com boa iluminação
- O envio via WhatsApp usa link da imagem (não envia a imagem diretamente)
- Requer conexão com internet para upload da imagem e carregamento dos modelos de IA
- O painel administrativo requer PHP e permissões de escrita no servidor
- A fala da contagem regressiva depende do suporte do navegador à Speech Synthesis API
- Os sons de captura dependem do suporte do navegador à Web Audio API

## Solução de Problemas

### Câmera não funciona
- Verifique se o navegador tem permissão para acessar a câmera
- Verifique se a câmera não está sendo usada por outro aplicativo
- Tente usar HTTPS se estiver em servidor (requisito para WebRTC em alguns navegadores)
- Verifique se o dispositivo tem uma câmera conectada

### Detecção facial lenta
- Verifique sua conexão com internet (modelos são carregados do CDN)
- Feche outras abas do navegador para liberar recursos
- Use um dispositivo com melhor processamento
- Se a detecção falhar completamente, o sistema continua funcionando com a moldura fixa

### Upload da imagem falha
- Verifique sua conexão com internet
- O serviço de upload pode ter limites de uso gratuitos
- Tente novamente após alguns segundos
- Verifique se o serviço de upload está configurado corretamente no código

### WhatsApp não abre
- Verifique se o número foi digitado corretamente (DDD + número)
- Verifique se você tem o WhatsApp instalado no dispositivo
- Verifique se o link do QR Code foi gerado corretamente

### Sons não funcionam
- Verifique se o navegador suporta Web Audio API
- Verifique se o volume do dispositivo está ativado
- Alguns navegadores requerem interação do usuário antes de reproduzir áudio

### Fala da contagem não funciona
- Verifique se o navegador suporta Speech Synthesis API
- Verifique se o dispositivo tem voz de português instalada
- A fala pode variar dependendo do navegador e sistema operacional

### Painel administrativo não carrega
- Verifique se o PHP está instalado e configurado
- Verifique se a pasta `admin/data/` tem permissão de escrita
- Verifique se o servidor web está configurado corretamente
- Verifique as permissões do arquivo `.htaccess` na pasta `admin/data/`

### Login no painel falha
- Verifique se o usuário e senha estão corretos (padrão: admin/senai123)
- Após 5 tentativas incorretas, o sistema bloqueia por 1 minuto
- Aguarde o tempo de bloqueio antes de tentar novamente
- Se esqueceu a senha, apague o arquivo `admin/data/admin.json` para resetar

## Métricas e Analytics

O sistema coleta automaticamente as seguintes métricas por sessão:

### Dados Capturados
- **Sessão**: ID único para cada usuário
- **Timestamps**: Data/hora de início e fim da sessão
- **Fotos tiradas**: Quantidade de fotos capturadas
- **Fotos refeitas**: Quantidade de vezes que o usuário refez a foto
- **Timer usado**: Tempo de timer selecionado (3s, 5s, 10s)
- **Moldura escolhida**: Nome da moldura aplicada
- **Filtro usado**: Tipo de filtro (normal, mono, cyber, vintage, personalizado)
- **Ajustes manuais**: Brilho, contraste e saturação
- **Selo**: Se o selo foi ativado
- **Perfil**: Perfil profissional gerado
- **Método de envio**: WhatsApp ou QR Code
- **Status de conclusão**: Se o usuário completou o processo
- **Passo de abandono**: Em qual etapa o usuário desistiu (se aplicável)
- **Erros**: Quantidade de erros ocorridos

### KPIs Calculados
- **Pessoas atendidas**: Número total de sessões
- **Taxa de conclusão**: Porcentagem de sessões que completaram o processo
- **Tempo médio**: Tempo médio até o envio (em segundos)
- **Fotos por pessoa**: Média de fotos por sessão

### Visualizações Disponíveis
- Distribuição por dia, mês e semana
- Distribuição por horário (0-23h)
- Ranking de molduras mais usadas
- Ranking de filtros mais usados
- Ranking de timers preferidos
- Comparação de métodos de envio
- Análise de abandono por etapa
- Histórico das últimas 15 sessões

### Exportação de Dados
- Exportação em CSV com todos os dados detalhados
- Filtro por período (hoje, 7 dias, 30 dias, mês, tudo)
- Formato compatível com Excel, Google Sheets e outras ferramentas

## Segurança

### Frontend
- Validação de entrada de dados
- Sanitização de inputs
- Proteção contra XSS

### Backend
- Proteção CSRF em todas as operações POST
- Senhas armazenadas com hash (PASSWORD_DEFAULT)
- Cookies seguros com httponly e samesite
- Bloqueio após 5 tentativas de login incorretas
- Proteção de arquivos de dados via .htaccess
- Regeneração de session ID após login

### Dados
- Logs armazenados localmente no servidor
- Nenhum dado sensível é enviado para terceiros (exceto imagens para o serviço de upload)
- As estatísticas são anônimas por sessão

## Licença

Este projeto é fornecido como está para fins educacionais e de demonstração.

## Suporte

Para dúvidas ou problemas, verifique a seção de solução de problemas acima.

## Mascote animado

- O GIF do passo 1 foi trocado pelo mascote animado (`mascote.js`, `mascote.css` e quadros em `assets/mascote/`).
- Ele reage ao que acontece: chama as pessoas, procura quando não há ninguém, aponta para a área marcada, faz coração quando o rosto está certo, levanta a câmera na contagem e comemora depois da foto.
- Depois da foto ele fica pequeno no canto inferior esquerdo da tela (passos 2 e 3).
- Botão **Tirar foto comigo** (embaixo do mascote): ele vai para dentro da imagem da câmera, ao lado da pessoa, e sai na foto. No passo 2, a opção **Mascote na foto** coloca ou tira o mascote da foto.
- Para mudar o tamanho/posição dele na câmera, ajuste `retCamera()` no começo de `mascote.js`.
