/*
 * Generative poster art. Each title gets an original illustrated scene chosen
 * by its primary genre; the layout, palette, and details are derived from a
 * seed built from the title's id and name, so every poster is unique and the
 * same title always renders the same artwork.
 */
const Posters = (() => {
  // Portrait key art is 200x300 (2:3). Wide backdrops widen the canvas to
  // 480x300 so scenes extend sideways instead of being stretched.
  let W = 200;
  const H = 300;
  let seq = 0;

  function seedFrom(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i += 1) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }

  function rng(seed) {
    let a = seed;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // A shared grade (reduced saturation) keeps every scene in the same
  // restrained, filmic palette so the artwork reads as one series.
  const hsl = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${Math.round(s * 0.5)}%,${Math.min(l, 78)}%,${a})`;
  const f = (n) => Math.round(n * 10) / 10;

  function sky(id, top, bottom) {
    return {
      defs: `<linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`,
      body: `<rect width="${W}" height="${H}" fill="url(#${id}-sky)"/>`,
    };
  }

  function stars(r, n, maxY = H) {
    let s = '';
    for (let i = 0; i < n; i += 1) {
      s += `<circle cx="${f(r() * W)}" cy="${f(r() * maxY)}" r="${f(0.3 + r() * 1.1)}" fill="#fff" opacity="${f(0.3 + r() * 0.7)}"/>`;
    }
    return s;
  }

  function ridge(r, baseY, amp, step, fill) {
    let d = `M0 ${H} L0 ${f(baseY)}`;
    for (let x = 0; x <= W + step; x += step) {
      d += ` L${f(x)} ${f(baseY - r() * amp)}`;
    }
    return `<path d="${d} L${W} ${H} Z" fill="${fill}"/>`;
  }

  function hills(r, baseY, amp, fill) {
    const a = baseY - r() * amp;
    const b = baseY - r() * amp;
    return `<path d="M0 ${H} L0 ${f(a)} C ${f(W * 0.3)} ${f(a - amp)}, ${f(W * 0.6)} ${f(b + amp * 0.6)}, ${W} ${f(b)} L${W} ${H} Z" fill="${fill}"/>`;
  }

  function figure(x, groundY, scale, fill) {
    const s = scale;
    return `<g fill="${fill}"><circle cx="${f(x)}" cy="${f(groundY - 34 * s)}" r="${f(5 * s)}"/>`
      + `<path d="M${f(x - 7 * s)} ${f(groundY)} L${f(x - 5 * s)} ${f(groundY - 28 * s)} Q${f(x)} ${f(groundY - 31 * s)} ${f(x + 5 * s)} ${f(groundY - 28 * s)} L${f(x + 7 * s)} ${f(groundY)} Z"/></g>`;
  }

  // Foreground subject for sunset scenes: a couple, a sailboat, or a pier.
  function sunsetSubject(r, sx, horizon, ink) {
    const pick = r();
    if (pick < 0.34) return figure(sx - 9, horizon, 1.1, ink) + figure(sx + 9, horizon, 1.2, ink);
    if (pick < 0.67) {
      const bx = sx + (r() - 0.5) * 60;
      const by = horizon + 18;
      return `<g fill="${ink}"><path d="M${f(bx - 22)} ${f(by)} L${f(bx + 22)} ${f(by)} L${f(bx + 15)} ${f(by + 7)} L${f(bx - 15)} ${f(by + 7)} Z"/>`
        + `<rect x="${f(bx - 1)}" y="${f(by - 46)}" width="2" height="46"/>`
        + `<path d="M${f(bx + 2)} ${f(by - 44)} L${f(bx + 2)} ${f(by - 4)} L${f(bx + 26)} ${f(by - 4)} Z"/>`
        + `<path d="M${f(bx - 2)} ${f(by - 36)} L${f(bx - 2)} ${f(by - 4)} L${f(bx - 18)} ${f(by - 4)} Z"/></g>`;
    }
    const end = sx + 10;
    const py = horizon + 34;
    let posts = '';
    for (let x = 0; x < end; x += 16) posts += `<rect x="${f(x)}" y="${f(py)}" width="2.5" height="${f(H - py)}"/>`;
    return `<g fill="${ink}"><rect x="0" y="${f(py - 4)}" width="${f(end + 6)}" height="5"/>${posts}</g>`
      + figure(end - 2, py - 4, 1.1, ink);
  }

  const scenes = {
    'Sci-Fi'(r, h, id) {
      const g = sky(id, hsl(h + 200, 60, 6), hsl(h + 240, 55, 22));
      const px = 40 + r() * 120;
      const py = 70 + r() * 70;
      const pr = 34 + r() * 26;
      const tilt = -25 + r() * 50;
      return {
        defs: g.defs + `<radialGradient id="${id}-pl" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${hsl(h, 75, 68)}"/><stop offset="1" stop-color="${hsl(h + 30, 60, 18)}"/></radialGradient>`,
        body: g.body + stars(r, 60)
          + `<circle cx="${f(px)}" cy="${f(py)}" r="${f(pr * 1.5)}" fill="${hsl(h, 80, 60, 0.12)}"/>`
          + `<circle cx="${f(px)}" cy="${f(py)}" r="${f(pr)}" fill="url(#${id}-pl)"/>`
          + `<ellipse cx="${f(px)}" cy="${f(py)}" rx="${f(pr * 1.8)}" ry="${f(pr * 0.35)}" fill="none" stroke="${hsl(h + 40, 70, 80, 0.7)}" stroke-width="2.5" transform="rotate(${f(tilt)} ${f(px)} ${f(py)})"/>`
          + `<circle cx="${f(W - px * 0.6)}" cy="${f(py + 80 + r() * 40)}" r="${f(6 + r() * 8)}" fill="${hsl(h + 180, 30, 75)}"/>`
          + ridge(r, 265, 25, 22, hsl(h + 220, 40, 7)),
      };
    },

    Horror(r, h, id) {
      const g = sky(id, hsl(h, 35, 5), hsl(h + 340, 45, 20));
      const mx = 55 + r() * 90;
      const my = 60 + r() * 50;
      const mr = 26 + r() * 14;
      let trees = '';
      for (let x = -10; x < W + 20; x += 14 + r() * 18) {
        const top = 120 + r() * 90;
        const w = 4 + r() * 6;
        trees += `<path d="M${f(x - w)} ${H} L${f(x)} ${f(top)} L${f(x + w)} ${H} Z"/>`;
        for (let b = 0; b < 3; b += 1) {
          const by = top + 20 + r() * (H - top - 60);
          const dir = r() > 0.5 ? 1 : -1;
          trees += `<path d="M${f(x)} ${f(by)} L${f(x + dir * (14 + r() * 16))} ${f(by - 12 - r() * 14)}" stroke="#040405" stroke-width="2"/>`;
        }
      }
      return {
        defs: g.defs,
        body: g.body
          + `<circle cx="${f(mx)}" cy="${f(my)}" r="${f(mr * 2.2)}" fill="#fff" opacity=".06"/>`
          + `<circle cx="${f(mx)}" cy="${f(my)}" r="${f(mr)}" fill="#efe9d6" opacity=".92"/>`
          + `<g fill="#040405">${trees}</g>`
          + `<rect y="${H - 30}" width="${W}" height="30" fill="#040405"/>`,
      };
    },

    Crime(r, h, id, opts = {}) {
      if (!opts.rain) {
        const pick = r();
        if (pick < 0.3) return scenes.Bridge(r, h, id);
        if (pick < 0.5) return scenes.Window(r, h + 180, id);
      }
      return scenes.Skyline(r, h, id, opts);
    },

    Skyline(r, h, id, opts = {}) {
      const g = sky(id, hsl(h + 220, 45, 9), hsl(h + 260, 45, 30));
      let city = '';
      let x = -5;
      while (x < W) {
        const w = 16 + r() * 24;
        const bh = 70 + r() * 140;
        const y = H - bh;
        city += `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(bh)}" fill="${hsl(h + 230, 30, 6)}"/>`;
        for (let wy = y + 8; wy < H - 10; wy += 9) {
          for (let wx = x + 4; wx < x + w - 4; wx += 7) {
            if (r() < 0.32) city += `<rect x="${f(wx)}" y="${f(wy)}" width="3" height="4" fill="${hsl(42 + r() * 15, 95, 70)}" opacity="${f(0.5 + r() * 0.5)}"/>`;
          }
        }
        x += w + r() * 3;
      }
      let rain = '';
      if (opts.rain) {
        for (let i = 0; i < 70; i += 1) {
          const rx = r() * (W + 40);
          const ry = r() * H;
          rain += `<line x1="${f(rx)}" y1="${f(ry)}" x2="${f(rx - 6)}" y2="${f(ry + 18)}" stroke="#fff" stroke-opacity="${f(0.08 + r() * 0.15)}" stroke-width="1"/>`;
        }
      }
      return {
        defs: g.defs,
        body: g.body + `<circle cx="${f(30 + r() * 140)}" cy="${f(50 + r() * 40)}" r="18" fill="${hsl(h, 30, 85, 0.5)}"/>` + city + rain,
      };
    },

    Thriller(r, h, id) {
      const pick = r();
      if (pick < 0.4) return scenes.Road(r, h + 200, id, { night: true });
      if (pick < 0.7) return scenes.Bridge(r, h + 140, id);
      return scenes.Crime(r, h + 140, id, { rain: true });
    },

    Bridge(r, h, id) {
      const g = sky(id, hsl(h + 220, 40, 8), hsl(h + 250, 40, 26));
      const deck = 172 + r() * 16;
      const t1 = W * (0.22 + r() * 0.08);
      const t2 = W * (0.68 + r() * 0.08);
      const top = deck - 70 - r() * 20;
      const ink = hsl(h + 230, 30, 6);
      let lights = '';
      for (let x = 4; x < W; x += 9) lights += `<circle cx="${f(x)}" cy="${f(deck - 2)}" r="1.1" fill="${hsl(40, 95, 72)}"/>`;
      let reflect = '';
      for (let x = 6; x < W; x += 9 + r() * 6) {
        reflect += `<rect x="${f(x)}" y="${f(deck + 14 + r() * 8)}" width="1.6" height="${f(20 + r() * 50)}" fill="${hsl(40, 95, 70)}" opacity="${f(0.15 + r() * 0.25)}"/>`;
      }
      const cable = (x0, x1) => `<path d="M${f(x0)} ${f(top)} Q${f((x0 + x1) / 2)} ${f(deck - 6)} ${f(x1)} ${f(top)}" fill="none" stroke="${ink}" stroke-width="1.6"/>`;
      return {
        defs: g.defs,
        body: g.body + stars(r, 25, deck - 40)
          + `<rect y="${f(deck + 8)}" width="${W}" height="${f(H - deck)}" fill="${hsl(h + 225, 35, 9)}"/>` + reflect
          + `<path d="M${f(-W * 0.2)} ${f(deck + 30)} Q${f(t1 * 0.5)} ${f(top + 30)} ${f(t1)} ${f(top)}" fill="none" stroke="${ink}" stroke-width="1.6"/>`
          + cable(t1, t2)
          + `<path d="M${f(t2)} ${f(top)} Q${f(t2 + (W - t2) * 0.5)} ${f(top + 30)} ${f(W * 1.2)} ${f(deck + 30)}" fill="none" stroke="${ink}" stroke-width="1.6"/>`
          + `<rect x="${f(t1 - 4)}" y="${f(top - 4)}" width="8" height="${f(deck - top + 40)}" fill="${ink}"/>`
          + `<rect x="${f(t2 - 4)}" y="${f(top - 4)}" width="8" height="${f(deck - top + 40)}" fill="${ink}"/>`
          + `<rect y="${f(deck)}" width="${W}" height="6" fill="${ink}"/>` + lights,
      };
    },

    Road(r, h, id, opts = {}) {
      const g = opts.night ? sky(id, hsl(h + 230, 45, 7), hsl(h + 260, 40, 24)) : sky(id, hsl(h + 200, 35, 30 + r() * 14), hsl(h + 20 + r() * 40, 70, 62 + r() * 12));
      const horizon = 120 + r() * 70;
      const vx = W * (0.25 + r() * 0.5);
      const ground = opts.night ? hsl(h + 230, 25, 8) : hsl(h + 60, 25, 26);
      let dashes = '';
      for (let i = 0; i < 9; i += 1) {
        const t0 = (i / 9) ** 2;
        const t1 = ((i + 0.45) / 9) ** 2;
        const y0 = horizon + (H - horizon) * t0;
        const y1 = horizon + (H - horizon) * t1;
        dashes += `<path d="M${f(vx)} ${f(y0)} L${f(vx)} ${f(y1)}" stroke="${opts.night ? '#e9d9a6' : '#efe6cf'}" stroke-width="${f(0.6 + t1 * 4)}" opacity=".8"/>`;
      }
      let poles = '';
      for (let i = 1; i <= 5; i += 1) {
        const t = (i / 6) ** 1.6;
        const x = vx + (W * 0.75) * t;
        const y = horizon + (H - horizon) * t;
        poles += `<rect x="${f(x)}" y="${f(y - 10 - t * 110)}" width="${f(0.8 + t * 3)}" height="${f(10 + t * 110)}" fill="#0b0b0e"/>`;
      }
      return {
        defs: g.defs,
        body: g.body
          + (opts.night ? stars(r, 30, horizon - 10) : `<circle cx="${f(vx + (r() - 0.5) * 120)}" cy="${f(horizon - 6 - r() * 40)}" r="${f(12 + r() * 14)}" fill="${hsl(38, 90, 84)}" opacity=".9"/>`)
          + `<rect y="${f(horizon)}" width="${W}" height="${f(H - horizon)}" fill="${ground}"/>`
          + `<path d="M${f(vx - 2)} ${f(horizon)} L${f(vx + 2)} ${f(horizon)} L${f(vx + W * 0.42)} ${H} L${f(vx - W * 0.42)} ${H} Z" fill="${hsl(h + 220, 10, opts.night ? 12 : 20)}"/>`
          + dashes + poles
          + (opts.night ? `<circle cx="${f(vx - 3)}" cy="${f(horizon + 4)}" r="2" fill="#ffefb8"/><circle cx="${f(vx + 3)}" cy="${f(horizon + 4)}" r="2" fill="#ffefb8"/>` : ''),
      };
    },

    Window(r, h, id) {
      const wall = hsl(h + 20, 20, 9);
      const wx = W * 0.5 - 52;
      const wy = 54 + r() * 20;
      const ww = 104;
      const wh = 150;
      const sky1 = hsl(h + 220, 45, 16);
      const sky2 = hsl(h + 260, 45, 34);
      let st = '';
      for (let i = 0; i < 14; i += 1) st += `<circle cx="${f(wx + 6 + r() * (ww - 12))}" cy="${f(wy + 6 + r() * (wh * 0.6))}" r="${f(0.4 + r() * 0.9)}" fill="#fff" opacity="${f(0.4 + r() * 0.6)}"/>`;
      return {
        defs: `<linearGradient id="${id}-win" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky1}"/><stop offset="1" stop-color="${sky2}"/></linearGradient>`
          + `<radialGradient id="${id}-lamp" cx="20%" cy="85%" r="70%"><stop offset="0" stop-color="${hsl(38, 90, 60)}" stop-opacity=".35"/><stop offset="1" stop-color="${hsl(38, 90, 60)}" stop-opacity="0"/></radialGradient>`,
        body: `<rect width="${W}" height="${H}" fill="${wall}"/><rect width="${W}" height="${H}" fill="url(#${id}-lamp)"/>`
          + `<rect x="${f(wx)}" y="${f(wy)}" width="${ww}" height="${wh}" fill="url(#${id}-win)"/>` + st
          + `<circle cx="${f(wx + ww * (0.25 + r() * 0.5))}" cy="${f(wy + 34)}" r="11" fill="#f3ead2" opacity=".9"/>`
          + `<path d="M${f(wx)} ${f(wy + wh)} L${f(wx)} ${f(wy + wh - 34 - r() * 20)} L${f(wx + 30)} ${f(wy + wh - 20)} L${f(wx + 56)} ${f(wy + wh - 44 - r() * 16)} L${f(wx + ww)} ${f(wy + wh - 18)} L${f(wx + ww)} ${f(wy + wh)} Z" fill="${hsl(h + 230, 30, 7)}"/>`
          + `<rect x="${f(wx + ww / 2 - 2)}" y="${f(wy)}" width="4" height="${wh}" fill="${wall}"/><rect x="${f(wx)}" y="${f(wy + wh / 2 - 2)}" width="${ww}" height="4" fill="${wall}"/>`
          + `<rect x="${f(wx - 6)}" y="${f(wy - 6)}" width="${ww + 12}" height="${wh + 12}" fill="none" stroke="${hsl(h + 20, 15, 5)}" stroke-width="6"/>`
          + `<path d="M${f(wx - 14)} ${f(wy - 10)} Q${f(wx + 10)} ${f(wy + wh * 0.5)} ${f(wx - 4)} ${f(wy + wh + 30)} L${f(wx - 30)} ${f(wy + wh + 30)} L${f(wx - 30)} ${f(wy - 10)} Z" fill="${hsl(h + 10, 30, 16)}"/>`
          + `<path d="M${f(wx + ww + 14)} ${f(wy - 10)} Q${f(wx + ww - 10)} ${f(wy + wh * 0.5)} ${f(wx + ww + 4)} ${f(wy + wh + 30)} L${f(wx + ww + 30)} ${f(wy + wh + 30)} L${f(wx + ww + 30)} ${f(wy - 10)} Z" fill="${hsl(h + 10, 30, 16)}"/>`
          + `<rect x="${f(wx - 16)}" y="${f(wy + wh + 6)}" width="${ww + 32}" height="7" fill="${hsl(h + 20, 15, 5)}"/>`
          + `<path d="M${f(wx + ww - 26)} ${f(wy + wh + 6)} l4 -16 h10 l4 16 Z" fill="#0a0a0a"/><path d="M${f(wx + ww - 19)} ${f(wy + wh - 10)} q-8 -14 -2 -24 q4 10 4 24 q2 -16 10 -20 q-2 14 -6 20 Z" fill="#0a0a0a"/>`,
      };
    },

    Mystery(r, h, id) {
      const g = sky(id, hsl(h + 200, 25, 22), hsl(h + 220, 25, 7));
      const lx = 45 + r() * 110;
      let fog = '';
      for (let i = 0; i < 5; i += 1) {
        fog += `<ellipse cx="${f(r() * W)}" cy="${f(170 + r() * 110)}" rx="${f(90 + r() * 70)}" ry="${f(14 + r() * 14)}" fill="#fff" opacity="${f(0.05 + r() * 0.07)}"/>`;
      }
      return {
        defs: g.defs + `<linearGradient id="${id}-cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a8" stop-opacity=".45"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></linearGradient>`,
        body: g.body
          + `<path d="M${f(lx - 3)} 92 L${f(lx - 45)} ${H - 22} L${f(lx + 45)} ${H - 22} L${f(lx + 3)} 92 Z" fill="url(#${id}-cone)"/>`
          + `<rect x="${f(lx - 1.5)}" y="88" width="3" height="${H - 108}" fill="#0b0c10"/>`
          + `<rect x="${f(lx - 7)}" y="80" width="14" height="10" rx="2" fill="#0b0c10"/>`
          + `<circle cx="${f(lx)}" cy="91" r="4" fill="#ffe9a8"/>`
          + figure(lx + (r() > 0.5 ? 26 : -26), H - 22, 1.4, '#0b0c10')
          + `<rect y="${H - 22}" width="${W}" height="22" fill="#0b0c10"/>` + fog,
      };
    },

    Fantasy(r, h, id) {
      const g = sky(id, hsl(h + 250, 50, 16), hsl(h + 300, 55, 48));
      const cx = 60 + r() * 80;
      const base = 205 + r() * 20;
      const dark = hsl(h + 260, 40, 8);
      let castle = `<rect x="${f(cx - 34)}" y="${f(base - 40)}" width="68" height="60" fill="${dark}"/>`;
      const towers = [[-40, 70, 12], [36, 62, 11], [-4, 95, 14]];
      for (const [dx, th, tw] of towers) {
        const tx = cx + dx;
        castle += `<rect x="${f(tx - tw / 2)}" y="${f(base - th)}" width="${tw}" height="${th + 20}" fill="${dark}"/>`
          + `<path d="M${f(tx - tw / 2 - 3)} ${f(base - th)} L${f(tx)} ${f(base - th - 22)} L${f(tx + tw / 2 + 3)} ${f(base - th)} Z" fill="${dark}"/>`
          + `<rect x="${f(tx - 1.5)}" y="${f(base - th + 12)}" width="3" height="5" fill="#ffd27a"/>`;
      }
      return {
        defs: g.defs,
        body: g.body + stars(r, 30, 140)
          + `<circle cx="${f(W - cx)}" cy="${f(55 + r() * 30)}" r="${f(14 + r() * 8)}" fill="#fff6dc" opacity=".9"/>`
          + castle
          + hills(r, base + 18, 20, dark)
          + hills(r, 270, 18, hsl(h + 260, 35, 5)),
      };
    },

    Romance(r, h, id) {
      return r() < 0.4 ? scenes.Window(r, h + 20, id) : scenes.Sunset(r, h, id);
    },

    Sunset(r, h, id) {
      const warm = 340 + (h % 60);
      const g = sky(id, hsl(warm, 55, 46), hsl(warm + 40, 75, 64));
      const sx = 50 + r() * 100;
      const horizon = 195 + r() * 15;
      let glints = '';
      for (let y = horizon + 8; y < H; y += 9) {
        const w = 10 + r() * 40;
        glints += `<rect x="${f(sx - w / 2 + (r() - 0.5) * 20)}" y="${f(y)}" width="${f(w)}" height="2" rx="1" fill="#fff" opacity="${f(0.25 + r() * 0.35)}"/>`;
      }
      return {
        defs: g.defs,
        body: g.body
          + `<circle cx="${f(sx)}" cy="${f(horizon - 10)}" r="${f(38 + r() * 12)}" fill="${hsl(warm + 50, 95, 85)}" opacity=".95"/>`
          + `<rect y="${f(horizon)}" width="${W}" height="${f(H - horizon)}" fill="${hsl(warm + 10, 45, 38)}"/>`
          + glints
          + sunsetSubject(r, sx, horizon, hsl(warm, 40, 13)),
      };
    },

    Comedy(r, h, id) {
      if (r() < 0.45) return scenes.Balloon(r, h + 60, id);
      const g = sky(id, hsl(h + 30, 80, 44), hsl(h + 60, 75, 34));
      const cx = W / 2;
      const cy = 120;
      let rays = '';
      for (let i = 0; i < 18; i += 2) {
        const a1 = (i / 18) * Math.PI * 2;
        const a2 = ((i + 1) / 18) * Math.PI * 2;
        rays += `<path d="M${cx} ${cy} L${f(cx + Math.cos(a1) * 260)} ${f(cy + Math.sin(a1) * 260)} L${f(cx + Math.cos(a2) * 260)} ${f(cy + Math.sin(a2) * 260)} Z" fill="#fff" opacity=".12"/>`;
      }
      let confetti = '';
      for (let i = 0; i < 18; i += 1) {
        const x = r() * W;
        const y = r() * H;
        const c = hsl(h + r() * 360, 90, 55 + r() * 15);
        confetti += r() > 0.5
          ? `<rect x="${f(x)}" y="${f(y)}" width="${f(4 + r() * 5)}" height="${f(2 + r() * 3)}" fill="${c}" transform="rotate(${f(r() * 180)} ${f(x)} ${f(y)})"/>`
          : `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.5 + r() * 3)}" fill="${c}"/>`;
      }
      return {
        defs: g.defs,
        body: g.body + rays + confetti + `<circle cx="${cx}" cy="${cy}" r="${f(26 + r() * 10)}" fill="#f6eedd" opacity=".85"/>`
          + hills(r, 262, 16, hsl(h + 40, 30, 12)),
      };
    },

    Animation(r, h, id) {
      const pick = r();
      if (pick < 0.34) return scenes.Underwater(r, h, id);
      if (pick < 0.67) return scenes.Balloon(r, h, id);
      return scenes.SunnyHills(r, h, id);
    },

    Underwater(r, h, id) {
      const g = sky(id, hsl(h + 170, 70, 52), hsl(h + 210, 75, 18));
      let rays = '';
      for (let i = 0; i < 5; i += 1) {
        const x = r() * W;
        rays += `<path d="M${f(x)} 0 L${f(x + 18)} 0 L${f(x + 60)} ${H} L${f(x + 20)} ${H} Z" fill="#fff" opacity=".06"/>`;
      }
      let bubbles = '';
      for (let i = 0; i < 18; i += 1) {
        bubbles += `<circle cx="${f(r() * W)}" cy="${f(r() * 230)}" r="${f(1.5 + r() * 4)}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1"/>`;
      }
      let fish = '';
      for (let i = 0; i < 4; i += 1) {
        const x = 30 + r() * 140;
        const y = 70 + r() * 130;
        const s = 0.7 + r() * 0.8;
        const dir = r() > 0.5 ? 1 : -1;
        const c = hsl(h + 20 + r() * 60, 90, 62);
        fish += `<g transform="translate(${f(x)} ${f(y)}) scale(${f(dir * s)} ${f(s)})"><ellipse rx="12" ry="7" fill="${c}"/><path d="M-10 0 L-20 -7 L-20 7 Z" fill="${c}"/><circle cx="6" cy="-2" r="1.6" fill="#10202a"/></g>`;
      }
      let weeds = '';
      for (let x = 6; x < W; x += 16 + r() * 18) {
        const top = 200 + r() * 50;
        weeds += `<path d="M${f(x)} ${H} Q${f(x - 10)} ${f((top + H) / 2)} ${f(x + 4)} ${f(top)}" stroke="${hsl(h + 120, 55, 35)}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
      }
      return {
        defs: g.defs,
        body: g.body + rays + bubbles + fish + weeds
          + `<path d="M0 ${H} L0 280 Q${W / 2} 262 ${W} 282 L${W} ${H} Z" fill="${hsl(40, 45, 62)}"/>`,
      };
    },

    Balloon(r, h, id) {
      const g = sky(id, hsl(h + 240, 55, 18), hsl(h + 280, 60, 52));
      const bx = 55 + r() * 90;
      const by = 85 + r() * 50;
      const c1 = hsl(h + 10, 90, 60);
      const c2 = hsl(h + 50, 95, 70);
      return {
        defs: g.defs,
        body: g.body + stars(r, 35, 170)
          + `<path d="M${f(W - 40)} 40 a16 16 0 1 0 12 26 a12 12 0 1 1 -12 -26 Z" fill="#fff4cf"/>`
          + `<g transform="translate(${f(bx)} ${f(by)})">`
          + `<ellipse rx="30" ry="36" fill="${c1}"/>`
          + `<path d="M-10 -35 Q-18 0 -8 30 L8 30 Q18 0 10 -35 Z" fill="${c2}"/>`
          + `<path d="M-14 31 L-6 48 M14 31 L6 48" stroke="#3a2a1a" stroke-width="1.2"/>`
          + `<rect x="-7" y="47" width="14" height="10" rx="2" fill="#7a4a24"/></g>`
          + hills(r, 230, 22, hsl(h + 250, 40, 22))
          + hills(r, 262, 18, hsl(h + 250, 45, 12)),
      };
    },

    SunnyHills(r, h, id) {
      const g = sky(id, hsl(h + 190, 55, 50), hsl(h + 210, 60, 70));
      const sx = r() > 0.5 ? 150 : 50;
      let rays = '';
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2;
        rays += `<line x1="${f(sx + Math.cos(a) * 26)}" y1="${f(60 + Math.sin(a) * 26)}" x2="${f(sx + Math.cos(a) * 36)}" y2="${f(60 + Math.sin(a) * 36)}" stroke="#e6c26a" stroke-width="4" stroke-linecap="round"/>`;
      }
      let clouds = '';
      for (let i = 0; i < 3; i += 1) {
        const x = r() * W;
        const y = 90 + r() * 60;
        clouds += `<g fill="#fff" opacity=".95"><circle cx="${f(x)}" cy="${f(y)}" r="12"/><circle cx="${f(x + 13)}" cy="${f(y - 6)}" r="15"/><circle cx="${f(x + 28)}" cy="${f(y)}" r="11"/><rect x="${f(x)}" y="${f(y)}" width="28" height="11" rx="5"/></g>`;
      }
      return {
        defs: g.defs,
        body: g.body + rays + `<circle cx="${sx}" cy="60" r="20" fill="#e6c26a"/>` + clouds
          + hills(r, 215, 30, hsl(h + 100, 55, 52))
          + hills(r, 250, 25, hsl(h + 120, 50, 38)),
      };
    },

    Documentary(r, h, id, opts = {}) {
      const g = sky(id, hsl(h + 20, 55, 38), hsl(h + 50, 75, 74));
      let body = g.body + `<circle cx="${f(40 + r() * 120)}" cy="${f(110 + r() * 40)}" r="${f(18 + r() * 12)}" fill="${hsl(h + 50, 90, 90)}" opacity=".9"/>`;
      body += ridge(r, 175, 60, 28, hsl(h + 220, 25, 45));
      body += ridge(r, 215, 50, 22, hsl(h + 220, 30, 28));
      body += ridge(r, 255, 35, 16, hsl(h + 220, 35, 12));
      if (opts.birds) {
        for (let i = 0; i < 5; i += 1) {
          const bx = 30 + r() * 140;
          const by = 40 + r() * 70;
          body += `<path d="M${f(bx - 6)} ${f(by)} Q${f(bx - 3)} ${f(by - 4)} ${f(bx)} ${f(by)} Q${f(bx + 3)} ${f(by - 4)} ${f(bx + 6)} ${f(by)}" fill="none" stroke="#1a1a1a" stroke-width="1.4"/>`;
        }
      }
      return { defs: g.defs, body };
    },

    Adventure(r, h, id) {
      return scenes.Documentary(r, h + 160, id, { birds: true });
    },

    Action(r, h, id) {
      const g = sky(id, hsl(h + 10, 70, 22), hsl(h + 350, 80, 8));
      const bx = 60 + r() * 80;
      const by = 110 + r() * 60;
      let streaks = '';
      for (let i = 0; i < 16; i += 1) {
        const x = r() * W * 1.4 - 40;
        const y = r() * H;
        const len = 40 + r() * 90;
        streaks += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x + len)}" y2="${f(y - len * 0.6)}" stroke="#fff" stroke-opacity="${f(0.1 + r() * 0.35)}" stroke-width="${f(1 + r() * 3)}" stroke-linecap="round"/>`;
      }
      let shards = '';
      for (let i = 0; i < 12; i += 1) {
        const a = r() * Math.PI * 2;
        const d = 30 + r() * 70;
        const x = bx + Math.cos(a) * d;
        const y = by + Math.sin(a) * d;
        shards += `<path d="M${f(x)} ${f(y)} l${f(4 + r() * 5)} ${f(-2 - r() * 4)} l${f(-2)} ${f(6 + r() * 4)} Z" fill="${hsl(30, 95, 60)}" opacity=".85"/>`;
      }
      return {
        defs: g.defs + `<radialGradient id="${id}-boom"><stop offset="0" stop-color="#fff3c4"/><stop offset=".35" stop-color="${hsl(30, 95, 55)}"/><stop offset="1" stop-color="${hsl(10, 90, 40)}" stop-opacity="0"/></radialGradient>`,
        body: g.body + `<circle cx="${f(bx)}" cy="${f(by)}" r="${f(70 + r() * 30)}" fill="url(#${id}-boom)"/>` + streaks + shards
          + ridge(r, 270, 20, 12, '#07070a'),
      };
    },

    Drama(r, h, id) {
      const pick = r();
      if (pick < 0.33) return scenes.Road(r, h, id);
      if (pick < 0.66) return scenes.Window(r, h, id);
      return scenes.Horizon(r, h, id);
    },

    Horizon(r, h, id) {
      const g = sky(id, hsl(h + 210, 30, 30), hsl(h + 20, 50, 68));
      const horizon = 200 + r() * 20;
      const fx = 40 + r() * 120;
      return {
        defs: g.defs,
        body: g.body
          + `<circle cx="${f(W - fx)}" cy="${f(horizon - 6)}" r="${f(22 + r() * 10)}" fill="${hsl(h + 30, 80, 88)}" opacity=".85"/>`
          + `<rect y="${f(horizon)}" width="${W}" height="${f(H - horizon)}" fill="${hsl(h + 210, 30, 22)}"/>`
          + `<rect x="${f(fx - 30)}" y="${f(horizon + 26)}" width="60" height="5" fill="#0d0f14"/>`
          + figure(fx, horizon + 26, 1.3, '#0d0f14'),
      };
    },
  };
  scenes.Family = scenes.Animation;

  function svg(t, { wide = false } = {}) {
    const seed = seedFrom(`${t._id || ''}|${t.name || ''}`);
    const r = rng(seed);
    // Stored hue plus a per-title offset, so titles with similar stored hues
    // still diverge.
    const hue = (Number.isFinite(Number(t.posterHue)) ? Number(t.posterHue) : 0) + (seed % 90) - 45;
    // Pick the scene from any of the title's genres (stable per title) so
    // titles sharing a primary genre still look different.
    const genres = (Array.isArray(t.genres) ? t.genres : [t.genres]).filter((g) => scenes[g]);
    const genre = genres.length ? genres[seed % genres.length] : 'Drama';
    const id = `pa${(seq += 1)}`;
    W = wide ? 480 : 200;
    const scene = scenes[genre](r, hue, id);
    const out = `<svg class="art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">`
      + `<defs>${scene.defs}<radialGradient id="${id}-vig" cx="50%" cy="45%" r="75%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient></defs>`
      // Wide backdrops are mirrored so each scene's focal point sits on the
      // right, clear of the title text and poster on the left.
      + (wide ? `<g transform="translate(${W} 0) scale(-1 1)">${scene.body}</g>` : scene.body)
      + `<rect width="${W}" height="${H}" fill="url(#${id}-vig)"/></svg>`;
    W = 200;
    return out;
  }

  return { svg };
})();
