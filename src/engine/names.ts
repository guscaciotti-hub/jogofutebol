import type { Rng } from './rng';

export const FIRST_NAMES = [
  'João', 'Pedro', 'Lucas', 'Gabriel', 'Mateus', 'Rafael', 'Bruno', 'Felipe', 'Gustavo', 'Thiago',
  'Carlos', 'Marcos', 'Paulo', 'André', 'Diego', 'Rodrigo', 'Leandro', 'Fábio', 'Vinícius', 'Caio',
  'Igor', 'Daniel', 'Eduardo', 'Henrique', 'Júlio', 'Leonardo', 'Luiz', 'Murilo', 'Renan', 'Samuel',
  'Wesley', 'Alex', 'Anderson', 'Cléber', 'Edson', 'Everton', 'Jefferson', 'Kaique', 'Maicon', 'Robson',
  'Tiago', 'Wagner', 'Wellington', 'Willian', 'Yuri', 'Davi', 'Enzo', 'Heitor', 'Arthur', 'Nicolas',
  'Ruan', 'Ryan', 'Kauã', 'Luan', 'Otávio', 'Rogério', 'Sandro', 'Valdir', 'Zé', 'Adriano',
];

export const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes',
  'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa',
  'Rocha', 'Dias', 'Nascimento', 'Andrade', 'Moreira', 'Nunes', 'Marques', 'Machado', 'Mendes', 'Freitas',
  'Cardoso', 'Ramos', 'Gonçalves', 'Santana', 'Teixeira', 'Araújo', 'Correia', 'Pinto', 'Cavalcanti', 'Monteiro',
  'Moura', 'Batista', 'Campos', 'Melo', 'Duarte', 'Xavier', 'Tavares', 'Castro', 'Rezende', 'Nogueira',
];

export const NICKNAMES = [
  'Pelezinho', 'Nego', 'Tico', 'Baixinho', 'Alemão', 'Índio', 'Gordo', 'Magrão', 'Canhoto', 'Foguete',
  'Pezão', 'Cabeção', 'Dedé', 'Zico', 'Juninho', 'Paulinho', 'Marquinhos', 'Carlinhos', 'Betinho', 'Toninho',
];

/** Brazilian-sounding NPC name. ~15% get a street nickname for flavour. */
export function generateName(rng: Rng): string {
  const first = rng.pick(FIRST_NAMES);
  const last = rng.pick(LAST_NAMES);
  if (rng.chance(0.15)) return rng.pick(NICKNAMES);
  return `${first} ${last}`;
}

/** Short name used on the floating label: nickname or first name. */
export function shortName(fullName: string): string {
  return fullName.split(' ')[0];
}

export const CLUB_PREFIXES: ReadonlyArray<{ pattern: string; short: string }> = [
  { pattern: 'Esporte Clube {city}', short: 'EC' },
  { pattern: 'Atlético {city}', short: 'ATL' },
  { pattern: 'União {city}', short: 'UNI' },
  { pattern: 'Real {city}', short: 'REA' },
  { pattern: 'Associação {city}', short: 'ASS' },
  { pattern: 'Grêmio {city}', short: 'GRE' },
  { pattern: 'Nacional de {city}', short: 'NAC' },
  { pattern: 'Operário {city}', short: 'OPE' },
];
