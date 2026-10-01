/*
 * Generative poster art. Each title gets an original illustrated scene chosen
 * by its primary genre; the layout, palette, and details are derived from a
 * seed built from the title's id and name, so every poster is unique and the
 * same title always renders the same artwork.
 */
const Posters = (() => {
  const W = 200;
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

  const hsl = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
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
      return scenes.Crime(r, h + 140, id, { rain: true });
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
      const warm = 330 + (h % 50);
      const g = sky(id, hsl(warm, 60, 62), hsl(warm + 45, 85, 72));
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
          + figure(sx - 9, horizon, 1.1, hsl(warm, 40, 15)) + figure(sx + 9, horizon, 1.2, hsl(warm, 40, 15)),
      };
    },

    Comedy(r, h, id) {
      const g = sky(id, hsl(h + 40, 90, 62), hsl(h + 80, 85, 52));
      const cx = W / 2;
      const cy = 120;
      let rays = '';
      for (let i = 0; i < 18; i += 2) {
        const a1 = (i / 18) * Math.PI * 2;
        const a2 = ((i + 1) / 18) * Math.PI * 2;
        rays += `<path d="M${cx} ${cy} L${f(cx + Math.cos(a1) * 260)} ${f(cy + Math.sin(a1) * 260)} L${f(cx + Math.cos(a2) * 260)} ${f(cy + Math.sin(a2) * 260)} Z" fill="#fff" opacity=".12"/>`;
      }
      let confetti = '';
      for (let i = 0; i < 45; i += 1) {
        const x = r() * W;
        const y = r() * H;
        const c = hsl(h + r() * 360, 90, 55 + r() * 15);
        confetti += r() > 0.5
          ? `<rect x="${f(x)}" y="${f(y)}" width="${f(4 + r() * 5)}" height="${f(2 + r() * 3)}" fill="${c}" transform="rotate(${f(r() * 180)} ${f(x)} ${f(y)})"/>`
          : `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.5 + r() * 3)}" fill="${c}"/>`;
      }
      return { defs: g.defs, body: g.body + rays + confetti + `<circle cx="${cx}" cy="${cy}" r="${f(26 + r() * 10)}" fill="#fff" opacity=".85"/>` };
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
      const g = sky(id, hsl(h + 180, 75, 70), hsl(h + 200, 80, 88));
      const sx = r() > 0.5 ? 150 : 50;
      let rays = '';
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2;
        rays += `<line x1="${f(sx + Math.cos(a) * 26)}" y1="${f(60 + Math.sin(a) * 26)}" x2="${f(sx + Math.cos(a) * 36)}" y2="${f(60 + Math.sin(a) * 36)}" stroke="#ffd34d" stroke-width="4" stroke-linecap="round"/>`;
      }
      let clouds = '';
      for (let i = 0; i < 3; i += 1) {
        const x = r() * W;
        const y = 90 + r() * 60;
        clouds += `<g fill="#fff" opacity=".95"><circle cx="${f(x)}" cy="${f(y)}" r="12"/><circle cx="${f(x + 13)}" cy="${f(y - 6)}" r="15"/><circle cx="${f(x + 28)}" cy="${f(y)}" r="11"/><rect x="${f(x)}" y="${f(y)}" width="28" height="11" rx="5"/></g>`;
      }
      return {
        defs: g.defs,
        body: g.body + rays + `<circle cx="${sx}" cy="60" r="20" fill="#ffd34d"/>` + clouds
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

  function svg(t) {
    const seed = seedFrom(`${t._id || ''}|${t.name || ''}`);
    const r = rng(seed);
    const hue = Number.isFinite(Number(t.posterHue)) ? Number(t.posterHue) : seed % 360;
    // Pick the scene from any of the title's genres (stable per title) so
    // titles sharing a primary genre still look different.
    const genres = (Array.isArray(t.genres) ? t.genres : [t.genres]).filter((g) => scenes[g]);
    const genre = genres.length ? genres[seed % genres.length] : 'Drama';
    const id = `pa${(seq += 1)}`;
    const scene = scenes[genre](r, hue, id);
    return `<svg class="poster-art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">`
      + `<defs>${scene.defs}<linearGradient id="${id}-shade" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".8"/></linearGradient></defs>`
      + scene.body
      + `<rect width="${W}" height="${H}" fill="url(#${id}-shade)"/></svg>`;
  }

  return { svg };
})();
