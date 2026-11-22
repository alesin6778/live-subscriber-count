# TOP 50 LIVE SUBSCRIBER COUNT

Simulador de contagem de inscritos ao vivo com 50 canais, ranking dinâmico, animação de
ultrapassagem (FLIP) e rodapé dedicado à disputa do **SUB GAP**.

Aplicação 100% local: HTML5 + CSS3 + JavaScript puro (Vanilla JS). Sem frameworks, sem banco de
dados, sem APIs externas e sem instalação de dependências. Todos os números são simulados.

---

## Como executar

Basta abrir o arquivo `index.html` no navegador (duplo clique). Tudo funciona via `file://`.

Se preferir servir por HTTP (necessário para o painel separado e recomendado para o OBS):

```bash
# a partir da pasta do projeto
python -m http.server 8080
# depois abra http://localhost:8080
```

> A fonte Montserrat/Inter/Roboto vem do Google Fonts. Sem internet o app continua funcionando
> com a fonte de fallback do sistema.

---

## Estrutura

```text
.
├── index.html         a live (é isso que entra na fonte do OBS)
├── controle.html      o painel fora da transmissão (só para você)
├── css/
│   ├── style.css
│   └── control.css    layout da página de controle
├── js/
│   ├── utils.js       formatação, validação, cores, tempo
│   ├── data.js        os 50 canais + configuração padrão
│   ├── storage.js     localStorage, validação, export/import
│   ├── ranking.js     ordenação, posições e ultrapassagens
│   ├── simulation.js  motor de crescimento (independente do DOM)
│   ├── gap.js         dupla central, SUB GAP e previsão
│   ├── settings.js    painel de controle (usado nas duas páginas)
│   ├── sync.js        ponte entre a live e o painel externo
│   ├── bridge.js      lado da live: aplica os comandos do painel
│   ├── control.js     lado do painel: envia as alterações
│   └── app.js         inicialização, renderização e loop
├── assets/
│   ├── channels/      coloque aqui as fotos dos canais
│   └── icons/         ícones auxiliares
└── README.md
```

---

## Personalizar os canais

Tudo fica em `js/data.js`, no array `DEFAULT_CHANNELS`:

```javascript
{
  id: 1,
  nome: "Miwu Science",
  imagem: "",                 // "assets/channels/canal1.png" ou URL
  cor: "#7b2ff7",
  inscritos: 235545920,
  velocidade: 24,             // ritmo de referência (negativo = queda, 0 = parado)
  ativo: true
}
```

`velocidade` serve apenas de base: na primeira execução o app deriva dela a faixa de crescimento
(`~1,8×` a `~3,6×` por atualização). Depois disso, o que vale são os campos **Crescimento mínimo** e
**Crescimento máximo** de cada canal, editáveis no painel.

- **Imagem**: cole um caminho local (`assets/channels/foo.png`) ou uma URL. Vazio = avatar com
  iniciais.
- **Crescimento**: a cada atualização o canal sorteia um inteiro entre o mínimo e o máximo. Valores
  negativos fazem o canal cair (seta vermelha embaixo da posição); 0 + 0 deixa o canal parado.
- **Fogos**: acima do limite normal aparece o fogo laranja; acima do limite azul, o fogo azul.
- **Ativo**: `false` congela o canal e o deixa esmaecido; ele continua ocupando uma posição.
- **Ranking**: não é preciso ordenar manualmente — a aplicação ordena sozinha.
- **Canais extras**: em *Canais → + Adicionar canal* você cria canais além dos 50. Eles entram
  ocultos abaixo do top 50, continuam simulando e aparecem no placar quando entram no top 50
  (empurrando o 50º para fora). O botão ✕ remove um canal extra.
- Depois de editar `data.js`, use **Dados → Restaurar tudo** (ou limpe o `localStorage`) para
  descartar o estado antigo salvo.

Também é possível editar tudo pelo painel, sem tocar no código.

---

## Painel de controle

