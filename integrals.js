/* ============================================================
   Генератор интегралов с целочисленным ответом
   Каждая задача: { tex, ans, tag, level, check }
   check — данные для численной проверки (используются в тестах)
   ============================================================ */
(function (root) {
  'use strict';

  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const PI = Math.PI;
  const DX = '\\,dx';
  const coef = (k) => (k === 1 ? '' : String(k));
  const inRange = (v, lo = 1, hi = 1000) => Number.isInteger(v) && v >= lo && v <= hi;

  /* ---------- многочлены ---------- */
  function polyTex(c) {
    let s = '';
    let first = true;
    for (let k = c.length - 1; k >= 0; k--) {
      const v = c[k];
      if (!v) continue;
      const abs = Math.abs(v);
      const xs = k === 0 ? '' : k === 1 ? 'x' : `x^{${k}}`;
      const term = k === 0 ? String(abs) : (abs === 1 ? '' : abs) + xs;
      if (first) { s += (v < 0 ? '-' : '') + term; first = false; }
      else s += (v < 0 ? ' - ' : ' + ') + term;
    }
    return s || '0';
  }
  const polyVal = (c, x) => c.reduce((s, v, k) => s + v * Math.pow(x, k), 0);
  // точный интеграл ×12 (степени ≤ 3, 12 делится на 1..4)
  function polyInt12(c, a, b) {
    let s = 0;
    for (let k = 0; k < c.length; k++) {
      if (!c[k]) continue;
      s += c[k] * (Math.pow(b, k + 1) - Math.pow(a, k + 1)) * (12 / (k + 1));
    }
    return s;
  }
  const nonZeroTerms = (c) => c.filter(Boolean).length;
  function polyTask(c, a, b, lo, hi) {
    const s12 = polyInt12(c, a, b);
    if (s12 % 12 !== 0) return null;
    const ans = s12 / 12;
    if (!inRange(ans, lo, hi)) return null;
    const body = nonZeroTerms(c) > 1 ? `\\left(${polyTex(c)}\\right)` : polyTex(c);
    return {
      tex: `\\int_{${a}}^{${b}} ${body}${DX}`,
      ans,
      check: { f: (x) => polyVal(c, x), a, b }
    };
  }

  /* ---------- генераторы ---------- */
  const GENS = [
    /* ===== ЛЁГКИЕ ===== */
    {
      id: 'const', level: 'easy', tag: 'tag_definite',
      make() {
        const k = rnd(2, 12), a = rnd(0, 4), b = a + rnd(1, 6);
        return { tex: `\\int_{${a}}^{${b}} ${k}${DX}`, ans: k * (b - a), check: { f: () => k, a, b } };
      }
    },
    {
      id: 'mono', level: 'easy', tag: 'tag_power',
      make() {
        const n = pick([1, 1, 2, 2, 3]), b = rnd(1, 5), k = rnd(1, 9);
        const c = [0, 0, 0, 0]; c[n] = k;
        return polyTask(c.slice(0, n + 1), 0, b, 1, 400);
      }
    },
    {
      id: 'linear', level: 'easy', tag: 'tag_definite',
      make() {
        const c = [rnd(1, 6), rnd(1, 6)], a = rnd(0, 2), b = a + rnd(1, 4);
        return polyTask(c, a, b, 1, 200);
      }
    },
    {
      id: 'cos', level: 'easy', tag: 'tag_trig',
      make() {
        const k = rnd(2, 20);
        return { tex: `\\int_{0}^{\\frac{\\pi}{2}} ${k}\\cos x${DX}`, ans: k, check: { f: (x) => k * Math.cos(x), a: 0, b: PI / 2 } };
      }
    },
    {
      id: 'sin', level: 'easy', tag: 'tag_trig',
      make() {
        const k = rnd(1, 15);
        return { tex: `\\int_{0}^{\\pi} ${coef(k)}\\sin x${DX}`, ans: 2 * k, check: { f: (x) => k * Math.sin(x), a: 0, b: PI } };
      }
    },
    {
      id: 'inv', level: 'easy', tag: 'tag_log',
      make() {
        const k = rnd(2, 25);
        return { tex: `\\int_{1}^{e} \\frac{${k}}{x}${DX}`, ans: k, check: { f: (x) => k / x, a: 1, b: Math.E } };
      }
    },

    /* ===== СРЕДНИЕ ===== */
    {
      id: 'poly2', level: 'medium', tag: 'tag_poly',
      make() {
        const deg = pick([2, 2, 3]);
        const c = [];
        for (let k = 0; k < deg; k++) c.push(Math.random() < 0.65 ? rnd(-5, 8) : 0);
        c.push(rnd(1, 6));
        if (nonZeroTerms(c) < 2) return null;
        const a = pick([0, 0, 0, 1, -1]), b = a + rnd(1, 3);
        return polyTask(c, a, b, 1, 600);
      }
    },
    {
      id: 'exp', level: 'medium', tag: 'tag_exp',
      make() {
        const a = rnd(2, 7), k = rnd(1, 15);
        return { tex: `\\int_{0}^{\\ln ${a}} ${coef(k)}e^{x}${DX}`, ans: k * (a - 1), check: { f: (x) => k * Math.exp(x), a: 0, b: Math.log(a) } };
      }
    },
    {
      id: 'logN', level: 'medium', tag: 'tag_log',
      make() {
        const n = rnd(2, 6), k = rnd(2, 15);
        return { tex: `\\int_{1}^{e^{${n}}} \\frac{${k}}{x}${DX}`, ans: k * n, check: { f: (x) => k / x, a: 1, b: Math.exp(n) } };
      }
    },
    {
      id: 'sqrt', level: 'medium', tag: 'tag_root',
      make() {
        const a = rnd(1, 5), c = rnd(1, 9);
        const v = 2 * c * a * a * a;
        if (v % 3) return null;
        return { tex: `\\int_{0}^{${a * a}} ${coef(c)}\\sqrt{x}${DX}`, ans: v / 3, check: { f: (x) => c * Math.sqrt(x), a: 0, b: a * a } };
      }
    },
    {
      id: 'abs', level: 'medium', tag: 'tag_abs',
      make() {
        const a = rnd(1, 6), b = rnd(1, 6), k = rnd(1, 8);
        const v = k * (a * a + b * b);
        if (v % 2) return null;
        return { tex: `\\int_{-${a}}^{${b}} ${coef(k)}\\left|x\\right|${DX}`, ans: v / 2, check: { f: (x) => k * Math.abs(x), a: -a, b } };
      }
    },
    {
      id: 'sec2', level: 'medium', tag: 'tag_trig',
      make() {
        const k = rnd(2, 25);
        return { tex: `\\int_{0}^{\\frac{\\pi}{4}} \\frac{${k}}{\\cos^{2} x}${DX}`, ans: k, check: { f: (x) => k / (Math.cos(x) ** 2), a: 0, b: PI / 4 } };
      }
    },
    {
      id: 'ln', level: 'medium', tag: 'tag_log',
      make() {
        const k = rnd(2, 25);
        return { tex: `\\int_{1}^{e} ${k}\\ln x${DX}`, ans: k, check: { f: (x) => k * Math.log(x), a: 1, b: Math.E } };
      }
    },
    {
      id: 'lnOverX', level: 'medium', tag: 'tag_subst',
      make() {
        const k = 2 * rnd(1, 15);
        return { tex: `\\int_{1}^{e} \\frac{${k}\\ln x}{x}${DX}`, ans: k / 2, check: { f: (x) => k * Math.log(x) / x, a: 1, b: Math.E } };
      }
    },
    {
      id: 'sincos', level: 'medium', tag: 'tag_trig',
      make() {
        const k = 2 * rnd(1, 15);
        return { tex: `\\int_{0}^{\\frac{\\pi}{2}} ${k}\\sin x\\cos x${DX}`, ans: k / 2, check: { f: (x) => k * Math.sin(x) * Math.cos(x), a: 0, b: PI / 2 } };
      }
    },

    /* ===== СЛОЖНЫЕ ===== */
    {
      id: 'poly3', level: 'hard', tag: 'tag_poly',
      make() {
        const c = [rnd(-6, 9), rnd(-6, 9), rnd(-4, 6), rnd(1, 4)];
        if (nonZeroTerms(c) < 3) return null;
        const a = rnd(-2, 1), b = a + rnd(2, 4);
        return polyTask(c, a, b, 1, 1000);
      }
    },
    {
      id: 'xex', level: 'hard', tag: 'tag_parts',
      make() {
        const k = rnd(2, 30);
        return { tex: `\\int_{0}^{1} ${k}x\\,e^{x}${DX}`, ans: k, check: { f: (x) => k * x * Math.exp(x), a: 0, b: 1 } };
      }
    },
    {
      id: 'radical', level: 'hard', tag: 'tag_subst',
      make() {
        // √(a²+c) и √c — целые
        const [a, c, d] = pick([[4, 9, 2], [3, 16, 1], [12, 25, 8], [8, 36, 4], [6, 64, 2], [15, 64, 9], [24, 49, 18], [8, 225, 2], [5, 144, 1], [12, 81, 6]]);
        const k = rnd(1, 9);
        return {
          tex: `\\int_{0}^{${a}} \\frac{${coef(k)}x}{\\sqrt{x^{2}+${c}}}${DX}`,
          ans: k * d,
          check: { f: (x) => k * x / Math.sqrt(x * x + c), a: 0, b: a }
        };
      }
    },
    {
      id: 'rootShift', level: 'hard', tag: 'tag_subst',
      make() {
        const p = rnd(1, 4), q = p + rnd(1, 4), m = rnd(1, 9);
        const c = p * p, b = q * q - p * p;
        return {
          tex: `\\int_{0}^{${b}} \\frac{${m}}{\\sqrt{x+${c}}}${DX}`,
          ans: 2 * m * (q - p),
          check: { f: (x) => m / Math.sqrt(x + c), a: 0, b }
        };
      }
    },
    {
      id: 'arctan', level: 'hard', tag: 'tag_atan',
      make() {
        const k = rnd(1, 25);
        return { tex: `\\int_{0}^{1} \\frac{${4 * k}}{\\pi\\left(1+x^{2}\\right)}${DX}`, ans: k, check: { f: (x) => 4 * k / (PI * (1 + x * x)), a: 0, b: 1 } };
      }
    },
    {
      id: 'arcsin', level: 'hard', tag: 'tag_asin',
      make() {
        const k = rnd(1, 20);
        return { tex: `\\int_{0}^{\\frac{1}{2}} \\frac{${6 * k}}{\\pi\\sqrt{1-x^{2}}}${DX}`, ans: k, check: { f: (x) => 6 * k / (PI * Math.sqrt(1 - x * x)), a: 0, b: 0.5 } };
      }
    },
    {
      id: 'double', level: 'hard', tag: 'tag_double',
      make() {
        const a = rnd(1, 4), b = rnd(1, 4), k = rnd(1, 6);
        const v = k * a * a * b * b;
        if (v % 4) return null;
        return {
          tex: `\\int_{0}^{${a}}\\!\\!\\int_{0}^{${b}} ${coef(k)}xy\\,dy\\,dx`,
          ans: v / 4,
          check: { f2: (x, y) => k * x * y, ax: 0, bx: a, ay: 0, by: b }
        };
      }
    },
    {
      id: 'doubleSum', level: 'hard', tag: 'tag_double',
      make() {
        const a = rnd(1, 4), b = rnd(1, 4), k = rnd(1, 6);
        const v = k * a * b * (a + b);
        if (v % 2) return null;
        return {
          tex: `\\int_{0}^{${a}}\\!\\!\\int_{0}^{${b}} ${k === 1 ? '' : k}\\left(x+y\\right)dy\\,dx`,
          ans: v / 2,
          check: { f2: (x, y) => k * (x + y), ax: 0, bx: a, ay: 0, by: b }
        };
      }
    },
    {
      id: 'exp2', level: 'hard', tag: 'tag_exp',
      make() {
        const a = rnd(2, 6), k = rnd(1, 10);
        const v = k * (a * a - 1);
        if (v % 2) return null;
        return { tex: `\\int_{0}^{\\ln ${a}} ${coef(k)}e^{2x}${DX}`, ans: v / 2, check: { f: (x) => k * Math.exp(2 * x), a: 0, b: Math.log(a) } };
      }
    },
    {
      id: 'sin3', level: 'hard', tag: 'tag_trig',
      make() {
        const k = 3 * rnd(1, 12);
        return { tex: `\\int_{0}^{\\frac{\\pi}{2}} ${k}\\sin^{3} x${DX}`, ans: 2 * k / 3, check: { f: (x) => k * Math.sin(x) ** 3, a: 0, b: PI / 2 } };
      }
    },
    {
      id: 'improperExp', level: 'hard', tag: 'tag_improper',
      make() {
        const k = rnd(2, 30);
        return { tex: `\\int_{0}^{+\\infty} ${k}e^{-x}${DX}`, ans: k, check: { f: (x) => k * Math.exp(-x), a: 0, b: 60 } };
      }
    },
    {
      id: 'improperInv2', level: 'hard', tag: 'tag_improper',
      make() {
        const k = rnd(2, 30);
        // проверка через замену t = 1/x:  ∫₁^∞ k/x² dx = ∫₀¹ k dt
        return { tex: `\\int_{1}^{+\\infty} \\frac{${k}}{x^{2}}${DX}`, ans: k, check: { f: () => k, a: 0, b: 1 } };
      }
    }
  ];

  const LEVELS = ['easy', 'medium', 'hard'];
  

  function pickLevel(mode, weights) {
    if (LEVELS.includes(mode)) return mode;
    const w = weights || { easy: 0.4, medium: 0.4, hard: 0.2 };
    let r = Math.random() * (w.easy + w.medium + w.hard);
    for (const l of LEVELS) { r -= w[l]; if (r < 0) return l; }
    return 'medium';
  }

  /**
   * Сгенерировать задачу.
   * @param {string} level easy|medium|hard
   * @param {Set<string>} avoid  — tex, которые нельзя повторять
   * @param {string} [avoidGen] — id генератора, который лучше не брать
   */
  function generate(level, avoid, avoidGen) {
    const pool = GENS.filter((g) => g.level === level);
    for (let attempt = 0; attempt < 400; attempt++) {
      let pool2 = pool;
      if (avoidGen && attempt < 60) pool2 = pool.filter((g) => g.id !== avoidGen) || pool;
      if (!pool2.length) pool2 = pool;
      const g = pick(pool2);
      const t = g.make();
      if (!t || !inRange(t.ans)) continue;
      if (avoid && avoid.has(t.tex) && attempt < 300) continue;
      return { ...t, gen: g.id, tag: g.tag, level };
    }
    // запасной вариант — гарантированно валидный
    const k = rnd(2, 20);
    return { tex: `\\int_{1}^{e} \\frac{${k}}{x}${DX}`, ans: k, gen: 'inv', tag: 'tag_log', level, check: { f: (x) => k / x, a: 1, b: Math.E } };
  }

  /** Пара РАЗНЫХ задач одного уровня для двух игроков */
  function generatePair(mode, avoid, weights) {
    const level = pickLevel(mode, weights);
    const w = generate(level, avoid);
    const avoid2 = new Set(avoid || []);
    avoid2.add(w.tex);
    const b = generate(level, avoid2, w.gen);
    return { level, w, b };
  }

  /* ---------- численная проверка (для тестов) ---------- */
  function simpson(f, a, b, n = 4000) {
    if (n % 2) n++;
    const h = (b - a) / n;
    let s = f(a) + f(b);
    for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
    return (s * h) / 3;
  }
  function numeric(task) {
    const c = task.check;
    if (!c) return NaN;
    if (c.f) return simpson(c.f, c.a, c.b);
    if (c.f2) return simpson((x) => simpson((y) => c.f2(x, y), c.ay, c.by, 200), c.ax, c.bx, 200);
    return NaN;
  }

  const api = { generate, generatePair, pickLevel, numeric, GENS, LEVELS };
  root.Integrals = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
