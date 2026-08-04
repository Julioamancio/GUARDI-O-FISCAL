'use client';

import { useEffect, useRef } from 'react';

/**
 * "Bola de vidro" — efeito portado do site ingles.destruitor.com.br (do mesmo
 * autor): um campo de poeira à deriva e uma esfera INVISÍVEL sob o cursor.
 * A bola nunca é desenhada; os pontos sob ela se afastam do centro e crescem,
 * como visto através de uma lente — o olho monta a esfera sozinho.
 * Respeita "reduzir movimento" e pausa em aba oculta.
 */
export function GlassDust() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const tela = canvasRef.current;
    const palco = tela?.parentElement;
    if (!tela || !palco) return;
    const ctx = tela.getContext('2d');
    if (!ctx) return;

    const DENSIDADE = 320;
    const TETO = 1800;
    const PISO = 220;
    const LENTE = 1.02;
    const PERSEGUE = 0.22;
    const NIVEIS = 24;
    const TAU = Math.PI * 2;
    const COR_PONTO = '255, 255, 255';
    const COR_BRILHO = '182, 211, 246';

    interface Ponto { x: number; y: number; vx: number; vy: number; r: number; o: number }
    let pontos: Ponto[] = [];
    let larg = 0;
    let alt = 0;
    let raio = 0;
    let quadro = 0;
    let anterior = 0;
    let visivel = true;
    let cursorX = 0;
    let cursorY = 0;
    let bolaX = 0;
    let bolaY = 0;
    let forca = 0;
    let alvoForca = 0;

    const paleta: string[] = [];
    for (let i = 0; i < NIVEIS; i++) {
      paleta.push(`rgba(${COR_PONTO}, ${((i + 1) / NIVEIS).toFixed(3)})`);
    }

    const menosMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');
    const temHover = window.matchMedia('(hover: hover) and (pointer: fine)');
    const parado = () => menosMovimento.matches;

    function novo(): Ponto {
      const g = Math.pow(Math.random(), 2.4); // 0 = grão fino, 1 = graúdo
      return {
        x: Math.random() * larg,
        y: Math.random() * alt,
        vx: (Math.random() - 0.5) * 0.13,
        vy: (Math.random() - 0.5) * 0.13,
        r: 0.28 + g * 1.75,
        o: 0.14 + g * 0.6 + Math.random() * 0.14,
      };
    }

    function medir() {
      const b = palco!.getBoundingClientRect();
      const novaL = Math.max(1, Math.round(b.width));
      const novaA = Math.max(1, Math.round(b.height));
      if (novaL === larg && novaA === alt) return;
      if (larg && alt) {
        const fx = novaL / larg;
        const fy = novaA / alt;
        for (const p of pontos) {
          p.x *= fx;
          p.y *= fy;
        }
      }
      larg = novaL;
      alt = novaA;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      tela!.width = Math.round(larg * dpr);
      tela!.height = Math.round(alt * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      raio = Math.max(105, Math.min(215, Math.min(larg, alt) * 0.38));
      const alvo = Math.max(PISO, Math.min(TETO, Math.round((larg * alt) / DENSIDADE)));
      while (pontos.length > alvo) pontos.pop();
      while (pontos.length < alvo) pontos.push(novo());
    }

    function passo(dt: number) {
      bolaX += (cursorX - bolaX) * Math.min(1, PERSEGUE * dt);
      bolaY += (cursorY - bolaY) * Math.min(1, PERSEGUE * dt);
      forca += (alvoForca - forca) * Math.min(1, 0.1 * dt);
      for (const p of pontos) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < -8) p.x = larg + 8;
        else if (p.x > larg + 8) p.x = -8;
        if (p.y < -8) p.y = alt + 8;
        else if (p.y > alt + 8) p.y = -8;
      }
    }

    function pintar() {
      ctx!.clearRect(0, 0, larg, alt);
      const brilhando = forca > 0.01;
      const raio2 = raio * raio;

      // Clarão fraquíssimo sob a bola: evita que a distorção pareça um buraco
      if (brilhando) {
        const g = ctx!.createRadialGradient(bolaX, bolaY, 0, bolaX, bolaY, raio);
        g.addColorStop(0, `rgba(${COR_BRILHO}, ${(0.11 * forca).toFixed(3)})`);
        g.addColorStop(0.6, `rgba(${COR_BRILHO}, ${(0.035 * forca).toFixed(3)})`);
        g.addColorStop(1, `rgba(${COR_BRILHO}, 0)`);
        ctx!.fillStyle = g;
        ctx!.beginPath();
        ctx!.arc(bolaX, bolaY, raio, 0, TAU);
        ctx!.fill();
      }

      let nivelAtual = -1;
      for (const p of pontos) {
        let x = p.x;
        let y = p.y;
        let r = p.r;
        let o = p.o;

        if (brilhando) {
          const dx = p.x - bolaX;
          const dy = p.y - bolaY;
          const d2 = dx * dx + dy * dy;
          if (d2 < raio2) {
            const t = 1 - d2 / raio2; // 1 no centro, 0 na borda
            const lupa = 1 + LENTE * t * t * forca;
            x = bolaX + dx * lupa; // empurra para fora ao longo do raio
            y = bolaY + dy * lupa;
            r = p.r * (1 + 1.15 * t * forca); // cresce e acende junto
            o = p.o * (1 + 0.7 * t * forca);
          }
        }

        let nivel = Math.round(o * 0.9 * NIVEIS) - 1;
        if (nivel < 0) continue;
        if (nivel >= NIVEIS) nivel = NIVEIS - 1;
        if (nivel !== nivelAtual) {
          ctx!.fillStyle = paleta[nivel];
          nivelAtual = nivel;
        }
        if (r < 1) {
          const l = r + r;
          ctx!.fillRect(x - r, y - r, l, l);
        } else {
          ctx!.beginPath();
          ctx!.arc(x, y, r, 0, TAU);
          ctx!.fill();
        }
      }

      // Fio de luz na borda: é o que fecha a leitura em "bola" — sutil de propósito
      if (brilhando) {
        const borda = ctx!.createRadialGradient(bolaX, bolaY, raio * 0.82, bolaX, bolaY, raio * 1.04);
        borda.addColorStop(0, `rgba(${COR_BRILHO}, 0)`);
        borda.addColorStop(0.72, `rgba(${COR_BRILHO}, ${(0.16 * forca).toFixed(3)})`);
        borda.addColorStop(0.9, `rgba(${COR_BRILHO}, ${(0.05 * forca).toFixed(3)})`);
        borda.addColorStop(1, `rgba(${COR_BRILHO}, 0)`);
        ctx!.fillStyle = borda;
        ctx!.beginPath();
        ctx!.arc(bolaX, bolaY, raio * 1.04, 0, TAU);
        ctx!.fill();
      }
    }

    function laco(agora: number) {
      quadro = 0;
      const dt = anterior ? Math.min(3, (agora - anterior) / 16.7) : 1;
      anterior = agora;
      passo(dt);
      pintar();
      if (visivel && !parado()) quadro = requestAnimationFrame(laco);
    }

    function tocar() {
      if (!quadro && visivel && !parado()) {
        anterior = 0;
        quadro = requestAnimationFrame(laco);
      }
    }

    const aoMover = (e: PointerEvent) => {
      if (!temHover.matches) return;
      const b = palco!.getBoundingClientRect();
      cursorX = e.clientX - b.left;
      cursorY = e.clientY - b.top;
      alvoForca = 1;
      tocar();
    };
    const aoSair = () => {
      alvoForca = 0;
    };
    const aoVisibilidade = () => {
      visivel = document.visibilityState === 'visible';
      if (visivel) tocar();
    };

    medir();
    bolaX = larg / 2;
    bolaY = alt / 2;
    const observador = new ResizeObserver(() => {
      medir();
      tocar();
    });
    observador.observe(palco);
    palco.addEventListener('pointermove', aoMover);
    palco.addEventListener('pointerleave', aoSair);
    document.addEventListener('visibilitychange', aoVisibilidade);
    menosMovimento.addEventListener?.('change', tocar);
    tocar();
    if (parado()) pintar(); // com movimento reduzido, ao menos a poeira estática

    return () => {
      if (quadro) cancelAnimationFrame(quadro);
      observador.disconnect();
      palco.removeEventListener('pointermove', aoMover);
      palco.removeEventListener('pointerleave', aoSair);
      document.removeEventListener('visibilitychange', aoVisibilidade);
      menosMovimento.removeEventListener?.('change', tocar);
    };
  }, []);

  // A máscara apaga a poeira sobre a área do texto (esquerda) — as estrelinhas
  // só aparecem na metade direita, onde não atrapalham a leitura.
  const mask =
    'linear-gradient(to right, transparent 0%, transparent 52%, black 80%, black 100%)';
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 h-full w-full"
      style={{ WebkitMaskImage: mask, maskImage: mask }}
    />
  );
}
