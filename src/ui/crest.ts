import type { Crest } from '../engine/types';

const cache = new Map<string, string>();

/** Procedural club crest rendered on a canvas (shape + colour split + simple icon). Returns a data URL. */
export function crestDataUrl(crest: Crest, colors: [string, string], size = 96): string {
  const key = `${crest.shape}|${crest.split}|${crest.icon}|${colors.join()}|${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const s = size;
  const [a, b] = colors;

  const shapePath = () => {
    ctx.beginPath();
    switch (crest.shape) {
      case 'circle':
        ctx.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
        break;
      case 'diamond':
        ctx.moveTo(s / 2, s * 0.06);
        ctx.lineTo(s * 0.94, s / 2);
        ctx.lineTo(s / 2, s * 0.94);
        ctx.lineTo(s * 0.06, s / 2);
        ctx.closePath();
        break;
      case 'hex':
        for (let i = 0; i < 6; i++) {
          const ang = (Math.PI / 3) * i - Math.PI / 6;
          const x = s / 2 + Math.cos(ang) * s * 0.44;
          const y = s / 2 + Math.sin(ang) * s * 0.44;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        break;
      case 'shield':
      default:
        ctx.moveTo(s * 0.12, s * 0.1);
        ctx.lineTo(s * 0.88, s * 0.1);
        ctx.lineTo(s * 0.88, s * 0.55);
        ctx.quadraticCurveTo(s * 0.88, s * 0.82, s / 2, s * 0.94);
        ctx.quadraticCurveTo(s * 0.12, s * 0.82, s * 0.12, s * 0.55);
        ctx.closePath();
    }
  };

  shapePath();
  ctx.fillStyle = a;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = b;
  switch (crest.split) {
    case 'half':
      ctx.fillRect(s / 2, 0, s / 2, s);
      break;
    case 'stripes':
      for (let x = 0; x < s; x += s / 5) ctx.fillRect(x, 0, s / 10, s);
      break;
    case 'band':
      ctx.save();
      ctx.translate(s / 2, s / 2);
      ctx.rotate(-Math.PI / 4);
      ctx.fillRect(-s, -s * 0.12, s * 2, s * 0.24);
      ctx.restore();
      break;
    default:
      break;
  }
  // icon
  ctx.restore();
  ctx.save();
  shapePath();
  ctx.clip();
  const iconColor = luminance(a) > 0.5 && luminance(b) > 0.5 ? '#1d1d1d' : '#ffffff';
  ctx.fillStyle = iconColor;
  ctx.strokeStyle = iconColor;
  ctx.lineWidth = s * 0.06;
  ctx.lineCap = 'round';
  const cx = s / 2;
  const cy = s * 0.5;
  const r = s * 0.17;
  ctx.beginPath();
  switch (crest.icon) {
    case 'star':
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 ? r * 0.45 : r;
        const ang = (Math.PI / 5) * i - Math.PI / 2;
        const x = cx + Math.cos(ang) * rr;
        const y = cy + Math.sin(ang) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      break;
    case 'ball':
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = a;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'bolt':
      ctx.moveTo(cx + r * 0.3, cy - r * 1.2);
      ctx.lineTo(cx - r * 0.6, cy + r * 0.15);
      ctx.lineTo(cx + r * 0.05, cy + r * 0.15);
      ctx.lineTo(cx - r * 0.3, cy + r * 1.2);
      ctx.lineTo(cx + r * 0.6, cy - r * 0.15);
      ctx.lineTo(cx - r * 0.05, cy - r * 0.15);
      ctx.closePath();
      ctx.fill();
      break;
    case 'sun':
      ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 8; i++) {
        const ang = (Math.PI / 4) * i;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * r * 0.85, cy + Math.sin(ang) * r * 0.85);
        ctx.lineTo(cx + Math.cos(ang) * r * 1.3, cy + Math.sin(ang) * r * 1.3);
        ctx.stroke();
      }
      break;
    case 'wave':
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(cx - r * 1.2, cy + k * r * 0.6);
        ctx.quadraticCurveTo(cx - r * 0.6, cy + k * r * 0.6 - r * 0.5, cx, cy + k * r * 0.6);
        ctx.quadraticCurveTo(cx + r * 0.6, cy + k * r * 0.6 + r * 0.5, cx + r * 1.2, cy + k * r * 0.6);
        ctx.stroke();
      }
      break;
    case 'tree':
      ctx.moveTo(cx, cy - r * 1.2);
      ctx.lineTo(cx + r, cy + r * 0.5);
      ctx.lineTo(cx - r, cy + r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(cx - r * 0.18, cy + r * 0.5, r * 0.36, r * 0.6);
      break;
    case 'bird':
      ctx.moveTo(cx - r * 1.2, cy);
      ctx.quadraticCurveTo(cx - r * 0.6, cy - r * 0.9, cx, cy);
      ctx.quadraticCurveTo(cx + r * 0.6, cy - r * 0.9, cx + r * 1.2, cy);
      ctx.stroke();
      break;
    case 'anchor':
      ctx.arc(cx, cy - r * 0.8, r * 0.25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.55);
      ctx.lineTo(cx, cy + r * 1.0);
      ctx.moveTo(cx - r * 0.7, cy - r * 0.1);
      ctx.lineTo(cx + r * 0.7, cy - r * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.2, r * 0.8, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      break;
  }
  ctx.restore();
  // thick dark outline
  shapePath();
  ctx.lineWidth = s * 0.06;
  ctx.strokeStyle = '#1d1d1d';
  ctx.lineJoin = 'round';
  ctx.stroke();
  const url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
