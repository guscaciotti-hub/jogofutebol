import type { CityRef } from './generate';

/**
 * Phase 1 only: a handful of municipalities so the prototype can generate NPC clubs.
 * Phase 2 replaces this with the full IBGE seed (/seed) — ids follow the IBGE 7-digit code.
 */
export const SAMPLE_CITIES: CityRef[] = [
  { id: 3550308, name: 'São Paulo', uf: 'SP' },
  { id: 3304557, name: 'Rio de Janeiro', uf: 'RJ' },
  { id: 3106200, name: 'Belo Horizonte', uf: 'MG' },
  { id: 4106902, name: 'Curitiba', uf: 'PR' },
  { id: 4314902, name: 'Porto Alegre', uf: 'RS' },
  { id: 2927408, name: 'Salvador', uf: 'BA' },
  { id: 2611606, name: 'Recife', uf: 'PE' },
  { id: 2304400, name: 'Fortaleza', uf: 'CE' },
  { id: 1302603, name: 'Manaus', uf: 'AM' },
  { id: 5208707, name: 'Goiânia', uf: 'GO' },
  { id: 1501402, name: 'Belém', uf: 'PA' },
  { id: 3518800, name: 'Guarulhos', uf: 'SP' },
  { id: 3509502, name: 'Campinas', uf: 'SP' },
  { id: 2111300, name: 'São Luís', uf: 'MA' },
  { id: 4205407, name: 'Florianópolis', uf: 'SC' },
  { id: 5002704, name: 'Campo Grande', uf: 'MS' },
  { id: 2408102, name: 'Natal', uf: 'RN' },
  { id: 3205309, name: 'Vitória', uf: 'ES' },
  { id: 5300108, name: 'Brasília', uf: 'DF' },
  { id: 1721000, name: 'Palmas', uf: 'TO' },
  { id: 3143302, name: 'Montes Claros', uf: 'MG' },
  { id: 4113700, name: 'Londrina', uf: 'PR' },
  { id: 2910800, name: 'Feira de Santana', uf: 'BA' },
  { id: 3170206, name: 'Uberlândia', uf: 'MG' },
];
