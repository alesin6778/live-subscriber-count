/* ==========================================================================
   js/data.js — CONFIGURAÇÃO DOS 50 CANAIS (edite apenas este arquivo)
   --------------------------------------------------------------------------
   id              -> identificador único (não repetir)
   nome            -> nome exibido
   imagem          -> URL/caminho da foto (vazio = avatar com iniciais)
   cor             -> cor do bloco de rank e do avatar
   inscritos       -> número inicial de inscritos
   velocidade      -> ritmo de referência por segundo (negativo = queda, 0 = parado).
                      Serve de base para o crescimento mínimo/máximo de cada atualização;
                      o valor final é editável no painel.
   ativo           -> false congela o canal e o deixa esmaecido

   Todos os dados são fictícios / simulados. Nada é obtido do YouTube.
   ========================================================================== */

const DEFAULT_CHANNELS = [
  { id: 1,  nome: "Miwu Science",       imagem: "", cor: "#7b2ff7", inscritos: 235545920, velocidade: 24, ativo: true },
  { id: 2,  nome: "Rockstar Games",     imagem: "", cor: "#e01e63", inscritos: 128978158, velocidade: 6, ativo: true },
  { id: 3,  nome: "Beluga",             imagem: "", cor: "#9b6dff", inscritos: 122091848, velocidade: 11, ativo: true },
  { id: 4,  nome: "Premier League",     imagem: "", cor: "#3b1d6e", inscritos: 107137272, velocidade: 4, ativo: true },
  { id: 5,  nome: "Minecraft",          imagem: "", cor: "#2f9e44", inscritos: 103026495, velocidade: 18, ativo: true },
  { id: 6,  nome: "PewDiePie",          imagem: "", cor: "#a11212", inscritos: 98011131,  velocidade: -3, ativo: true },
  { id: 7,  nome: "NoCopyrightSounds",  imagem: "", cor: "#ff3b30", inscritos: 91159825,  velocidade: 3, ativo: true },
  { id: 8,  nome: "GWK",                imagem: "", cor: "#6d4c41", inscritos: 82752662,  velocidade: 2, ativo: true },
  { id: 9,  nome: "Shiloh & Bros",      imagem: "", cor: "#e8590c", inscritos: 80506729,  velocidade: 9, ativo: true },
  { id: 10, nome: "Markiplier",         imagem: "", cor: "#c2255c", inscritos: 78320274,  velocidade: 5, ativo: true },
  { id: 11, nome: "SQUEEZIE",           imagem: "", cor: "#e03131", inscritos: 74908801,  velocidade: 7, ativo: true },
  { id: 12, nome: "UR · Cristiano",     imagem: "", cor: "#f08c00", inscritos: 74549876,  velocidade: 13, ativo: true },
  { id: 13, nome: "Technoblade",        imagem: "", cor: "#f59f00", inscritos: 71673089,  velocidade: 1, ativo: true },
  { id: 14, nome: "JennaMarbles",       imagem: "", cor: "#ae3ec9", inscritos: 71537055,  velocidade: -1,  ativo: true },
  { id: 15, nome: "Oliver Tree",        imagem: "", cor: "#845ef7", inscritos: 69747873,  velocidade: 6, ativo: true },
  { id: 16, nome: "Billie Eilish",      imagem: "", cor: "#1c7ed6", inscritos: 69409896,  velocidade: 15, ativo: true },
  { id: 17, nome: "Neymar Jr",          imagem: "", cor: "#2f9e44", inscritos: 68433750,  velocidade: 4, ativo: true },
  { id: 18, nome: "Charlie Kirk",       imagem: "", cor: "#495057", inscritos: 66602442,  velocidade: 2, ativo: true },
  { id: 19, nome: "Miraculous Ladybug", imagem: "", cor: "#d6336c", inscritos: 65991078,  velocidade: 9, ativo: true },
  { id: 20, nome: "Icycol",             imagem: "", cor: "#7048e8", inscritos: 64859613,  velocidade: 3, ativo: true },
  { id: 21, nome: "Solar",              imagem: "", cor: "#f76707", inscritos: 61013427,  velocidade: 8, ativo: true },
  { id: 22, nome: "Ryth",               imagem: "", cor: "#5f3dc4", inscritos: 59552474,  velocidade: 12, ativo: true },
  { id: 23, nome: "mrnigelng",          imagem: "", cor: "#1971c2", inscritos: 59284642,  velocidade: 5, ativo: true },
  { id: 24, nome: "Dream",              imagem: "", cor: "#2b8a3e", inscritos: 58806952,  velocidade: 3, ativo: true },
  { id: 25, nome: "Cooking With Lynja", imagem: "", cor: "#e8590c", inscritos: 57595365,  velocidade: 2, ativo: true },
  { id: 26, nome: "His Story",          imagem: "", cor: "#f03e3e", inscritos: 55403156,  velocidade: 7, ativo: true },
  { id: 27, nome: "Steve He",           imagem: "", cor: "#1098ad", inscritos: 54960521,  velocidade: 6, ativo: true },
  { id: 28, nome: "Alan Walker",        imagem: "", cor: "#5c7cfa", inscritos: 54731871,  velocidade: 4, ativo: true },
  { id: 29, nome: "Ryan HD",            imagem: "", cor: "#d9480f", inscritos: 54451822,  velocidade: 3, ativo: true },
  { id: 30, nome: "CORTIS",             imagem: "", cor: "#0b7285", inscritos: 54038458,  velocidade: 9, ativo: true },
  { id: 31, nome: "PANDA BOI",          imagem: "", cor: "#e64980", inscritos: 53707476,  velocidade: 5, ativo: true },
  { id: 32, nome: "ILLIT",              imagem: "", cor: "#212529", inscritos: 52854660,  velocidade: 14, ativo: true },
  { id: 33, nome: "CaseOh",             imagem: "", cor: "#c92a2a", inscritos: 51895062,  velocidade: 6.4, ativo: true },
  { id: 34, nome: "Cyprien",            imagem: "", cor: "#1864ab", inscritos: 51883141,  velocidade: 9.2, ativo: true },
  { id: 35, nome: "FailArmy",           imagem: "", cor: "#f59f00", inscritos: 50842457,  velocidade: 3, ativo: true },
  { id: 36, nome: "Marshmello",         imagem: "", cor: "#e8590c", inscritos: 50642870,  velocidade: 4, ativo: true },
  { id: 37, nome: "Jazghost",           imagem: "", cor: "#7048e8", inscritos: 49850903,  velocidade: 2, ativo: true },
  { id: 38, nome: "Lucan Pevidor",      imagem: "", cor: "#0c8599", inscritos: 49729831,  velocidade: 5, ativo: true },
  { id: 39, nome: "Marzia",             imagem: "", cor: "#c2255c", inscritos: 49518817,  velocidade: 1,  ativo: true },
  { id: 40, nome: "Enaldinho",          imagem: "", cor: "#2f9e44", inscritos: 48468040,  velocidade: 6, ativo: true },
  { id: 41, nome: "Mark Rober",         imagem: "", cor: "#212529", inscritos: 48283034,  velocidade: 10, ativo: true },
  { id: 42, nome: "Ryan Trahan",        imagem: "", cor: "#1c7ed6", inscritos: 47842523,  velocidade: 8, ativo: true },
  { id: 43, nome: "Flamingo",           imagem: "", cor: "#f06595", inscritos: 47791504,  velocidade: 3, ativo: true },
  { id: 44, nome: "Maizen",             imagem: "", cor: "#37b24d", inscritos: 47718677,  velocidade: 4, ativo: true },
  { id: 45, nome: "Frost Diamond",      imagem: "", cor: "#12b886", inscritos: 47252168,  velocidade: 2, ativo: true },
  { id: 46, nome: "YouTube",            imagem: "", cor: "#e03131", inscritos: 46524065,  velocidade: 5, ativo: true },
  { id: 47, nome: "LouisAyy",           imagem: "", cor: "#495057", inscritos: 46418729,  velocidade: 3, ativo: true },
  { id: 48, nome: "SMG4",               imagem: "", cor: "#1b6ec2", inscritos: 45451872,  velocidade: 4, ativo: true },
  { id: 49, nome: "Apple",              imagem: "", cor: "#343a40", inscritos: 45434412,  velocidade: 1,  ativo: true },
  { id: 50, nome: "Антон Птушкін",      imagem: "", cor: "#5f3dc4", inscritos: 44964609,  velocidade: 2, ativo: true },
];

