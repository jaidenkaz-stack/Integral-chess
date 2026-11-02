/* ============================================================
   Логика партии: доска, пешки, ходы, победа
   rank 0 = 1-я горизонталь (низ, белые), rank 7 = 8-я (верх, чёрные)
   ============================================================ */
(function (root) {
  'use strict';
  const C = root.CONFIG;
  const FILES = 'abcdefgh';
  const sq = (f, r) => FILES[f] + (r + 1);
  const other = (s) => (s === 'w' ? 'b' : 'w');
  const emptyStats = () => ({ correct: 0, wrong: 0, damage: 0, kills: 0, fastest: null, moves: 0, battles: 0, finished: 0 });

  class Game {
    constructor(data) {
      Object.assign(this, data);
    }

    static create({ names, settings }) {
      const g = new Game({
        version: 3,
        names: { w: names.w || 'Белые', b: names.b || 'Чёрные' },
        settings: { ...settings },
        pawns: {},
        grid: new Array(64).fill(null),
        turn: 'w',
        moveNo: 1,
        log: [],
        stats: { w: emptyStats(), b: emptyStats() },
        lastMove: null,
        winner: null,
        winReason: null,
        startedAt: Date.now()
      });
      let n = C.nameStart;
      const add = (side, row, rank) => {
        for (let f = 0; f < 8; f++) {
          const hp = row === 'front' ? C.frontHp : C.backHp;
          const id = side + (row === 'front' ? 'F' : 'B') + f;
          g.pawns[id] = { id, name: C.namePrefix + n++, side, row, hp, maxHp: hp, file: f, rank, moved: false, alive: true, kills: 0 };
          g.grid[rank * 8 + f] = id;
        }
      };
      add('w', 'front', 1);
      add('w', 'back', 0);
      add('b', 'front', 6);
      add('b', 'back', 7);
      g.addLog('info', null, 'log_start');
      return g;
    }

    static load(obj) { return new Game(obj); }
    serialize() { return JSON.parse(JSON.stringify(this)); }

    at(f, r) {
      if (f < 0 || f > 7 || r < 0 || r > 7) return null;
      const id = this.grid[r * 8 + f];
      return id ? this.pawns[id] : null;
    }

    dir(side) { return side === 'w' ? 1 : -1; }
    goalRank(side) { return side === 'w' ? 7 : 0; }

    legalMoves(id) {
      const p = this.pawns[id];
      if (!p || !p.alive) return [];
      const d = this.dir(p.side);
      const r1 = p.rank + d;
      const res = [];
      if (r1 < 0 || r1 > 7) return res;
      const ahead = this.at(p.file, r1);
      if (!ahead) {
        res.push({ type: 'move', file: p.file, rank: r1 });
        const r2 = p.rank + 2 * d;
        if (!p.moved && r2 >= 0 && r2 <= 7 && !this.at(p.file, r2)) res.push({ type: 'move', file: p.file, rank: r2 });
      } else if (ahead.side !== p.side) {
        res.push({ type: 'attack', file: p.file, rank: r1, target: ahead.id, head: true });
      }
      if (this.settings.diagonal) {
        for (const df of [-1, 1]) {
          const t = this.at(p.file + df, r1);
          if (t && t.side !== p.side) res.push({ type: 'attack', file: p.file + df, rank: r1, target: t.id, head: false });
        }
      }
      return res;
    }

    sideHasMoves(side) {
      return this.alivePawns(side).some((p) => this.legalMoves(p.id).length > 0);
    }

    alivePawns(side) { return Object.values(this.pawns).filter((p) => p.alive && p.side === side); }
    totalHp(side) { return this.alivePawns(side).reduce((s, p) => s + p.hp, 0); }
    maxTotalHp() { return 8 * C.frontHp + 8 * C.backHp; }

    relocate(p, f, r) {
      this.grid[p.rank * 8 + p.file] = null;
      p.file = f; p.rank = r; p.moved = true;
      this.grid[r * 8 + f] = p.id;
    }

    kill(p) {
      p.alive = false;
      p.hp = 0;
      if (this.grid[p.rank * 8 + p.file] === p.id) this.grid[p.rank * 8 + p.file] = null;
    }

    /** Обычный ход */
    move(id, f, r) {
      const p = this.pawns[id];
      const from = sq(p.file, p.rank);
      this.relocate(p, f, r);
      this.stats[p.side].moves++;
      this.lastMove = { from, to: sq(f, r), toFR: [f, r] };
      this.addLog('move', p.side, 'log_move', { p: p.name, from, to: sq(f, r) });
      if (r === this.goalRank(p.side)) { this.finishPawn(p); return { finished: true }; }
      return { finished: false };
    }

    /** Пешка дошла до последнего ряда соперника: +1 очко, уходит с доски */
    finishPawn(p) {
      if (this.grid[p.rank * 8 + p.file] === p.id) this.grid[p.rank * 8 + p.file] = null;
      p.alive = false;
      p.finished = true;
      this.stats[p.side].finished++;
      this.addLog('finish', p.side, 'log_finish', { p: p.name, n: this.stats[p.side].finished });
    }

    score(side) { return this.stats[side].finished || 0; }

    /** Конец партии: побеждает тот, у кого больше пешек на финише */
    endByScore() {
      if (this.winner) return;
      const w = this.score('w'), b = this.score('b');
      if (w === b) {
        this.winner = 'draw';
        this.winReason = { key: 'r_draw', p: { w, b } };
        this.addLog('win', null, 'log_draw', { w, b });
      } else {
        this.setWinner(w > b ? 'w' : 'b', 'r_score', { w, b });
      }
    }

    /** Применить результат битвы */
    applyBattle(attId, defId, outcome) {
      const a = this.pawns[attId], d = this.pawns[defId];
      let finished = false;
      this.stats.w.battles++; this.stats.b.battles++;
      if (outcome === 'attacker') {
        const f = d.file, r = d.rank, from = sq(a.file, a.rank);
        this.kill(d);
        a.kills++;
        this.stats[a.side].kills++;
        this.relocate(a, f, r);
        this.stats[a.side].moves++;
        this.lastMove = { from, to: sq(f, r), toFR: [f, r] };
        this.addLog('kill', a.side, 'log_kill_att', { d: d.name, a: a.name, sq: sq(f, r) });
        if (r === this.goalRank(a.side)) { this.finishPawn(a); finished = true; }
      } else if (outcome === 'defender') {
        this.kill(a);
        d.kills++;
        this.stats[d.side].kills++;
        this.addLog('kill', d.side, 'log_kill_def', { a: a.name, d: d.name });
      } else {
        this.addLog('info', d.side, 'log_repelled', { d: d.name, a: a.name });
      }
      return { finished };
    }

    /** reasonKey — ключ перевода причины, p — параметры */
    setWinner(side, reasonKey, p) {
      if (this.winner) return;
      this.winner = side;
      this.winReason = { key: reasonKey, p: p || {} };
      this.addLog('win', side, 'log_win', { name: this.names[side] }, this.winReason);
    }

    /** Передать ход. Возвращает информацию о пропусках. */
    nextTurn() {
      if (this.winner) return { skipped: false };
      this.turn = other(this.turn);
      if (this.turn === 'w') this.moveNo++;
      if (!this.sideHasMoves(this.turn)) {
        const skippedSide = this.turn;
        this.turn = other(this.turn);
        if (this.turn === 'w') this.moveNo++;
        if (!this.sideHasMoves(this.turn)) {
          this.endByScore();
          return { skipped: true, deadlock: true };
        }
        // если пешек на доске не осталось — пропуск молча
        const quiet = this.alivePawns(skippedSide).length === 0;
        if (!quiet) this.addLog('info', skippedSide, 'no_moves_' + skippedSide);
        return { skipped: true, side: skippedSide, quiet };
      }
      return { skipped: false };
    }

    /** Запись журнала хранит ключ перевода — язык можно сменить в любой момент */
    addLog(kind, side, key, p, sub) {
      this.log.push({ n: this.moveNo, kind, side, key, p: p || null, sub: sub || null });
      if (this.log.length > 300) this.log.shift();
    }
  }

  Game.sq = sq;
  Game.other = other;
  root.Game = Game;
})(window);
