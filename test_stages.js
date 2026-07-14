// Test: verify all stages can be solved with their solution rotations

const OPPOSITE = [2, 3, 0, 1];
const DIR_DELTA = [[-1,0],[0,1],[1,0],[0,-1]];

function getConnections(type, rot) {
  const r = ((rot % 4) + 4) % 4;
  switch (type) {
    case 'straight': return r % 2 === 0 ? [0,2] : [1,3];
    case 'l':        return [[0,1],[1,2],[2,3],[3,0]][r];
    case 't':        return [[1,2,3],[0,2,3],[0,1,3],[0,1,2]][r];
    case 'cross':    return [0,1,2,3];
    case 'bridge':   return [0,1,2,3];
    case 'oneway':   return [OPPOSITE[r], r];
    case 'mirror':   return [0,1,2,3];
    case 'router': { const aCW=[1,2,3,0][r], aCCW=[3,0,1,2][r]; return [[2,3,0,1][r], aCW, aCCW]; }
    case 'resistor': return r % 2 === 0 ? [0,2] : [1,3];
    case 'amp':      return r % 2 === 0 ? [0,2] : [1,3];
    case 'resistorL':return [[0,1],[1,2],[2,3],[3,0]][r];
    case 'ampL':     return [[0,1],[1,2],[2,3],[3,0]][r];
    case 'gear':     return [[0,1],[1,2],[2,3],[3,0]][r];
    case 'fuse':     return r % 2 === 0 ? [0,2] : [1,3];
    case 'igate':    return r % 2 === 0 ? [0,2] : [1,3];
    case 'gate':     return r % 2 === 0 ? [0,2] : [1,3];
    case 'switch':   return [0,1,2,3];
    case 'portal':   return [[2],[3],[0],[1]][r];
    case 'splitter': return [r, (r+1)%4, (r+3)%4];
    case 'andgate':  return r % 2 === 0 ? [0,2] : [1,3];
    case 'trap':     return [0,1,2,3];
    case 'source':
    case 'bulb':     return [[2],[3],[0],[1]][r];
    default:         return [];
  }
}

function powerDelta(type) {
  if (type === 'resistor' || type === 'resistorL') return -1;
  if (type === 'amp' || type === 'ampL') return +1;
  return 0;
}

function computePowered(grid) {
  const rows = grid.length, cols = grid[0].length;
  const MAX_POWER = 9;
  const switchLit = {};
  const byColor = {};
  const portals = {};
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (grid[r][c].type === 'portal') {
        const id = grid[r][c].linkId;
        (portals[id] = portals[id] || []).push({ r, c });
      }
  const emptyMask = () => Array.from({length: rows}, () => new Array(cols).fill(0));
  function connsOf(cell) {
    if (cell.type === 'gate' && !switchLit[cell.linkId]) return [];
    if (cell.type === 'igate' && switchLit[cell.linkId]) return [];
    if (cell.type === 'andgate') {
      const ids = [cell.linkId, cell.linkId2].filter(Boolean);
      if (ids.length === 0 || !ids.every(id => switchLit[id])) return [];
    }
    return getConnections(cell.type, cell.rotation);
  }
  function bfsFrom(src, levelMask) {
    if (src.initialPower < 1) return;
    if (src.initialPower > levelMask[src.r][src.c]) levelMask[src.r][src.c] = src.initialPower;
    const stateMax = new Map();
    stateMax.set(`${src.r},${src.c},-1`, src.initialPower);
    const pq = [[src.initialPower, src.r, src.c, -1]];
    while (pq.length) {
      let mi = 0;
      for (let i = 1; i < pq.length; i++) if (pq[i][0] > pq[mi][0]) mi = i;
      const [power, r, c, entryDir] = pq.splice(mi, 1)[0];
      if ((stateMax.get(`${r},${c},${entryDir}`) || 0) > power) continue;
      const cell = grid[r][c];
      let outPower = power + powerDelta(cell.type);
      if (outPower > MAX_POWER) outPower = MAX_POWER;
      if (outPower < 1) continue;
      if (cell.type === 'portal' && entryDir !== -1) {
        const pairList = portals[cell.linkId] || [];
        const pair = pairList.find(p => p.r !== r || p.c !== c);
        if (pair) {
          const outDir = getConnections('portal', grid[pair.r][pair.c].rotation)[0];
          const nr = pair.r + DIR_DELTA[outDir][0];
          const nc = pair.c + DIR_DELTA[outDir][1];
          if (outPower > levelMask[pair.r][pair.c]) levelMask[pair.r][pair.c] = outPower;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            const ncell = grid[nr][nc];
            const nconns = connsOf(ncell);
            if (nconns.includes(OPPOSITE[outDir]) &&
                !(ncell.type === 'oneway' && OPPOSITE[outDir] !== OPPOSITE[ncell.rotation]) &&
                ncell.type !== 'source' &&
                !(ncell.type === 'fuse' && outPower > (ncell.limit || 2))) {
              const nKey = `${nr},${nc},${OPPOSITE[outDir]}`;
              if (outPower > (stateMax.get(nKey) || 0)) {
                stateMax.set(nKey, outPower);
                if (outPower > levelMask[nr][nc]) levelMask[nr][nc] = outPower;
                pq.push([outPower, nr, nc, OPPOSITE[outDir]]);
              }
            }
          }
        }
        continue;
      }
      let exitConns;
      if (cell.type === 'oneway') {
        exitConns = (entryDir === OPPOSITE[cell.rotation] || entryDir === -1) ? [cell.rotation] : [];
      } else if (cell.type === 'bridge' && entryDir !== -1) {
        exitConns = [OPPOSITE[entryDir]];
      } else if (cell.type === 'mirror') {
        if (entryDir === -1) exitConns = [];
        else exitConns = [cell.rotation % 2 === 0 ? (entryDir ^ 3) : (entryDir ^ 1)];
      } else if (cell.type === 'router') {
        const r4 = ((cell.rotation % 4) + 4) % 4;
        const inputDir = [2,3,0,1][r4];
        if (entryDir === inputDir || entryDir === -1) {
          exitConns = [(cell.state || 0) === 0 ? [1,2,3,0][r4] : [3,0,1,2][r4]];
        } else exitConns = [];
      } else if (cell.type === 'splitter') {
        const r4 = ((cell.rotation % 4) + 4) % 4;
        if (entryDir === r4 || entryDir === -1) {
          exitConns = [(r4+1)%4, (r4+3)%4];
          outPower = Math.floor(outPower / 2);
          if (outPower < 1) continue;
        } else exitConns = [];
      } else {
        exitConns = connsOf(cell);
      }
      for (const dir of exitConns) {
        const nr = r + DIR_DELTA[dir][0];
        const nc = c + DIR_DELTA[dir][1];
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const ncell = grid[nr][nc];
        const nconns = connsOf(ncell);
        if (!nconns.includes(OPPOSITE[dir])) continue;
        if (ncell.type === 'oneway' && OPPOSITE[dir] !== OPPOSITE[ncell.rotation]) continue;
        if (ncell.type === 'router' && OPPOSITE[dir] !== [2,3,0,1][((ncell.rotation%4)+4)%4]) continue;
        if (ncell.type === 'splitter' && OPPOSITE[dir] !== ((ncell.rotation%4)+4)%4) continue;
        if (ncell.type === 'source') continue;
        if (ncell.type === 'fuse' && outPower > (ncell.limit || 2)) continue;
        const nKey = `${nr},${nc},${OPPOSITE[dir]}`;
        const prev = stateMax.get(nKey) || 0;
        if (outPower > prev) {
          stateMax.set(nKey, outPower);
          if (outPower > levelMask[nr][nc]) levelMask[nr][nc] = outPower;
          pq.push([outPower, nr, nc, OPPOSITE[dir]]);
        }
      }
    }
  }
  const sources = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (grid[r][c].type === 'source')
        sources.push({ r, c, color: grid[r][c].color || 'cyan', initialPower: grid[r][c].initialPower || 9 });
  for (let iter = 0; iter < 20; iter++) {
    for (const k in byColor) delete byColor[k];
    for (const src of sources) {
      if (!byColor[src.color]) byColor[src.color] = emptyMask();
      bfsFrom(src, byColor[src.color]);
    }
    let changed = false;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c].type === 'switch') {
          const id = grid[r][c].linkId;
          const lit = Object.values(byColor).some(m => m[r][c]);
          if (!!switchLit[id] !== !!lit) { switchLit[id] = lit; changed = true; }
        }
      }
    }
    if (!changed) break;
  }
  const powered = emptyMask();
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      for (const color in byColor)
        if (byColor[color][r][c]) powered[r][c] = Math.max(powered[r][c], byColor[color][r][c]);
  return { powered, byColor };
}

function isSolved(grid, result) {
  const byColor = result.byColor || {};
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      const cell = grid[r][c];
      if (cell.type === 'bulb') {
        const want = cell.color || 'cyan';
        if (!byColor[want] || !byColor[want][r][c]) return false;
      } else if (cell.type === 'trap') {
        for (const col in byColor) if (byColor[col][r][c]) return false;
      }
    }
  }
  return true;
}

function makeCell(type, rotation, locked = false, opts) { return Object.assign({ type, rotation, locked }, opts || {}); }
const E = () => makeCell('empty', 0);
const ow = (rot) => makeCell('oneway', rot);
const srcP = (rot, power) => makeCell('source', rot, false, { initialPower: power });
const mir = (rot) => makeCell('mirror', rot);
const router = (rot, state=0) => makeCell('router', rot, false, { state });
const fuse = (rot, limit) => makeCell('fuse', rot, false, { limit });
const portal = (rot, id) => makeCell('portal', rot, false, { linkId: id });
const sw   = (id)  => makeCell('switch', 0, false, { linkId: id });
const gt   = (id, rot=0) => makeCell('gate', rot, false, { linkId: id });
const igt  = (id, rot=0) => makeCell('igate', rot, false, { linkId: id });
const srcC = (rot, color) => makeCell('source', rot, false, { color });
const bulbC= (rot, color) => makeCell('bulb', rot, false, { color });
const split = (rot) => makeCell('splitter', rot);
const andgt = (id1, id2, rot=0) => makeCell('andgate', rot, false, { linkId: id1, linkId2: id2 });
const trap  = () => makeCell('trap', 0);