O painel é o mesmo nos dois lugares: dentro da live (botão ⚙ ou tecla **S**) e na página separada
`controle.html`, que **não aparece na transmissão**. Veja a seção
[Configurar sem aparecer na live](#configurar-sem-aparecer-na-live-duas-janelas).

- **Canais** — nome, imagem, cor, inscritos, crescimento mínimo/máximo e ativação dos 50 canais,
  com busca e botão ↺ para restaurar um canal.
- **Simulação** — iniciar, pausar, reiniciar, zerar contagens, velocidade global (0,5×–10×),
  intervalo de atualização de cada canal (1–5 s), viewers, likes, faixa do SUB GAP e duração da
  animação de ultrapassagem.
- **Aparência** — fundo, cards, bordas, cor dos números, dos nomes e do número da posição,
  separador de milhar, 21 fontes (incluindo Calibri, Arial, Segoe UI, Verdana, Tahoma e Georgia),
  sombra, animações, indicadores, cabeçalho, rodapé, modo OBS,
  fundo transparente, **sem degradês** (cores lisas em todos os elementos da live), fogos/alertas
  e personalização dos cards (escala dos números,
  arredondamento, espaçamento, nomes/avatares, maiúsculas).
  Em **Tamanhos** dá para ajustar nomes dos canais, números da posição, avatares dos cards,
  rodapé (nomes, números e avatares do SUB GAP), número da gap e cabeçalho.
- **Dados** — exportar/importar JSON e restaurar tudo.
- **Eventos** — estatísticas de crescimento e registro das últimas ultrapassagens.

Atalhos: **S** ou **C** painel de controle · **Espaço** pausa/continua · **Shift+O** modo transmissão · **Esc** fecha.

Na página da live as configurações abrem pela engrenagem no canto inferior direito ou pelas teclas
**S** e **C** (as três fazem a mesma coisa), inclusive com a gravação rodando. Com o modo transmissão
ligado a engrenagem some, mas **S** e **C** continuam abrindo e fechando o painel — e a página
separada (`controle.html`) segue disponível.

---

## Atualização dos números

Cada canal faz uma atualização a cada 3 segundos (ajustável), mas em um **instante aleatório**
dentro desse intervalo: os 50 nunca mudam no mesmo momento. Ao mudar, o número conta animado até o
novo valor, fica **verde por 1 segundo** (subiu) ou **vermelho por 1 segundo** (caiu) e depois volta
para a cor configurada.

## Fogos, seta e raios

- **Nada** embaixo da posição quando o canal cresce normalmente — a posição fica centralizada.
- **Fogo laranja** quando o ganho da última atualização alcança *Fogo normal a partir de* (padrão 45).
- **Fogo azul** quando alcança *Fogo azul a partir de* (padrão 78), para crescimento ainda maior.
- **Seta vermelha para baixo** quando o canal perde inscritos.
- **Raios** entre os dois canais das **3 duplas que vão mudar mais rápido** (diferença ÷ velocidade
  relativa). O rodapé foca a mais rápida; quando a diferença chega a zero, ela continua em foco por
  **3 segundos** e então a próxima assume.
- Quando a dupla vira de coluna (ex.: 30º → 31º), aparecem **dois raios**: um embaixo do de cima e
  outro em cima do de baixo. Na virada do top 50 para o 51º (canal oculto), fica só o raio embaixo
  do último card.
- A dupla **#50 x #51** (canal oculto) não tem prioridade: entra nos raios e no rodapé apenas
  quando está entre as que vão mudar mais rápido; nesse caso fica só o raio embaixo do último card.
  Depois de qualquer ultrapassagem, os dois canais continuam em foco por 3 segundos.
- A borda âmbar pulsante é um alerta opcional para pares que viram dentro do tempo configurado
  (padrão: 2 horas, até 2 pares), com cor ajustável no painel.

## Canais em alta (cabeçalho)

Abaixo de *TOTAL SUBSCRIBERS* o app mostra os três canais que mais crescem no momento, com a
velocidade em inscritos por segundo. A lista é recalculada automaticamente e respeita a
velocidade global (0,5×, 1×, 2×...).

## Configurar sem aparecer na live (duas janelas)

São duas páginas, uma para a transmissão e outra só para você:

| Janela | Endereço | Onde aparece |
| --- | --- | --- |
| **Live** | `http://127.0.0.1:8080/index.html` | seu monitor (com a engrenagem) |
| **Fonte do OBS** | `http://127.0.0.1:8080/index.html?obs=1` | stream — sem painel, sem engrenagem |
| **Controle** | `http://127.0.0.1:8080/controle.html` | só no seu monitor |

O painel do `controle.html` é o mesmo da live, mas em página inteira. Cada alteração (nome, cor,
inscritos, velocidade, faixa do SUB GAP, cores, fontes, pausa, canais extras...) é aplicada na live
na hora. A live também devolve o estado atual a cada 3 segundos, então os valores do painel
acompanham a simulação.

Com o modo transmissão ligado a live não mostra a engrenagem, mas **S** e **C** continuam abrindo o
painel por cima do placar para ajustes rápidos durante a gravação (feche com **Esc** ou com a mesma
tecla antes de gravar uma cena limpa). A página `controle.html` faz o mesmo sem aparecer na
transmissão.

O `ABRIR-SITE.bat` já abre as duas janelas. Regras:

- as duas precisam estar no **mesmo navegador** e no **mesmo endereço** (`127.0.0.1:8080` nas duas;
  `localhost` em uma e `127.0.0.1` na outra não conversam);
- com `?obs=1` o botão ⚙ fica escondido; as teclas **S** e **C** ainda abrem o painel, mas só
  quando você aperta (a fonte do OBS precisa estar em foco, pela janela *Interact*, para receber a
  tecla);
- a conexão é local (`BroadcastChannel`): nada sai da sua máquina.

Se a live ainda não estiver aberta, o painel mostra “conectando à live…” e passa a funcionar assim
que ela abrir.

## OBS Studio

1. Adicione uma fonte **Navegador** com `http://127.0.0.1:8080/index.html?obs=1`.
2. Defina largura **1920** e altura **1080** (ou 1280×720).
3. Marque “Desligar a fonte quando não estiver visível” se quiser economizar recursos.
4. As configurações ficam no `controle.html`, em outra janela do navegador — o OBS nunca a captura.
5. Fundo transparente: `?clean=1` na URL ou a opção correspondente no painel.
6. **Modo transmissão** (Shift+O ou a caixa na aba *Aparência*) faz o mesmo papel do `?obs=1` quando
   você abre a live sem o parâmetro; ele vale só para a sessão, então recarregar a página devolve a
   engrenagem.

O layout não usa barras de rolagem e se adapta a outras resoluções mantendo as 5 colunas ×
10 linhas.

---

## Importar e exportar

- **Exportar**: gera um `.json` com canais, contagens, faixas de crescimento, configurações,
  estatísticas e o registro de ultrapassagens.
- **Importar**: o arquivo é validado (50 canais, ids únicos, números finitos, cores hexadecimais,
  nomes preenchidos). Se algo estiver errado, nada é aplicado e a mensagem explica o problema.

---

## Persistência

O estado é salvo automaticamente no `localStorage` (chave `live-subscriber-count.state`), com
versão de esquema. Ao recarregar, contagens, ranking, configurações e aparência são restaurados.
Dados corrompidos ou incompatíveis são descartados e o app volta ao padrão de `js/data.js`.

Para recomeçar do zero: **Dados → Restaurar tudo**, ou no console do navegador:

```javascript
localStorage.removeItem("live-subscriber-count.state");
location.reload();
```

---

## Observações

- Nenhum dado real do YouTube é usado.
- A previsão de ultrapassagem é uma **estimativa** baseada no crescimento médio (mín.+máx.) de
  cada canal; se o canal de baixo não estiver crescendo mais rápido, aparece “SEM PREVISÃO COM AS
  VELOCIDADES ATUAIS”.
- O cronômetro usa `DD : HH : MM : SS`. A conta é `gap / (velocidade do de baixo − velocidade do de
  cima)`, com o gap passando por uma suavização exponencial dupla (`Gap.createSmoother`): cada canal
  sorteia um ganho inteiro por rodada, e sem o filtro o tempo pulava de 5 s para 2 s num único
  ciclo. O filtro também **reduz o erro**: em teste com ruído de ±150 inscritos e ETA de 30 s, o
  pulo máximo caiu de 9,4 s para 0,9 s e o erro médio de 2,4 s para 0,5 s.
- A suavização reinicia quando a dupla em foco muda, quando o ritmo (velocidade global) muda ou
  quando o cronômetro volta a aparecer depois de uma ultrapassagem.