const DEFAULT_CONFIG = {
  globalSpeed: 1,
  tickMs: 200,        // resolução interna do laço (não é o intervalo de atualização)
  updateMs: 3000,     // cada canal faz uma atualização a cada N ms
  gapFrom: 1,
  gapTo: 51,   // inclui a dupla #50 x #51 (primeiro canal oculto)
  paused: false,
  obsMode: false,
  transparent: false,
  showHeader: true,
  showFooter: true,
  showIndicators: true,
  font: "Montserrat",
  numberSeparator: ",",
  animations: "full",
  animMs: 700,
  noGradients: false,  // true = cores lisas em todos os elementos da live

  /* atualização dos números */
  countAnimMs: 700,   // duração da contagem animada até o novo número
  flashMs: 1000,      // tempo em verde/vermelho depois da atualização

  /* fogos automáticos (limites por atualização de cada canal) */
  autoFire: true,
  fireMin: 45,        // fogo normal a partir deste ganho
  blueFireMin: 78,    // fogo azul a partir deste ganho

  /* alertas de ultrapassagem */
  autoGap: true,         // destaca canais prestes a se ultrapassar
  autoGapSeconds: 7200,  // alerta se a ultrapassagem estiver prevista até 2h
  autoGapPairs: 2,       // máximo de pares destacados
  alertColor: "#ffd166",

  /* personalização dos cards */
  countScale: 1,
  nameScale: 1,
  rankScale: 1,
  avatarScale: 1,
  headerScale: 1,
  footerScale: 1,
  gapScale: 1,
  cardRadius: 2,
  cardGap: 3,
  showNames: true,
  showAvatars: true,
  uppercaseNames: false,
  theme: {
    bg: "#090810",
    cardBg: "#151119",
    border: "#9a93b5",
    numberColor: "#ffffff",
    nameColor: "#f4f2f8",
    rankColor: "#ffffff",
    shadow: 1,
  },
};

const DEFAULT_STATS = {
  viewers: 49,
  likes: 263553,
};