const STAGES = [
  {
    name: 'チュートリアル 1',
    grid: [
      [makeCell('source',2), makeCell('straight',0), makeCell('l',0)],
      [E(),                  E(),                    makeCell('straight',1)],
      [makeCell('bulb',0),   makeCell('straight',0), makeCell('l',1)],
    ],
    solution: [[3,1,2],[0,0,0],[3,1,3]],
  },
  {
    name: 'チュートリアル 2',
    grid: [
      [makeCell('source',0), makeCell('straight',0), makeCell('l',0)],
      [E(),                  E(),                    makeCell('straight',0)],
      [makeCell('bulb',0),   makeCell('straight',0), makeCell('l',0)],
    ],
    solution: [[3,1,2],[0,0,0],[3,1,3]],
  },
  {
    name: 'チュートリアル 3',
    grid: [
      [E(),               makeCell('source',0), E()],
      [makeCell('bulb',0), makeCell('cross',0), makeCell('bulb',0)],
      [E(),               makeCell('bulb',0),  E()],
    ],
    solution: [[0,0,0],[3,0,1],[0,2,0]],
  },
  {
    name: 'ステージ 4',
    grid: [
      [makeCell('source',0), makeCell('straight',0), makeCell('straight',0), makeCell('l',0)],
      [E(),                  E(),                    E(),                    makeCell('straight',0)],
      [makeCell('l',0),      makeCell('straight',0), makeCell('straight',0), makeCell('l',0)],
      [makeCell('l',0),      makeCell('straight',0), makeCell('straight',0), makeCell('bulb',0)],
    ],
    solution: [[3,1,1,2],[0,0,0,0],[1,1,1,3],[0,1,1,1]],
  },
  {
    name: 'ステージ 5',
    grid: [
      [makeCell('source',0), makeCell('straight',0), makeCell('l',0),       E()],
      [E(),                  E(),                    makeCell('straight',0), E()],
      [E(),                  makeCell('bulb',0),     makeCell('t',0),        E()],
      [E(),                  E(),                    makeCell('l',0),        makeCell('bulb',0)],
    ],
    solution: [[3,1,2,0],[0,0,0,0],[0,3,1,0],[0,0,0,1]],
  },
  {
    name: 'ステージ 6',
    grid: [
      [makeCell('source',0), makeCell('straight',0), makeCell('l',0),    E()],
      [makeCell('bulb',0),   makeCell('straight',0), makeCell('cross',0), E()],
      [E(),                  E(),                    makeCell('straight',0), E()],
      [E(),                  E(),                    makeCell('bulb',0),  E()],
    ],
    solution: [[3,1,2,0],[3,1,0,0],[0,0,0,0],[0,0,2,0]],
  },
  {
    name: 'ステージ 7',
    grid: [
      [makeCell('source',0), makeCell('straight',0), makeCell('l',0),       makeCell('straight',0), makeCell('l',0)],
      [makeCell('straight',0), makeCell('l',0),      makeCell('straight',0), makeCell('l',0),       makeCell('straight',0)],
      [makeCell('l',0),      makeCell('straight',0), makeCell('cross',0),   makeCell('straight',0), makeCell('l',0)],
      [makeCell('straight',0), makeCell('l',0),      makeCell('straight',0), makeCell('l',0),       makeCell('straight',0)],
      [makeCell('l',0),      makeCell('straight',0), makeCell('l',0),       makeCell('straight',0), makeCell('bulb',0)],
    ],
    solution: [[3,1,2,1,2],[0,1,0,3,0],[3,1,0,1,2],[0,3,0,1,0],[1,1,3,1,2]],
  },
  {
    name: 'ステージ 8',
    grid: [
      [makeCell('source',0), makeCell('straight',0), makeCell('l',0),       E(),                E()],
      [makeCell('l',0),      makeCell('straight',0), makeCell('l',0),       E(),                E()],
      [makeCell('l',0),      makeCell('straight',0), makeCell('straight',0), makeCell('straight',0), makeCell('l',0)],
      [makeCell('l',0),      makeCell('straight',0), makeCell('straight',0), makeCell('straight',0), makeCell('l',0)],
      [makeCell('l',0),      makeCell('straight',0), makeCell('straight',0), makeCell('straight',0), makeCell('bulb',0)],
    ],
    solution: [[3,1,2,0,0],[1,1,3,0,0],[0,1,1,1,2],[1,1,1,1,3],[0,1,1,1,1]],
  },
  {
    name: 'ブリッジ入門',
    grid: [
      [makeCell('source',3), E(),                  E(),                    E()],
      [makeCell('t',2),      makeCell('l',1),       E(),                    E()],
      [makeCell('l',3),      makeCell('bridge',0),  makeCell('straight',0), makeCell('bulb',0)],
      [E(),                  makeCell('bulb',1),    E(),                    E()],
    ],
    solution: [[0,0,0,0],[3,2,0,0],[0,0,1,1],[0,2,0,0]],
  },
  {
    name: 'ロック回路',
    grid: [
      [makeCell('source',0,true), makeCell('bulb',2),            makeCell('l',1),             E()],
      [makeCell('straight',0,true), E(),                         makeCell('straight',0,true), E()],
      [makeCell('l',3),             makeCell('straight',1,true), makeCell('l',2),             E()],
    ],
    solution: [[0,3,2,0],[0,0,0,0],[0,1,3,0]],
  },
  {
    name: 'ステージ 11',
    grid: [
      [makeCell('source',2), makeCell('straight',0), makeCell('l',1), E()],
      [E(), makeCell('l',3), makeCell('l',2), E()],
      [E(), makeCell('l',1), makeCell('l',3), E()],
      [E(), E(), makeCell('l',1), makeCell('bulb',3)],
    ],
    solution: [[3,1,2,0],[0,1,3,0],[0,0,2,0],[0,0,0,1]],
  },
  {
    name: 'ステージ 12',
    grid: [
      [makeCell('source',2), makeCell('straight',0), makeCell('straight',0), makeCell('l',3)],
      [E(), E(), E(), makeCell('straight',1)],
      [makeCell('l',3), makeCell('straight',0), makeCell('straight',0), makeCell('l',1)],
      [makeCell('bulb',1), E(), E(), E()],
    ],
    solution: [[3,1,1,2],[0,0,0,0],[1,1,1,3],[2,0,0,0]],
  },
  {
    name: 'ステージ 13',
    grid: [
      [E(), makeCell('source',2), E(), E()],
      [E(), makeCell('l',2), makeCell('t',2), makeCell('l',0)],
      [E(), E(), makeCell('straight',1), E()],
      [E(), E(), makeCell('bulb',0), E()],
    ],
    solution: [[0,0,0,0],[0,0,0,2],[0,0,0,0],[0,0,2,0]],
  },
  {
    name: 'ステージ 14',
    grid: [
      [E(), E(), makeCell('source',2), E()],
      [makeCell('l',3), makeCell('cross',0), makeCell('l',1), E()],
      [makeCell('bulb',0), E(), E(), E()],
      [E(), E(), E(), E()],
    ],
    solution: [[0,0,0,0],[1,0,3,0],[2,0,0,0],[0,0,0,0]],
  },
  {
    name: 'ステージ 15',
    grid: [
      [E(), makeCell('source',2), E(), E()],
      [makeCell('l',3), makeCell('t',0), makeCell('l',0), E()],
      [makeCell('bulb',0), E(), makeCell('bulb',0), E()],
      [E(), E(), E(), E()],
    ],
    solution: [[0,0,0,0],[1,2,2,0],[2,0,2,0],[0,0,0,0]],
  },
  {
    name: 'ステージ 16',
    grid: [
      [makeCell('source',0), makeCell('l',0), E(), E(), E()],
      [E(), makeCell('straight',1), E(), E(), E()],
      [E(), makeCell('l',2), makeCell('straight',0), makeCell('l',0), E()],
      [makeCell('bulb',1), E(), E(), makeCell('straight',1), E()],
      [makeCell('l',2), makeCell('straight',0), makeCell('straight',0), makeCell('l',1), E()],
    ],
    solution: [[3,2,0,0,0],[0,0,0,0,0],[0,0,1,2,0],[0,0,0,0,0],[0,1,1,3,0]],
  },
  {
    name: 'ステージ 17',
    grid: [
      [E(), E(), makeCell('l',2), E(), E()],
      [makeCell('source',0), makeCell('straight',0), makeCell('bridge',0), makeCell('straight',0), makeCell('bulb',3)],
      [E(), E(), makeCell('l',0), E(), E()],
    ],
    solution: [[0,0,0,0,0],[3,1,0,1,1],[0,0,0,0,0]],
  },
  {
    name: 'ステージ 18',
    grid: [
      [E(), makeCell('source',2), E(), E()],
      [makeCell('l',3), makeCell('t',0), makeCell('l',0), E()],
      [makeCell('straight',1), E(), makeCell('straight',1), E()],
      [makeCell('bulb',0), E(), makeCell('bulb',0), E()],
    ],
    solution: [[0,0,0,0],[1,2,2,0],[0,0,0,0],[2,0,2,0]],
  },
  {
    name: 'ステージ 19',
    grid: [
      [makeCell('source',0), makeCell('straight',0), makeCell('l',3), E(), E()],
      [E(), E(), makeCell('straight',1), E(), E()],
      [makeCell('l',2), makeCell('straight',0), makeCell('cross',0), makeCell('straight',0), makeCell('l',2)],
      [E(), E(), makeCell('straight',1), E(), E()],
      [E(), E(), makeCell('l',1), makeCell('straight',0), makeCell('bulb',3)],
    ],
    solution: [[3,1,2,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,1,1]],
  },
  {
    name: 'ステージ 20',
    grid: [
      [E(), E(), makeCell('source',2), E(), E()],
      [E(), makeCell('l',3), makeCell('t',0), makeCell('l',0), E()],
      [E(), makeCell('straight',1), E(), makeCell('straight',1), E()],
      [E(), makeCell('straight',1), E(), makeCell('straight',1), E()],
      [E(), makeCell('bulb',0), E(), makeCell('bulb',0), E()],
    ],
    solution: [[0,0,0,0,0],[0,1,2,2,0],[0,0,0,0,0],[0,0,0,0,0],[0,2,0,2,0]],
  },
  {
    name: 'ステージ 21',
    grid: [
      [makeCell('source',0), makeCell('straight',0), makeCell('straight',0), makeCell('straight',0), makeCell('l',3)],
      [E(), E(), E(), E(), makeCell('straight',1)],
      [E(), E(), E(), E(), makeCell('straight',1)],
      [E(), makeCell('l',3), makeCell('straight',0), makeCell('straight',0), makeCell('l',1)],
      [E(), makeCell('bulb',0), E(), E(), E()],
    ],
    solution: [[3,1,1,1,2],[0,0,0,0,0],[0,0,0,0,0],[0,1,1,1,3],[0,2,0,0,0]],
  },
  {
    name: 'ステージ 22',
    grid: [
      [makeCell('source',2), makeCell('l',2), E(), makeCell('l',2), makeCell('bulb',1)],
      [makeCell('straight',1), makeCell('straight',1), makeCell('straight',1), makeCell('straight',1), makeCell('straight',1)],
      [makeCell('l',2), makeCell('straight',0), makeCell('cross',0), makeCell('straight',0), makeCell('l',1)],
      [E(), E(), makeCell('straight',1), E(), E()],
      [E(), E(), makeCell('bulb',1), E(), E()],
    ],
    solution: [[0,0,0,0,0],[0,0,0,0,0],[0,1,0,1,3],[0,0,0,0,0],[0,0,2,0,0]],
  },
  {
    name: 'ステージ 23',
    grid: [
      [E(), E(), makeCell('source',2), E(), E()],
      [E(), E(), makeCell('straight',1), E(), E()],
      [makeCell('bulb',1), makeCell('straight',0), makeCell('cross',0), makeCell('straight',0), makeCell('bulb',3)],
      [E(), E(), makeCell('straight',1), E(), E()],
      [E(), E(), makeCell('bulb',1), E(), E()],
    ],
    solution: [[0,0,0,0,0],[0,0,0,0,0],[3,1,0,1,1],[0,0,0,0,0],[0,0,2,0,0]],
  },
  {
    name: 'ステージ 24',
    grid: [
      [makeCell('source',0), makeCell('straight',0), makeCell('straight',0), makeCell('straight',0), makeCell('l',3)],
      [E(), E(), E(), E(), makeCell('straight',1)],
      [makeCell('l',3), makeCell('straight',0), makeCell('straight',0), makeCell('cross',0), makeCell('l',1)],
      [makeCell('straight',1), E(), E(), E(), E()],
      [makeCell('l',2), makeCell('straight',0), makeCell('straight',0), makeCell('straight',0), makeCell('bulb',3)],
    ],
    solution: [[3,1,1,1,2],[0,0,0,0,0],[1,1,1,0,3],[0,0,0,0,0],[0,1,1,1,1]],
  },
  {
    name: 'ステージ 25',
    grid: [
      [makeCell('source',0), makeCell('straight',0), makeCell('t',2), makeCell('straight',0), makeCell('bulb',3)],
      [E(), E(), makeCell('straight',1), E(), E()],
      [E(), E(), makeCell('cross',0), E(), E()],
      [E(), E(), makeCell('bridge',0), E(), E()],
      [E(), E(), makeCell('bulb',1), E(), E()],
    ],
    solution: [[3,1,0,1,1],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,2,0,0]],
  },
  {
    name: 'ワンウェイ入門',
    grid: [
      [makeCell('source',0), E(),                  E()],
      [ow(0),                E(),                  E()],
      [makeCell('l',0),      makeCell('straight',0), makeCell('bulb',0)],
    ],
    solution: [[0,0,0],[2,0,0],[0,1,1]],
  },
  {
    name: 'ワンウェイ分岐',
    grid: [
      [makeCell('source',2), ow(0),               makeCell('t',3),       makeCell('bulb',0)],
      [E(),                  E(),                  ow(1),                 E()],
      [E(),                  E(),                  makeCell('bulb',1),    E()],
    ],
    solution: [[3,1,0,1],[0,0,2,0],[0,0,2,0]],
  },
  {
    name: 'ジグザグ',
    grid: [
      [makeCell('source',3), E(),    makeCell('bulb',3)],
      [ow(1),                E(),    ow(3)],
      [makeCell('l',3),      ow(0),  makeCell('l',2)],
    ],
    solution: [[0,0,0],[2,0,0],[0,1,3]],
  },
  {
    name: 'ダブルルート',
    grid: [
      [makeCell('source',2), ow(0),               makeCell('t',3),       makeCell('l',2)],
      [E(),                  E(),                  ow(1),                 makeCell('bulb',2)],
      [E(),                  E(),                  makeCell('l',3),       makeCell('bulb',0)],
    ],
    solution: [[3,1,0,2],[0,0,2,2],[0,0,0,1]],
  },
  {
    name: 'フォーク',
    grid: [
      [makeCell('source',2), makeCell('l',0), E(), E()],
      [E(), makeCell('t',0), makeCell('straight',0), makeCell('bulb',1)],
      [E(), makeCell('straight',0), E(), E()],
      [E(), makeCell('bulb',2), E(), E()],
    ],
    solution: [[3,2,0,0],[0,3,1,1],[0,0,0,0],[0,2,0,0]],
  },
  {
    name: 'スネーク',
    grid: [
      [makeCell('source',0), makeCell('straight',0), makeCell('straight',0), makeCell('straight',0), makeCell('l',0)],
      [E(), E(), E(), E(), makeCell('straight',1)],
      [makeCell('bulb',3), makeCell('straight',0), makeCell('straight',0), makeCell('straight',0), makeCell('l',1)],
    ],
    solution: [[3,1,1,1,2],[0,0,0,0,0],[3,1,1,1,3]],
  },
  {
    name: 'コの字',
    grid: [
      [makeCell('source',0), makeCell('straight',0), makeCell('straight',0), makeCell('l',0)],
      [E(), E(), E(), makeCell('straight',1)],
      [E(), E(), E(), makeCell('straight',1)],
      [makeCell('bulb',3), makeCell('straight',0), makeCell('straight',0), makeCell('l',1)],
    ],
    solution: [[3,1,1,2],[0,0,0,0],[0,0,0,0],[3,1,1,3]],
  },
  {
    name: 'クロスロード',
    grid: [
      [makeCell('source',0), makeCell('straight',0), makeCell('l',0), E(), E()],
      [E(), E(), makeCell('straight',1), E(), E()],
      [E(), E(), makeCell('cross',0), makeCell('straight',0), makeCell('bulb',1)],
      [E(), E(), makeCell('straight',1), E(), E()],
      [E(), E(), makeCell('bulb',2), E(), E()],
    ],
    solution: [[3,1,2,0,0],[0,0,0,0,0],[0,0,0,1,1],[0,0,0,0,0],[0,0,2,0,0]],
  },
  {
    name: 'ブリッジ迷路',
    grid: [
      [makeCell('source',0), E(), E(), E(), E()],
      [makeCell('t',0), makeCell('straight',0), makeCell('bridge',0), makeCell('straight',0), makeCell('bulb',1)],
      [makeCell('straight',1), E(), E(), E(), E()],
      [makeCell('bulb',2), E(), E(), E(), E()],
    ],
    solution: [[0,0,0,0,0],[3,1,0,1,1],[0,0,0,0,0],[2,0,0,0,0]],
  },
  {
    name: 'カラーダブル',
    grid: [
      [makeCell('source',0), makeCell('l',0), E(), E()],
      [E(), makeCell('straight',1), E(), E()],
      [E(), makeCell('l',2), makeCell('straight',0), makeCell('bulb',1)],
      [makeCell('source',0), makeCell('straight',0), makeCell('straight',0), makeCell('bulb',1)],
    ],
    solution: [[3,2,0,0],[0,0,0,0],[0,0,1,1],[3,1,1,1]],
  },
  {
    name: 'ダイオードスパイラル',
    grid: [
      [makeCell('source',0), ow(0), makeCell('l',0), E()],
      [E(), E(), makeCell('straight',1), E()],
      [E(), E(), ow(0), E()],
      [E(), E(), makeCell('l',2), makeCell('bulb',1)],
    ],
    solution: [[3,1,2,0],[0,0,0,0],[0,0,2,0],[0,0,0,1]],
  },
  {
    name: 'ダブルT',
    grid: [
      [E(), E(), makeCell('source',0), E(), E()],
      [E(), E(), makeCell('straight',1), E(), E()],
      [E(), E(), makeCell('t',0), makeCell('straight',0), makeCell('bulb',1)],
      [makeCell('bulb',3), makeCell('straight',0), makeCell('t',0), E(), E()],
    ],
    solution: [[0,0,0,0,0],[0,0,0,0,0],[0,0,3,1,1],[3,1,2,0,0]],
  },
  {
    name: '大スネーク',
    grid: [
      [makeCell('source',0), makeCell('straight',0), makeCell('straight',0), makeCell('straight',0), makeCell('l',0)],
      [E(), E(), E(), E(), makeCell('straight',1)],
      [makeCell('l',0), makeCell('straight',0), makeCell('straight',0), makeCell('straight',0), makeCell('l',1)],
      [makeCell('straight',0), E(), E(), E(), E()],
      [makeCell('l',2), makeCell('straight',0), makeCell('straight',0), makeCell('straight',0), makeCell('bulb',1)],
    ],
    solution: [[3,1,1,1,2],[0,0,0,0,0],[1,1,1,1,3],[0,0,0,0,0],[0,1,1,1,1]],
  },
  {
    name: 'グランドフィナーレ',
    grid: [
      [E(), E(), makeCell('source',0), E(), E()],
      [E(), E(), makeCell('straight',1), E(), E()],
      [E(), E(), makeCell('t',1), makeCell('straight',0), makeCell('l',0)],
      [E(), E(), makeCell('straight',1), E(), makeCell('straight',1)],
      [makeCell('bulb',3), makeCell('straight',0), makeCell('l',1), E(), makeCell('bulb',2)],
    ],
    solution: [[0,0,0,0,0],[0,0,0,0,0],[0,0,3,1,2],[0,0,0,0,0],[3,1,3,0,2]],
  },
  {
    name: 'ターン',
    grid: [
      [E(), E(), makeCell('source',1), makeCell('l',3)],
      [E(), E(), E(), makeCell('straight',1)],
      [E(), makeCell('bulb',2), makeCell('straight',0), makeCell('l',2)],
    ],
    solution: [[0,0,3,2],[0,0,0,0],[0,3,1,3]],
    minMoves: 7,
  },
  {
    name: 'コーナー',
    grid: [
      [E(), makeCell('l',2), makeCell('straight',0), makeCell('straight',0), makeCell('l',0)],
      [E(), makeCell('l',1), makeCell('l',0), E(), makeCell('bulb',1)],
      [E(), E(), makeCell('source',3), E(), E()],
    ],
    solution: [[0,1,1,1,2],[0,0,2,0,2],[0,0,2,0,0]],
    minMoves: 10,
  },
  {
    name: 'U字回路',
    grid: [
      [makeCell('l',2), makeCell('l',0), makeCell('bulb',3), E(), E(), E()],
      [makeCell('straight',1), makeCell('straight',1), makeCell('straight',1), E(), E(), E()],
      [makeCell('source',0), makeCell('l',3), makeCell('l',2), E(), E(), E()],
    ],
    solution: [[1,2,0,0,0,0],[0,0,0,0,0,0],[2,0,3,0,0,0]],
    minMoves: 11,
  },
  {
    name: '折返し',
    grid: [
      [E(), makeCell('source',1), makeCell('straight',0), makeCell('l',0), makeCell('l',2), makeCell('l',0), E()],
      [E(), E(), E(), makeCell('l',1), makeCell('l',1), makeCell('straight',1), E()],
      [E(), E(), E(), E(), makeCell('bulb',1), makeCell('l',2), E()],
    ],
    solution: [[0,3,1,2,1,2,0],[0,0,0,0,3,0,0],[0,0,0,0,3,3,0]],
    minMoves: 15,
  },
  {
    name: 'ノコギリ',
    grid: [
      [makeCell('l',2), makeCell('straight',0), makeCell('l',1), makeCell('bulb',0), makeCell('l',0), E(), E(), E()],
      [makeCell('l',2), makeCell('source',3), makeCell('l',3), makeCell('l',3), makeCell('straight',1), E(), E(), E()],
      [E(), E(), E(), makeCell('l',2), makeCell('l',0), E(), E(), E()],
    ],
    solution: [[1,1,2,3,2,0,0,0],[0,1,0,2,0,0,0,0],[0,0,0,0,3,0,0,0]],
    minMoves: 16,
  },
  {
    name: '迷路の入口',
    grid: [
      [E(), E(), E(), E(), E()],
      [makeCell('l',2), makeCell('bulb',2), E(), E(), E()],
      [makeCell('l',1), makeCell('l',1), E(), E(), makeCell('source',2)],
      [E(), makeCell('l',2), makeCell('straight',0), makeCell('straight',0), makeCell('l',2)],
    ],
    solution: [[0,0,0,0,0],[1,1,0,0,0],[0,2,0,0,0],[0,0,1,1,3]],
    minMoves: 11,
  },
  {
    name: '蛇の道',
    grid: [
      [makeCell('l',3), makeCell('straight',0), makeCell('straight',0), makeCell('l',1), E()],
      [makeCell('straight',1), E(), makeCell('l',0), makeCell('l',2), E()],
      [makeCell('l',3), makeCell('source',2), makeCell('straight',1), E(), E()],
      [E(), E(), makeCell('l',2), makeCell('bulb',0), E()],
    ],
    solution: [[1,1,1,2,0],[0,0,1,3,0],[0,1,0,0,0],[0,0,0,1,0]],
    minMoves: 14,
  },
  {
    name: 'ツインパス',
    grid: [
      [E(), E(), makeCell('l',0), makeCell('straight',0), makeCell('straight',0), makeCell('l',1)],
      [makeCell('source',2), makeCell('l',0), makeCell('l',2), E(), makeCell('l',2), makeCell('l',2)],
      [makeCell('l',1), makeCell('l',2), E(), E(), makeCell('bulb',0), E()],
      [E(), E(), E(), E(), E(), E()],
    ],
    solution: [[0,0,1,1,1,2],[0,1,3,0,1,3],[0,3,0,0,2,0],[0,0,0,0,0,0]],
    minMoves: 14,
  },
  {
    name: 'ロングパス',
    grid: [
      [E(), E(), makeCell('l',0), makeCell('straight',0), makeCell('l',0), makeCell('l',3), makeCell('l',0)],
      [E(), E(), makeCell('l',2), makeCell('l',3), makeCell('l',2), makeCell('l',2), makeCell('source',1)],
      [E(), E(), E(), makeCell('straight',1), makeCell('l',2), makeCell('bulb',3), E()],
      [E(), E(), E(), makeCell('l',1), makeCell('l',2), E(), E()],
    ],
    solution: [[0,0,1,1,2,1,2],[0,0,0,2,0,3,2],[0,0,0,0,1,1,0],[0,0,0,0,3,0,0]],
    minMoves: 21,
  },
  {
    name: '道中',
    grid: [
      [E(), E(), makeCell('l',0), makeCell('straight',0), makeCell('straight',0), makeCell('straight',0), makeCell('l',3)],
      [E(), E(), makeCell('l',2), makeCell('l',3), E(), E(), makeCell('bulb',0)],
      [E(), E(), makeCell('l',0), makeCell('l',1), makeCell('source',1), makeCell('l',0), E()],
      [E(), E(), makeCell('l',1), makeCell('straight',0), makeCell('straight',0), makeCell('l',1), E()],
    ],
    solution: [[0,0,1,1,1,1,2],[0,0,0,2,0,0,2],[0,0,1,3,3,2,0],[0,0,0,1,1,3,0]],
    minMoves: 22,
  },
  {
    name: '交差I',
    grid: [
      [makeCell('l',2), makeCell('l',3), E(), E(), E()],
      [makeCell('straight',1), makeCell('straight',1), E(), E(), E()],
      [makeCell('bulb',3), makeCell('straight',1), E(), E(), E()],
      [E(), makeCell('l',3), makeCell('straight',0), makeCell('l',3), E()],
      [E(), E(), E(), makeCell('source',1), E()],
    ],
    solution: [[1,2,0,0,0],[0,0,0,0,0],[2,0,0,0,0],[0,0,1,2,0],[0,0,0,2,0]],
    minMoves: 10,
  },
  {
    name: 'クロス迷路',
    grid: [
      [E(), E(), E(), E(), E()],
      [E(), makeCell('l',0), makeCell('straight',0), makeCell('l',1), E()],
      [E(), makeCell('source',3), makeCell('l',0), makeCell('l',2), E()],
      [E(), E(), makeCell('straight',1), makeCell('l',3), makeCell('l',3)],
      [E(), E(), makeCell('l',1), makeCell('l',2), makeCell('bulb',3)],
    ],
    solution: [[0,0,0,0,0],[0,1,1,2,0],[0,2,1,3,0],[0,0,0,1,2],[0,0,0,3,2]],
    minMoves: 13,
  },
  {
    name: 'ブリッジ大橋',
    grid: [
      [makeCell('l',2), makeCell('l',3), E(), E(), E()],
      [makeCell('straight',1), makeCell('l',2), makeCell('l',0), E(), E()],
      [makeCell('straight',1), E(), makeCell('l',3), makeCell('source',3), E()],
      [makeCell('straight',1), E(), E(), E(), E()],
      [makeCell('l',1), makeCell('straight',0), makeCell('straight',0), makeCell('straight',0), makeCell('bulb',2)],
    ],
    solution: [[1,2,0,0,0],[0,0,2,0,0],[0,0,0,1,0],[0,0,0,0,0],[0,1,1,1,1]],
    minMoves: 17,
  },
  {
    name: '重なる道',
    grid: [
      [E(), E(), makeCell('l',0), makeCell('source',0), E()],
      [E(), E(), makeCell('l',2), makeCell('l',3), E()],
      [E(), E(), E(), makeCell('l',1), makeCell('l',1)],
      [makeCell('l',3), makeCell('straight',0), makeCell('straight',0), makeCell('straight',0), makeCell('l',2)],
      [makeCell('l',3), makeCell('straight',0), makeCell('straight',0), makeCell('straight',0), makeCell('bulb',2)],
    ],
    solution: [[0,0,1,1,0],[0,0,0,2,0],[0,0,0,0,2],[1,1,1,1,3],[0,1,1,1,1]],
    minMoves: 18,
  },
  {
    name: 'レイヤード',
    grid: [
      [E(), makeCell('l',3), makeCell('l',0), E(), E()],
      [makeCell('l',0), makeCell('l',1), makeCell('straight',1), E(), E()],
      [makeCell('source',1), makeCell('l',2), makeCell('l',2), makeCell('bulb',0), makeCell('l',1)],
      [makeCell('l',0), makeCell('l',0), makeCell('l',3), makeCell('straight',0), makeCell('l',1)],
      [makeCell('l',2), makeCell('straight',0), makeCell('l',2), E(), E()],
    ],
    solution: [[0,1,2,0,0],[1,3,0,0,0],[2,1,3,3,2],[1,3,1,1,3],[0,1,3,0,0]],
    minMoves: 24,
  },
  {
    name: '二股I',
    grid: [
      [E(), E(), E(), E(), E()],
      [E(), E(), makeCell('l',3), makeCell('t',2), makeCell('l',1)],
      [E(), E(), makeCell('bulb',1), makeCell('straight',1), makeCell('bulb',0)],
      [E(), E(), E(), makeCell('source',1), E()],
    ],
    solution: [[0,0,0,0,0],[0,0,1,0,2],[0,0,2,0,2],[0,0,0,2,0]],
    minMoves: 10,
  },
  {
    name: '三叉路',
    grid: [
      [E(), E(), E(), E(), makeCell('bulb',1)],
      [E(), E(), E(), E(), makeCell('straight',1)],
      [E(), makeCell('bulb',1), makeCell('l',3), makeCell('l',0), makeCell('l',0)],
      [E(), E(), makeCell('l',2), makeCell('t',3), makeCell('l',0)],
      [E(), E(), makeCell('source',0), makeCell('straight',0), makeCell('l',2)],
    ],
    solution: [[0,0,0,0,0],[0,0,0,0,0],[0,3,2,1,3],[0,0,0,2,2],[0,0,3,1,3]],
    minMoves: 15,
  },
  {
    name: '双子の電球',
    grid: [
      [E(), E(), makeCell('source',2), makeCell('l',1), makeCell('bulb',2)],
      [E(), E(), E(), makeCell('straight',1), makeCell('straight',1)],
      [E(), E(), makeCell('l',2), makeCell('t',3), makeCell('l',1)],
      [E(), E(), makeCell('l',2), makeCell('bulb',2), E()],
      [E(), E(), E(), E(), E()],
      [E(), E(), E(), E(), E()],
    ],
    solution: [[0,0,3,2,0],[0,0,0,0,0],[0,0,1,2,3],[0,0,0,1,0],[0,0,0,0,0],[0,0,0,0,0]],
    minMoves: 13,
  },
  {
    name: '並行回路',
    grid: [
      [E(), E(), E(), E(), E()],
      [E(), E(), E(), E(), E()],
      [E(), E(), E(), E(), E()],
      [E(), E(), E(), makeCell('bulb',2), E()],
      [E(), E(), makeCell('bulb',3), makeCell('straight',1), E()],
      [E(), E(), makeCell('l',1), makeCell('t',0), makeCell('l',0)],
      [E(), E(), E(), E(), makeCell('source',0)],
    ],
    solution: [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,2,2],[0,0,0,0,2]],
    minMoves: 11,
  },
  {
    name: '分岐迷宮',
    grid: [
      [E(), makeCell('l',2), makeCell('straight',0), makeCell('t',3), makeCell('bulb',2)],
      [E(), makeCell('bulb',0), E(), makeCell('l',3), makeCell('l',1)],
      [E(), E(), E(), E(), makeCell('source',1)],
      [E(), E(), E(), E(), E()],
      [E(), E(), E(), E(), E()],
      [E(), E(), E(), E(), E()],
      [E(), E(), E(), E(), E()],
      [E(), E(), E(), E(), E()],
    ],
    solution: [[0,1,1,0,1],[0,2,0,0,2],[0,0,0,0,2],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0]],
    minMoves: 9,
  },
  {
    name: '熟練I',
    grid: [
      [E(), makeCell('source',0), makeCell('l',3), makeCell('bulb',2), makeCell('l',3)],
      [E(), E(), makeCell('l',3), makeCell('t',2), makeCell('l',0)],
      [E(), E(), E(), makeCell('straight',1), E()],
      [E(), E(), E(), makeCell('bulb',0), E()],
      [E(), E(), E(), E(), E()],
    ],
    solution: [[0,3,2,3,2],[0,0,0,0,3],[0,0,0,0,0],[0,0,0,2,0],[0,0,0,0,0]],
    minMoves: 11,
  },
  {
    name: '名人I',
    grid: [
      [E(), E(), E(), makeCell('l',2), makeCell('l',0)],
      [E(), makeCell('l',3), makeCell('straight',0), makeCell('t',3), makeCell('straight',1)],
      [E(), makeCell('straight',1), E(), makeCell('straight',1), makeCell('source',0)],
      [E(), makeCell('bulb',1), E(), makeCell('straight',1), makeCell('bulb',2)],
      [E(), E(), E(), makeCell('l',1), makeCell('l',0)],
    ],
    solution: [[0,0,0,1,2],[0,1,1,1,0],[0,0,0,0,2],[0,2,0,0,0],[0,0,0,0,3]],
    minMoves: 19,
  },
  {
    name: '達人I',
    grid: [
      [E(), E(), makeCell('l',0), makeCell('bulb',3), makeCell('bulb',1)],
      [E(), E(), makeCell('l',3), makeCell('t',1), makeCell('l',0)],
      [E(), E(), E(), makeCell('l',2), makeCell('l',3)],
      [E(), E(), E(), E(), makeCell('source',0)],
      [E(), E(), E(), E(), E()],
    ],
    solution: [[0,0,1,1,0],[0,0,0,0,3],[0,0,0,0,2],[0,0,0,0,2],[0,0,0,0,0]],
    minMoves: 12,
  },
  {
    name: '賢者I',
    grid: [
      [E(), E(), makeCell('bulb',2), makeCell('bulb',1), makeCell('l',1)],
      [E(), E(), makeCell('l',1), makeCell('straight',0), makeCell('t',2)],
      [E(), E(), makeCell('source',1), makeCell('straight',0), makeCell('l',1)],
      [E(), E(), E(), E(), E()],
      [E(), E(), E(), E(), E()],
    ],
    solution: [[0,0,0,3,2],[0,0,0,1,1],[0,0,3,1,3],[0,0,0,0,0],[0,0,0,0,0]],
    minMoves: 13,
  },
  {
    name: '聖人',
    grid: [
      [E(), E(), makeCell('bulb',3), E(), E()],
      [E(), E(), makeCell('straight',1), makeCell('source',0), makeCell('l',0)],
      [E(), E(), makeCell('straight',1), makeCell('l',0), makeCell('l',1)],
      [E(), E(), makeCell('l',3), makeCell('t',0), makeCell('bulb',1)],
      [E(), E(), E(), makeCell('l',2), makeCell('l',2)],
    ],
    solution: [[0,0,0,0,0],[0,0,0,3,2],[0,0,0,1,3],[0,0,0,1,0],[0,0,0,0,3]],
    minMoves: 15,
  },
  {
    name: '伝説I',
    grid: [
      [makeCell('l',0), makeCell('straight',0), makeCell('l',3), makeCell('l',2), makeCell('l',0)],
      [makeCell('l',3), makeCell('l',3), makeCell('l',1), makeCell('l',0), makeCell('straight',1)],
      [E(), makeCell('l',2), makeCell('bulb',2), makeCell('l',3), makeCell('l',1)],
      [E(), E(), E(), makeCell('l',3), makeCell('source',3)],
      [E(), E(), E(), E(), E()],
    ],
    solution: [[1,1,2,1,2],[0,2,0,3,0],[0,0,1,1,3],[0,0,0,0,1],[0,0,0,0,0]],
    minMoves: 21,
  },
  {
    name: '神話I',
    grid: [
      [makeCell('l',2), makeCell('straight',0), makeCell('straight',0), makeCell('straight',0), makeCell('l',1)],
      [makeCell('l',3), makeCell('straight',0), makeCell('straight',0), makeCell('l',0), makeCell('bulb',0)],
      [E(), E(), makeCell('l',3), makeCell('l',2), makeCell('source',3)],
      [E(), E(), makeCell('l',2), makeCell('l',0), makeCell('straight',1)],
      [E(), E(), E(), makeCell('l',2), makeCell('l',2)],
    ],
    solution: [[1,1,1,1,2],[0,1,1,2,2],[0,0,1,3,0],[0,0,0,2,0],[0,0,0,0,3]],
    minMoves: 24,
  },
  {
    name: '終焉I',
    grid: [
      [makeCell('bulb',2), makeCell('l',3), makeCell('straight',0), makeCell('straight',0), makeCell('l',0)],
      [makeCell('straight',1), makeCell('l',3), makeCell('source',0), E(), makeCell('straight',1)],
      [makeCell('straight',1), E(), E(), makeCell('l',2), makeCell('l',1)],
      [makeCell('straight',1), makeCell('l',2), makeCell('straight',0), makeCell('l',2), E()],
      [makeCell('l',1), makeCell('l',2), E(), E(), E()],
    ],
    solution: [[0,1,1,1,2],[0,0,1,0,0],[0,0,0,1,3],[0,1,1,3,0],[0,3,0,0,0]],
    minMoves: 22,
  },
  {
    name: '永劫',
    grid: [
      [makeCell('l',3), makeCell('bulb',3), makeCell('l',0), makeCell('straight',0), makeCell('l',1)],
      [makeCell('l',2), makeCell('l',1), makeCell('l',1), makeCell('l',3), makeCell('straight',1)],
      [E(), makeCell('straight',1), E(), makeCell('source',3), makeCell('straight',1)],
      [E(), makeCell('l',3), makeCell('straight',0), makeCell('l',1), makeCell('straight',1)],
      [E(), E(), E(), makeCell('l',2), makeCell('l',0)],
    ],
    solution: [[1,1,1,1,2],[0,2,0,2,0],[0,0,0,2,0],[0,0,1,2,0],[0,0,0,0,3]],
    minMoves: 23,
  },
  {
    name: '終末',
    grid: [
      [makeCell('l',3), makeCell('straight',0), makeCell('straight',0), makeCell('straight',0), makeCell('bulb',2)],
      [makeCell('l',3), makeCell('straight',0), makeCell('l',1), E(), E()],
      [makeCell('l',3), makeCell('source',2), makeCell('l',1), makeCell('l',0), E()],
      [makeCell('straight',1), E(), E(), makeCell('l',1), makeCell('l',3)],
      [makeCell('l',2), makeCell('straight',0), makeCell('straight',0), makeCell('straight',0), makeCell('l',1)],
    ],
    solution: [[1,1,1,1,1],[0,1,2,0,0],[1,1,0,2,0],[0,0,0,0,2],[0,1,1,1,3]],
    minMoves: 25,
  },
  {
    name: '究極の試練',
    grid: [
      [makeCell('l',0), makeCell('l',3), makeCell('l',2), makeCell('l',3), makeCell('bulb',2)],
      [makeCell('straight',1), makeCell('l',1), makeCell('l',2), makeCell('straight',1), makeCell('straight',1)],
      [makeCell('l',1), makeCell('l',0), makeCell('source',3), makeCell('straight',1), makeCell('straight',1)],
      [makeCell('l',0), makeCell('l',1), makeCell('straight',1), makeCell('l',3), makeCell('l',2)],
      [makeCell('l',1), makeCell('straight',0), makeCell('l',1), E(), E()],
    ],
    solution: [[1,2,1,2,0],[0,0,3,0,0],[0,2,0,0,0],[1,3,0,0,3],[0,1,3,0,0]],
    minMoves: 27,
  },
  {
    name: '抵抗器入門',
    grid: [
      [srcP(0, 3), makeCell('resistor', 0), makeCell('resistor', 0), makeCell('bulb', 0)],
    ],
    solution: [[3,1,1,1]],
    minMoves: 4,
  },
  {
    name: '増幅器入門',
    grid: [
      [srcP(0, 1), makeCell('amp', 0), makeCell('resistor', 0), makeCell('bulb', 0)],
    ],
    solution: [[3,1,1,1]],
    minMoves: 4,
  },
  {
    name: 'L字抵抗',
    grid: [
      [srcP(0, 3), makeCell('resistorL', 0), E()],
      [E(), makeCell('resistorL', 0), makeCell('bulb', 0)],
    ],
    solution: [[3,2,0],[0,0,1]],
    minMoves: 4,
  },
  {
    name: '分岐の壁',
    grid: [
      [srcP(0, 3), E(), E()],
      [makeCell('t', 0), makeCell('resistor', 0), makeCell('bulb', 0)],
      [makeCell('resistor', 0), E(), E()],
      [makeCell('bulb', 0), E(), E()],
    ],
    solution: [[0,0,0],[3,1,1],[0,0,0],[2,0,0]],
    minMoves: 5,
  },
  {
    name: '電力工学',
    grid: [
      [srcP(0, 1), makeCell('amp', 0), makeCell('amp', 0), makeCell('l', 0)],
      [makeCell('bulb', 0), makeCell('resistor', 0), makeCell('resistor', 0), makeCell('l', 0)],
    ],
    solution: [[3,1,1,2],[3,1,1,3]],
    minMoves: 9,
  },
  {
    name: '歯車入門',
    grid: [
      [makeCell('source', 0), makeCell('gear', 0), E()],
      [E(), makeCell('gear', 2), makeCell('bulb', 0)],
    ],
    solution: [[3,2,0],[0,0,1]],
  },
  {
    name: '連鎖の歯車',
    grid: [
      [makeCell('source', 0), makeCell('gear', 0), E()],
      [E(), makeCell('gear', 2), makeCell('gear', 0)],
      [E(), E(), makeCell('bulb', 1)],
    ],
    solution: [[3,2,0],[0,0,2],[0,0,2]],
  },
  {
    name: '歯車四重奏',
    grid: [
      [makeCell('source', 0), makeCell('gear', 0), E(), E()],
      [E(), makeCell('gear', 2), makeCell('gear', 0), E()],
      [E(), E(), makeCell('gear', 2), makeCell('bulb', 0)],
    ],
    solution: [[3,2,0,0],[0,0,2,0],[0,0,0,1]],
  },
  {
    name: 'ヒューズ入門',
    grid: [
      [srcP(0, 3), makeCell('resistorL', 0)],
      [E(), fuse(1, 2)],
      [E(), makeCell('bulb', 0)],
    ],
    solution: [[3,2],[0,0],[0,2]],
  },
  {
    name: 'ヒューズ調整',
    grid: [
      [srcP(2, 3), E(), E()],
      [makeCell('resistor', 1), E(), E()],
      [makeCell('resistorL', 2), fuse(0, 1), makeCell('bulb', 0)],
    ],
    solution: [[0,0,0],[0,0,0],[0,1,1]],
  },
  {
    name: 'テレポーター入門',
    grid: [
      [makeCell('source', 0), portal(0, 'A'), E()],
      [E(), E(), E()],
      [portal(0, 'A'), makeCell('bulb', 0), E()],
    ],
    solution: [[3,1,0],[0,0,0],[3,1,0]],
  },
  {
    name: 'テレポーター迷路',
    grid: [
      [makeCell('source', 2), E(), portal(1, 'A')],
      [makeCell('straight', 1), E(), makeCell('straight', 1)],
      [portal(0, 'A'), E(), makeCell('bulb', 0)],
    ],
    solution: [[0,0,0],[0,0,0],[2,0,2]],
  },

  // ミラーステージ
  {
    name: 'ミラー入門',
    grid: [
      [E(),                   makeCell('bulb', 0),  E()],
      [makeCell('source', 3), mir(1),               E()],
    ],
    solution: [[0,0,0],[3,2,0]],
  },
  {
    name: 'ミラー迷路',
    grid: [
      [E(),                   E(),    makeCell('bulb', 0)],
      [E(),                   mir(0), mir(1)             ],
      [makeCell('source', 3), mir(1), E()                ],
    ],
    solution: [[0,0,0],[0,0,2],[3,2,0]],
  },

  // 分岐スイッチステージ
  {
    name: '分岐SW入門',
    grid: [
      [E(),                   E(),                     makeCell('bulb', 0)],
      [makeCell('source', 3), makeCell('straight', 0), router(1, 0)       ],
      [E(),                   E(),                     E()                ],
    ],
    solution: [[0,0,0],[3,1,1],[0,0,0]],
  },
  {
    name: '二重スイッチ',
    grid: [
      [makeCell('bulb', 0),   E(),                    makeCell('bulb', 0)],
      [router(3, 1),          makeCell('cross', 0),   router(1, 0)       ],
      [E(),                   makeCell('source', 2),  E()                ],
    ],
    solution: [[0,0,0],[0,0,1],[0,2,0]],
  },

  // 論理思考ステージ
  {
    name: '分岐の選択',
    grid: [
      [makeCell('source', 2), makeCell('t', 2),        makeCell('straight', 0), makeCell('bulb', 0)],
      [E(),                   makeCell('straight', 1),  E(),                     E()               ],
      [E(),                   makeCell('straight', 1),  E(),                     E()               ],
      [E(),                   makeCell('bulb', 0),      E(),                     E()               ],
    ],
    solution: [
      [3, 0, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 2, 0, 0],
    ],
  },
  {
    name: '一方通行の壁',
    grid: [
      [makeCell('source', 2), makeCell('t', 2),        makeCell('straight', 0), makeCell('bulb', 0)],
      [E(),                   ow(0),                   E(),                     E()               ],
      [E(),                   makeCell('straight', 1),  E(),                     E()               ],
      [E(),                   makeCell('l', 3),         makeCell('straight', 0), makeCell('bulb', 2)],
    ],
    solution: [
      [3, 0, 1, 1],
      [0, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 1, 1],
    ],
  },
  {
    name: '十字のハブ',
    grid: [
      [E(),                   E(),                     makeCell('bulb', 1),     E()               ],
      [E(),                   E(),                     makeCell('straight', 1), E()               ],
      [makeCell('source', 2), makeCell('straight', 0), makeCell('cross', 0),   makeCell('bulb', 0)],
      [E(),                   E(),                     makeCell('l', 2),        makeCell('bulb', 2)],
    ],
    solution: [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [3, 1, 0, 1],
      [0, 0, 0, 1],
    ],
  },

  // ─── 高難度ステージ (30 stages combining multiple gimmicks) ──────────────────

  // 93
  { name: '鏡の螺旋', grid: [[E(),E(),E(),makeCell('bulb',0)],[E(),mir(1),makeCell('straight',0),mir(1)],[E(),makeCell('straight',1),E(),E()],[makeCell('source',3),mir(1),E(),E()]], solution: [[0,0,0,0],[0,0,1,2],[0,0,0,0],[3,2,0,0]] },
  // 94
  { name: '鏡と一方通行', grid: [[E(),E(),E(),makeCell('bulb',0)],[E(),E(),E(),makeCell('straight',1)],[E(),mir(1),makeCell('straight',0),mir(1)],[E(),ow(2),E(),E()],[makeCell('source',3),mir(1),E(),E()]], solution: [[0,0,0,0],[0,0,0,0],[0,0,1,2],[0,0,0,0],[3,2,0,0]] },
  // 95
  { name: '分岐の選', grid: [[E(),makeCell('bulb',0),E()],[E(),makeCell('t',0),makeCell('l',0)],[E(),router(0,1),mir(1)],[E(),makeCell('source',2),E()]], solution: [[0,0,0],[0,3,2],[0,0,2],[0,2,0]] },
  // 96
  { name: '鏡のテレポート', grid: [[E(),portal(2,'A'),E(),E()],[E(),makeCell('bulb',2),E(),E()],[E(),mir(1),makeCell('straight',0),portal(2,'A')],[makeCell('source',3),mir(1),E(),E()]], solution: [[0,0,0,0],[0,2,0,0],[0,2,1,1],[3,2,0,0]] },
  // 97
  { name: '鏡の四重奏', grid: [[E(),E(),E(),E()],[E(),E(),mir(1),makeCell('bulb',1)],[E(),mir(1),mir(1),E()],[makeCell('source',3),mir(1),E(),E()]], solution: [[0,0,0,0],[0,0,0,1],[0,2,0,0],[3,0,0,0]] },
  // 98
  { name: '双方の鏡', grid: [[E(),E(),E(),E(),E()],[makeCell('bulb',0),E(),E(),E(),makeCell('bulb',0)],[makeCell('straight',1),E(),E(),E(),makeCell('straight',1)],[mir(0),makeCell('straight',0),makeCell('cross',0),makeCell('straight',0),mir(1)],[E(),E(),makeCell('source',2),E(),E()]], solution: [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[1,1,0,1,0],[0,0,2,0,0]] },
  // 99
  { name: 'ヒューズと抵抗', grid: [[srcP(3,5),makeCell('resistor',0),makeCell('resistor',0),fuse(0,3),makeCell('resistor',0),fuse(0,2),makeCell('bulb',1)]], solution: [[3,1,1,1,1,1,1]] },
  // 100
  { name: '増幅器の力', grid: [[E(),E(),E(),makeCell('bulb',0)],[E(),E(),E(),fuse(0,3)],[E(),E(),mir(1),mir(1)],[E(),E(),makeCell('straight',1),E()],[srcP(3,2),makeCell('amp',0),mir(1),E()]], solution: [[0,0,0,0],[0,0,0,0],[0,0,0,2],[0,0,0,0],[3,1,2,0]] },
  // 101
  { name: 'テレポート三段', grid: [[makeCell('source',3),portal(0,'A'),E(),E()],[E(),E(),portal(0,'B'),makeCell('bulb',1)],[portal(0,'A'),portal(0,'B'),E(),E()],[E(),E(),E(),E()]], solution: [[3,1,0,0],[0,0,3,1],[3,1,0,0],[0,0,0,0]] },
  // 102
  { name: 'ルーターの罠', grid: [[makeCell('bulb',0),E(),E(),E(),makeCell('bulb',0)],[makeCell('straight',1),E(),E(),E(),makeCell('straight',1)],[router(3,1),makeCell('straight',0),makeCell('cross',0),makeCell('straight',0),router(1,0)],[E(),E(),makeCell('source',2),E(),E()]], solution: [[0,0,0,0,0],[0,0,0,0,0],[0,1,0,1,1],[0,0,2,0,0]] },
  // 103
  { name: 'ヒューズの試練', grid: [[makeCell('bulb',0),E(),E(),E(),makeCell('bulb',0)],[fuse(0,2),E(),E(),E(),fuse(0,3)],[makeCell('resistor',0),E(),E(),E(),makeCell('straight',0)],[makeCell('l',3),makeCell('straight',0),makeCell('cross',0),makeCell('straight',0),makeCell('l',2)],[E(),E(),srcP(2,3),E(),E()]], solution: [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,1,0,1,3],[0,0,2,0,0]] },
  // 104
  { name: '螺旋のミラー', grid: [[E(),E(),E(),E(),E(),makeCell('bulb',1)],[E(),E(),E(),mir(1),makeCell('straight',0),mir(1)],[E(),mir(1),makeCell('straight',0),mir(1),E(),E()],[E(),makeCell('straight',0),E(),E(),E(),E()],[makeCell('source',3),mir(1),E(),E(),E(),E()]], solution: [[0,0,0,0,0,0],[0,0,0,0,1,2],[0,2,1,0,0,0],[0,0,0,0,0,0],[3,2,0,0,0,0]] },
  // 105
  { name: 'テレポート螺旋', grid: [[makeCell('source',3),portal(0,'A'),E(),E()],[E(),E(),portal(0,'B'),makeCell('bulb',1)],[portal(0,'A'),makeCell('straight',0),portal(0,'B'),E()],[E(),E(),E(),E()]], solution: [[3,1,0,0],[0,0,3,1],[3,1,1,0],[0,0,0,0]] },
  // 106
  { name: '歯車と鏡', grid: [[makeCell('bulb',0),E(),E(),E()],[mir(0),makeCell('l',0),E(),E()],[E(),makeCell('gear',2),makeCell('straight',0),makeCell('gear',0)],[E(),E(),E(),makeCell('source',2)]], solution: [[0,0,0,0],[1,2,0,0],[0,0,1,2],[0,0,0,2]] },
  // 107
  { name: '二重テレポート', grid: [[makeCell('source',3),portal(0,'A'),E(),portal(0,'B'),makeCell('bulb',1)],[E(),E(),E(),E(),E()],[portal(0,'B'),makeCell('straight',0),makeCell('straight',0),makeCell('straight',0),portal(0,'A')]], solution: [[3,1,0,3,1],[0,0,0,0,0],[3,1,1,1,1]] },
  // 108
  { name: '一方通行の迷路', grid: [[E(),E(),E(),makeCell('bulb',0)],[E(),E(),E(),ow(1)],[E(),E(),E(),ow(1)],[makeCell('source',3),ow(0),ow(0),mir(1)]], solution: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,1,1,2]] },
  // 109
  { name: '増幅と鏡', grid: [[E(),E(),E(),makeCell('bulb',0)],[E(),E(),E(),fuse(1,3)],[E(),E(),mir(1),mir(1)],[E(),E(),makeCell('straight',1),E()],[srcP(3,1),makeCell('amp',0),mir(1),E()]], solution: [[0,0,0,0],[0,0,0,0],[0,0,0,2],[0,0,0,0],[3,1,2,0]] },
  // 110
  { name: 'ルーター連鎖', grid: [[E(),E(),mir(1),makeCell('bulb',1)],[E(),router(0,1),router(1,0),E()],[E(),makeCell('source',2),E(),E()]], solution: [[0,0,0,1],[0,0,1,0],[0,2,0,0]] },
  // 111
  { name: '抵抗とヒューズ', grid: [[srcP(3,5),makeCell('resistor',0),makeCell('resistor',0),makeCell('resistor',0),fuse(0,2),makeCell('bulb',1)]], solution: [[3,1,1,1,1,1]] },
  // 112
  { name: '大鏡迷路', grid: [[E(),E(),E(),E(),makeCell('bulb',0)],[E(),E(),E(),E(),ow(2)],[E(),E(),E(),mir(1),makeCell('l',0)],[E(),mir(1),makeCell('straight',0),mir(1),E()],[makeCell('source',3),mir(1),E(),E(),E()]], solution: [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,3],[0,0,1,2,0],[3,2,0,0,0]] },
  // 113
  { name: 'ミラーとルーター', grid: [[E(),makeCell('bulb',0),E(),makeCell('bulb',0),E()],[mir(1),makeCell('l',0),E(),makeCell('l',0),makeCell('l',0)],[router(3,1),makeCell('straight',0),makeCell('cross',0),makeCell('straight',0),router(1,0)],[E(),E(),makeCell('source',2),E(),E()]], solution: [[0,0,0,0,0],[0,3,0,0,2],[0,1,0,1,1],[0,0,2,0,0]] },
  // 114
  { name: '鏡とテレポートと一方通行', grid: [[E(),E(),E(),makeCell('bulb',0)],[E(),E(),E(),ow(2)],[E(),portal(0,'A'),E(),portal(0,'A')],[E(),makeCell('straight',1),E(),E()],[makeCell('source',3),mir(1),E(),E()]], solution: [[0,0,0,0],[0,0,0,0],[0,0,0,2],[0,0,0,0],[3,2,0,0]] },
  // 115
  { name: 'ヒューズとミラー', grid: [[E(),E(),E(),makeCell('bulb',0),E()],[E(),E(),E(),fuse(1,2),E()],[E(),E(),mir(1),mir(1),E()],[E(),E(),makeCell('resistor',1),E(),E()],[srcP(3,3),makeCell('straight',0),mir(1),E(),E()]], solution: [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,2,0],[0,0,0,0,0],[3,1,2,0,0]] },
  // 116
  { name: '鏡と分岐とテレポート', grid: [[E(),makeCell('bulb',0),E(),E()],[router(0,1),makeCell('l',0),E(),E()],[portal(0,'A'),E(),portal(0,'A'),E()],[makeCell('source',3),makeCell('straight',0),mir(1),E()]], solution: [[0,0,0,0],[0,3,0,0],[2,0,0,0],[3,1,2,0]] },
  // 117
  { name: 'ヒューズ二段', grid: [[srcP(3,4),makeCell('resistor',0),fuse(0,3),makeCell('resistor',0),fuse(0,2),makeCell('bulb',1)]], solution: [[3,1,1,1,1,1]] },
  // 118
  { name: '鏡の十字路', grid: [[E(),E(),makeCell('bulb',0),E(),E()],[E(),makeCell('bulb',0),makeCell('straight',0),makeCell('bulb',0),E()],[E(),mir(0),makeCell('cross',0),mir(0),E()],[E(),makeCell('straight',1),makeCell('straight',1),makeCell('straight',1),E()],[E(),E(),makeCell('source',2),E(),E()]], solution: [[0,0,0,0,0],[0,0,0,0,0],[0,1,0,0,0],[0,0,0,0,0],[0,0,2,0,0]] },
  // 119
  { name: '電力配分', grid: [[makeCell('bulb',0),E(),makeCell('bulb',0),E(),makeCell('bulb',0)],[fuse(1,1),E(),fuse(1,2),E(),fuse(1,3)],[makeCell('resistor',1),E(),makeCell('resistor',1),E(),makeCell('straight',1)],[makeCell('resistor',1),E(),makeCell('straight',1),E(),makeCell('straight',1)],[makeCell('l',2),makeCell('straight',0),makeCell('cross',0),makeCell('straight',0),makeCell('l',0)],[E(),E(),srcP(0,3),E(),E()]], solution: [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,1,0,1,3],[0,0,2,0,0]] },
  // 120
  { name: 'ルーター三重連', grid: [[makeCell('bulb',0),E(),makeCell('bulb',0),E(),makeCell('bulb',0)],[makeCell('straight',1),E(),makeCell('straight',1),E(),makeCell('straight',1)],[router(3,1),makeCell('straight',0),makeCell('cross',0),makeCell('straight',0),router(1,0)],[E(),E(),makeCell('straight',1),E(),E()],[E(),E(),makeCell('source',2),E(),E()]], solution: [[0,0,0,0,0],[0,0,0,0,0],[0,1,0,1,1],[0,0,0,0,0],[0,0,2,0,0]] },
  // 121
  { name: '鏡とテレポートの迷宮', grid: [[E(),E(),E(),E(),E(),makeCell('bulb',0)],[E(),E(),E(),E(),portal(0,'A'),makeCell('l',0)],[E(),E(),E(),E(),E(),E()],[E(),E(),E(),portal(2,'A'),E(),E()],[E(),mir(1),makeCell('straight',1),mir(1),E(),E()],[makeCell('source',3),mir(1),E(),E(),E(),E()]], solution: [[0,0,0,0,0,0],[0,0,0,0,3,3],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,1,2,0,0],[3,2,0,0,0,0]] },
  // 122
  { name: '鏡の大迷宮', grid: [[E(),E(),E(),E(),E(),makeCell('bulb',0)],[E(),E(),E(),mir(1),makeCell('straight',0),mir(1)],[E(),E(),E(),makeCell('straight',1),E(),E()],[E(),mir(1),makeCell('straight',0),mir(1),E(),E()],[E(),makeCell('straight',1),E(),E(),E(),E()],[makeCell('source',3),mir(1),E(),E(),E(),E()]], solution: [[0,0,0,0,0,0],[0,0,0,0,1,2],[0,0,0,0,0,0],[0,0,1,2,0,0],[0,0,0,0,0,0],[3,2,0,0,0,0]] },

  // ── 論理パズル ────────────────────────────────────────
  // 123
  { name: 'ジレンマ', grid: [[E(),E(),makeCell('bulb',0),E(),E()],[E(),E(),igt('A',1),E(),E()],[E(),makeCell('l',0),makeCell('t',0),makeCell('l',0),sw('A')],[E(),E(),makeCell('straight',1),E(),E()],[E(),E(),makeCell('source',2),E(),E()]], solution: [[0,0,0,0,0],[0,0,0,0,0],[0,0,1,0,0],[0,0,0,0,0],[0,0,2,0,0]] },
  // 124
  { name: '順序の鍵', grid: [[E(),E(),makeCell('bulb',0),E(),E()],[E(),E(),gt('B',1),E(),E()],[sw('B'),makeCell('straight',0),makeCell('t',0),E(),E()],[E(),E(),gt('A',1),E(),E()],[E(),E(),makeCell('t',0),makeCell('straight',0),sw('A')],[E(),E(),makeCell('source',2),E(),E()]], solution: [[0,0,0,0,0],[0,0,0,0,0],[0,1,1,0,0],[0,0,0,0,0],[0,0,3,1,0],[0,0,2,0,0]] },
  // 125
  { name: '混迷の門', grid: [[E(),makeCell('bulb',0),E()],[E(),makeCell('straight',1),E()],[E(),igt('B',1),E()],[E(),gt('A',1),E()],[sw('A'),makeCell('t',0),sw('B')],[E(),makeCell('source',2),E()]], solution: [[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,1,0],[0,2,0]] },
  // 126
  { name: '賢者の試練', grid: [[E(),E(),makeCell('bulb',0),E(),E()],[E(),E(),gt('A',1),E(),E()],[E(),E(),igt('B',1),E(),E()],[E(),makeCell('l',0),makeCell('straight',1),makeCell('l',0),E()],[sw('A'),makeCell('straight',0),makeCell('t',0),makeCell('straight',0),sw('B')],[E(),E(),makeCell('source',2),E(),E()]], solution: [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,1,0,0,0],[0,1,1,0,0],[0,0,2,0,0]] },

  // ── 色彩パズル ────────────────────────────────────────
  // 127
  { name: '二色の交差', grid: [[E(),E(),srcC(0,'cyan'),E(),E()],[E(),E(),makeCell('straight',1),E(),E()],[srcC(3,'red'),makeCell('straight',0),makeCell('bridge',0),makeCell('straight',0),bulbC(1,'red')],[E(),E(),makeCell('straight',1),E(),E()],[E(),E(),bulbC(2,'cyan'),E(),E()]], solution: [[0,0,0,0,0],[0,0,0,0,0],[3,1,0,1,1],[0,0,0,0,0],[0,0,2,0,0]] },
  // 128
  { name: '二色の対角', grid: [[srcC(0,'cyan'),E(),E(),E(),srcC(0,'red')],[makeCell('straight',1),E(),E(),E(),makeCell('straight',1)],[makeCell('cross',0),makeCell('straight',0),makeCell('bridge',0),makeCell('straight',0),makeCell('cross',0)],[makeCell('straight',1),E(),E(),E(),makeCell('straight',1)],[bulbC(2,'red'),E(),E(),E(),bulbC(2,'cyan')]], solution: [[0,0,0,0,0],[0,0,0,0,0],[0,1,0,1,0],[0,0,0,0,0],[2,0,0,0,2]] },
  // 129
  { name: '三色平行', grid: [[srcC(0,'cyan'),E(),srcC(0,'red'),E(),srcC(0,'yellow')],[makeCell('straight',1),E(),makeCell('straight',1),E(),makeCell('straight',1)],[makeCell('bridge',0),makeCell('straight',1),makeCell('bridge',0),makeCell('straight',1),makeCell('bridge',0)],[makeCell('straight',1),E(),makeCell('straight',1),E(),makeCell('straight',1)],[bulbC(2,'cyan'),E(),bulbC(2,'red'),E(),bulbC(2,'yellow')]], solution: [[0,0,0,0,0],[0,0,0,0,0],[0,1,0,1,0],[0,0,0,0,0],[2,0,2,0,2]] },
  // 130
  { name: '色の編み込み', grid: [[srcC(0,'cyan'),E(),E(),E(),srcC(0,'red')],[makeCell('straight',1),E(),makeCell('bridge',0),E(),makeCell('straight',1)],[makeCell('cross',0),makeCell('straight',0),makeCell('straight',0),makeCell('straight',0),makeCell('cross',0)],[makeCell('straight',1),E(),makeCell('bridge',0),E(),makeCell('straight',1)],[bulbC(2,'red'),E(),E(),E(),bulbC(2,'cyan')]], solution: [[0,0,0,0,0],[0,0,0,0,0],[0,1,1,1,0],[0,0,0,0,0],[2,0,0,0,2]] },

  // ── 新ギミックII ──────────────────────────────────────────
  // 131
  { name: '分配器入門',
    grid: [
      [E(),                  makeCell('source', 0), E()                  ],
      [makeCell('bulb', 0),  split(0),              makeCell('bulb', 0)  ],
      [E(),                  E(),                   E()                  ],
    ],
    solution: [[0,0,0],[3,0,1],[0,0,0]] },
  // 132
  { name: 'ANDゲート入門',
    grid: [
      [E(),       E(),                  makeCell('bulb', 0),  E(),                  E()       ],
      [E(),       E(),                  andgt('A','B',1),     E(),                  E()       ],
      [sw('A'),   makeCell('straight',0), makeCell('cross',0), makeCell('straight',0), sw('B')],
      [E(),       E(),                  makeCell('source',0), E(),                  E()       ],
    ],
    solution: [[0,0,0,0,0],[0,0,0,0,0],[0,1,0,1,0],[0,0,2,0,0]] },
  // 133
  { name: '罠を避けて',
    grid: [
      [makeCell('source', 0), makeCell('straight', 0), makeCell('l', 0)       ],
      [E(),                    trap(),                   makeCell('straight', 0)],
      [E(),                    E(),                      makeCell('bulb', 0)    ],
    ],
    solution: [[3,1,2],[0,0,0],[0,0,2]] },

  // ── パーツ庫（配置モード） ──────────────────────────────
  // 134
  { name: 'パーツ庫入門',
    partsBin: true,
    grid: [
      [makeCell('source', 0, true), E(),                       E()                      ],
      [E(),                          E(),                       makeCell('bulb', 1, true)],
      [E(),                          E(),                       E()                      ],
    ],
    inventory: { l: 1, straight: 1 },
    solutionTypes: [
      [null, null,       null],
      ['l',  'straight', null],
      [null, null,       null],
    ],
    solution: [[0,0,0],[0,1,1],[0,0,0]] },
  // 135
  { name: '配置の妙',
    partsBin: true,
    grid: [
      [makeCell('source', 0, true), E(), E(),                         E()],
      [E(),                          E(), E(),                         E()],
      [E(),                          E(), E(),                         E()],
      [E(),                          E(), makeCell('bulb', 2, true),   E()],
    ],
    inventory: { l: 2, straight: 2 },
    solutionTypes: [
      [null, null,       null,       null],
      ['l',  'straight', 'l',        null],
      [null, null,       'straight', null],
      [null, null,       null,       null],
    ],
    solution: [[0,0,0,0],[0,1,2,0],[0,0,0,0],[0,0,2,0]] },
  // 136
  { name: '二又の配線',
    partsBin: true,
    grid: [
      [makeCell('source', 3, true), E(), E(),                       E(),  E()                      ],
      [E(),                          E(), E(),                       E(),  E()                      ],
      [E(),                          E(), E(),                       E(),  makeCell('bulb', 2, true)],
      [E(),                          E(), makeCell('bulb', 2, true), E(),  E()                      ],
    ],
    inventory: { straight: 3, l: 2, t: 1 },
    solutionTypes: [
      [null, 'straight', 'l',        null,       null],
      [null, null,       't',        'straight', 'l'  ],
      [null, null,       'straight', null,       null ],
      [null, null,       null,       null,       null ],
    ],
    solution: [
      [3, 1, 2, 0, 0],
      [0, 0, 3, 1, 2],
      [0, 0, 0, 0, 2],
      [0, 0, 2, 0, 0],
    ] },
  // 137
  { name: '大配線盤',
    partsBin: true,
    grid: [
      [makeCell('source', 3, true), E(), E(), E(), E(), E()],
      [E(),                          E(), E(), E(), E(), E()],
      [E(),                          E(), E(), E(), E(), E()],
      [E(),                          E(), E(), E(), E(), E()],
      [E(),                          makeCell('bulb', 2, true), E(), makeCell('bulb', 2, true), E(), E()],
    ],
    inventory: { straight: 7, l: 3, t: 1 },
    solutionTypes: [
      [null, 'straight', 'straight', 'straight', 'l',        null],
      [null, null,       null,       null,       'straight', null],
      [null, 'l',        'straight', 't',        'l',        null],
      [null, 'straight', null,       'straight', null,       null],
      [null, null,       null,       null,       null,       null],
    ],
    solution: [
      [3, 1, 1, 1, 2, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 1, 1, 0, 3, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 2, 0, 2, 0, 0],
    ] },
  // 138
  { name: 'トラップ分岐',
    partsBin: true,
    grid: [
      [E(), E(), makeCell('source', 0, true), E(), E()],
      [E(), E(), E(),                          E(), E()],
      [E(), E(), E(),                          E(), E()],
      [E(), E(), trap(),                       E(), E()],
      [makeCell('bulb', 2, true), E(), E(), E(), makeCell('bulb', 2, true)],
    ],
    inventory: { straight: 6, l: 2, t: 1, cross: 1 },
    solutionTypes: [
      [null,       null,       null,       null,       null      ],
      [null,       null,       'straight', null,       null      ],
      ['l',        'straight', 't',        'straight', 'l'       ],
      ['straight', null,       null,       null,       'straight'],
      [null,       null,       null,       null,       null      ],
    ],
    solution: [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [1, 1, 2, 1, 2],
      [0, 0, 0, 0, 0],
      [2, 0, 0, 0, 2],
    ] },
  // 139
  { name: '立体交差',
    partsBin: true,
    grid: [
      [E(),                          E(), makeCell('bulb', 0, true), E(), E()],
      [makeCell('source', 3, true), E(), E(),                        E(), E()],
      [E(),                          E(), E(),                        E(), E()],
      [E(),                          E(), E(),                        E(), E()],
      [E(),                          E(), E(),                        E(), E()],
    ],
    inventory: { straight: 2, l: 5, bridge: 1, oneway: 1 },
    solutionTypes: [
      [null, null,       null,     null, null],
      [null, 'straight', 'bridge', 'l',  null],
      [null, 'l',        'l',      'straight', null],
      [null, 'l',        'oneway', 'l',  null],
      [null, null,       null,     null, null],
    ],
    solution: [
      [0, 0, 0, 0, 0],
      [3, 1, 0, 2, 0],
      [0, 1, 3, 0, 0],
      [0, 0, 3, 3, 0],
      [0, 0, 0, 0, 0],
    ] },
];

