# Várzea Brasil (nome provisório)

Jogo web mobile-first de técnico de futebol de várzea, com visual 3D de maquete low-poly.
Todo o Brasil está no jogo; qualquer clube pode enfrentar qualquer clube; as partidas são
simuladas de forma **determinística por seed** e assistidas em replay 3D.

## Stack

- Vite + TypeScript + Three.js (geometria 100% procedural, sem modelos nem texturas externas)
- GSAP (linha do tempo mestra do replay, câmera, placar, banners)
- Howler.js (sons sintetizados em código como WAV em data URI: sem download, livres de direitos)
- Vitest (motor de simulação testado como função pura)
- Supabase + Vercel + HyperFrames entram nas fases seguintes

## Rodando

```bash
npm install
npm run dev        # http://localhost:5173 (use --host para abrir no celular na mesma rede)
npm test           # testes do motor e da linha do tempo
npm run build      # typecheck + build de produção em dist/
npm run calibrate  # estatísticas de realismo em 10 mil partidas
```

Parâmetros de URL: `?seed=qualquer-coisa` reproduz exatamente a mesma partida em qualquer aparelho.

## Organização

```
/src
  /engine   simulação pura + geração procedural de NPCs + testes (sem Three.js)
  /render   cena Three.js, modelos procedurais, linha do tempo do replay (pura, seekable)
  /ui       placar, banners, card inicial, escudo procedural (canvas)
  /audio    sons sintetizados + Howler
  /data     cliente Supabase e tipos (Fase 2)
/supabase   migrations e functions (Fase 2)
/seed       estados e municípios do IBGE (Fase 2)
/reels      composições HyperFrames (Fase 2+)
/scripts    calibração do motor
```

## Fase 1 — Protótipo jogável (sem backend) — status

Entregue:

- Motor `simulateMatch(seed, home, away, tactics)` → eventos com minuto, tipo, jogadores e posição.
  Modelo por minuto: posse (meio-campo) → perigo (ataque × defesa) → finalização (chute × goleiro).
  Táticas 4-4-2 / 4-3-3 / 3-5-2 e retranca / equilibrado / pressão. Faltas, cartões, expulsão,
  fator torcida pequeno e limitado.
- Calibração: ~2,7 gols por jogo e ~45% de vitórias do mandante (teste com 10.000 partidas).
- Geração procedural determinística: `generateClub(cidade, slot)` e `generatePlayer(seedClube, i)`.
  Teste de carga: 22.280 clubes NPC gerados e 11.140 partidas simuladas em ~2,3 s.
- Linha do tempo do replay (`src/render/timeline.ts`): função pura `getReplayState(replay, t)`;
  ~3 minutos para 90 minutos, mostrando chances, gols, defesas e cartões, com a bola rolando entre eles.
  Qualquer frame é recalculado a partir de `t` (pronto para o HyperFrames).
- Cena 3D: campo, gols com rede, arquibancadas com torcida instanciada (~2.000 bonecos) que pula no gol,
  árvores e casinhas instanciadas, 22 bonequinhos voxel com etiqueta de nome, bola low-poly.
- Câmera isométrica 45° que segue a bola, aproxima nas chances e no gol, e gira para o lado
  perto das linhas de fundo para a arquibancada não tapar o gol.
- HUD: placar com escudos procedurais, relógio, banner de GOL / cartão / intervalo / fim, ticker de
  narração, play/pause, velocidade 1x/2x/4x, mudo, etiquetas, nova partida, barra de progresso com seek.
- Sons: apito, chute, torcida em loop, comemoração, lamento. Mudo no HUD.
- Guarda de desempenho: se o fps médio ficar abaixo de 28 por 3 s, o pixel ratio cai para 1 ("modo leve").
- Bundle de produção: ~650 KB (≈180 KB gzip), abaixo do limite de 1,5 MB.

Fora do escopo desta fase (planejado): postprocessing (fica atrás de flag na Fase 2 se sobrar orçamento
de fps), troca de lado no segundo tempo, seed do IBGE (a Fase 1 usa 24 municípios de exemplo em
`src/engine/sampleCities.ts`).

### O que testar manualmente no celular

1. Abra o link no navegador do Instagram ou no Chrome/Safari. O card inicial deve aparecer com dois
   clubes de cidades diferentes, escudos e táticas.
2. Toque em "Assistir ao jogo". O apito deve tocar (o toque libera o áudio no iOS) e a torcida deve
   murmurar ao fundo. Teste o botão de mudo.
3. Confira que a cena roda fluida (meta: 30 fps em celular intermediário). Se aparecer "modo leve
   ativado", o aparelho caiu abaixo de 28 fps e a qualidade foi reduzida automaticamente.
4. Assista a uma chance: passe, chute com arco, defesa ou gol. No gol: zoom, banner "GOL!" com o nome,
   torcida pulando, comemoração no canto.
5. Use a barra de progresso para pular no tempo e os botões 2x/4x. O placar e o relógio devem
   acompanhar o salto (nada "quebra" ao voltar no tempo).
6. Abra o mesmo link com a mesma `seed` em outro aparelho: placar, gols e minutos devem ser idênticos.
7. Gire o celular (retrato ↔ paisagem) e confirme que o HUD não cobre o campo.
8. Toque em "nova" para sortear outra seed (a URL muda e pode ser compartilhada).

## Regras do projeto

- Nenhuma API de IA nem API paga em tempo de execução.
- Nenhuma marca real: nomes, escudos e cores são procedurais.
- Toda aleatoriedade do motor e do replay vem de `createRng(seed)`; `Math.random` só é usado para
  sortear uma seed nova e para o tremor cosmético da câmera.
