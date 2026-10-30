import type { Rng } from './rng';

/** Deterministic Portuguese commentary snippets. {p} = main player, {s} = secondary, {t} = team. */
const LINES = {
  kickoff: ['Bola rolando! Começa o jogo.', 'Apita o juiz, começa a partida!'],
  secondHalf: ['Começa o segundo tempo.', 'Bola rolando para a etapa final.'],
  chance: [
    '{s} acha {p} livre na área!',
    '{s} lança e {p} aparece na cara do gol!',
    'Jogada do {t}: {s} toca para {p}...',
    '{p} recebe de {s} e arrisca!',
    'Lá vem o {t}! {s} para {p}.',
  ],
  goal: [
    'GOOOL do {t}! {p} manda pra rede!',
    'É GOL! {p} não perdoa!',
    'GOLAÇO de {p}! A torcida do {t} vai à loucura!',
    'GOL! {p} faz a festa da galera!',
  ],
  save: ['Que defesa de {s}!', '{s} espalma! Grande defesa!', 'No canto, mas {s} chegou!', '{s} pega firme.'],
  miss: ['{p} chuta pra fora!', 'Passou raspando o poste!', 'Isolou! {p} manda por cima.', 'Pra fora! Que chance perdida!'],
  block: ['{s} se joga na frente e bloqueia!', 'Travado por {s}!', 'Na hora H, {s} corta!'],
  foul: ['Falta dura de {p}.', '{p} derruba {s}.', 'Pancada de {p} em {s}. Falta.'],
  yellow: ['Amarelo para {p}.', 'Cartão amarelo! {p} está pendurado.'],
  red: ['VERMELHO! {p} está expulso!', 'Expulso! {p} deixa o {t} com um a menos.'],
  halftime: ['Fim do primeiro tempo.'],
  fulltime: ['Apita o árbitro. Fim de jogo!', 'Acabou! Termina a partida.'],
};

export type LineKey = keyof typeof LINES;

export function commentary(rng: Rng, key: LineKey, ctx: { p?: string; s?: string; t?: string }): string {
  const tpl = rng.pick(LINES[key]);
  return tpl.replace('{p}', ctx.p ?? '').replace('{s}', ctx.s ?? '').replace('{t}', ctx.t ?? '');
}