let allPassed = true;

for (let si = 0; si < STAGES.length; si++) {
  const stage = STAGES[si];
  const rows = stage.grid.length;
  const cols = stage.grid[0].length;

  // Apply solution rotations (parts-bin stages also place inventory pieces into the slots)
  const solvedGrid = stage.grid.map((row, r) =>
    row.map((cell, c) => {
      if (stage.partsBin && cell.type === 'empty' && stage.solutionTypes && stage.solutionTypes[r] && stage.solutionTypes[r][c]) {
        return makeCell(stage.solutionTypes[r][c], stage.solution[r][c]);
      }
      if (cell.type === 'router') return { ...cell, state: stage.solution[r][c] };
      return { ...cell, rotation: stage.solution[r][c] };
    })
  );

  const powered = computePowered(solvedGrid);
  const solved = isSolved(solvedGrid, powered);

  // Also check initial state is NOT already solved
  const initPowered = computePowered(stage.grid);
  const alreadySolved = isSolved(stage.grid, initPowered);

  // Parts-bin: the bin must hold exactly the pieces the solution places (no more, no less)
  let binStatus = '';
  if (stage.partsBin) {
    const need = {};
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (stage.solutionTypes && stage.solutionTypes[r] && stage.solutionTypes[r][c]) {
          const t = stage.solutionTypes[r][c];
          need[t] = (need[t] || 0) + 1;
        }
    const inv = stage.inventory || {};
    const types = new Set([...Object.keys(need), ...Object.keys(inv)]);
    let decoys = 0;
    for (const t of types) {
      const have = inv[t] || 0, want = need[t] || 0;
      if (have < want) {
        binStatus = ` ❌ 在庫不足: ${t} ${have}<${want} (need=${JSON.stringify(need)} inv=${JSON.stringify(inv)})`;
        allPassed = false;
        break;
      }
      decoys += (have - want); // surplus pieces are intentional decoys
    }
    if (!binStatus && decoys > 0) binStatus = ` 🎭 おとり×${decoys}`;
  }

  // Find bulb position and check it
  let bulbPos = null;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (solvedGrid[r][c].type === 'bulb') bulbPos = [r, c];

  const status = solved ? '✅ PASS' : '❌ FAIL';
  const initStatus = alreadySolved ? ' ⚠️  初期状態が既に解けている!' : '';
  console.log(`[${si+1}] ${stage.name} ${status}${initStatus}${binStatus}`);

  if (!solved) {
    allPassed = false;
    // Debug: show powered state
    console.log('  Powered grid:');
    for (let r = 0; r < rows; r++) {
      const row = solvedGrid[r].map((cell, c) => {
        const p = powered.powered[r][c] ? '●' : '○';
        return `${p}${cell.type[0]}${cell.rotation}`;
      }).join(' ');
      console.log(`    ${row}`);
    }
    // Show connections at each powered cell
    console.log('  Connection debug:');
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = solvedGrid[r][c];
        const conns = getConnections(cell.type, cell.rotation);
        if (conns.length > 0) {
          const dirs = conns.map(d => ['N','E','S','W'][d]).join(',');
          console.log(`    [${r},${c}] ${cell.type}(rot=${cell.rotation}) → ${dirs} | powered=${powered.powered[r][c]}`);
        }
      }
    }
  }
}

console.log('');
console.log(allPassed ? '🎉 全ステージ クリア可能！' : '⚠️  修正が必要なステージがあります');
if (!allPassed) process.exit(1);
