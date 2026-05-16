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
    case 'resistor': return r % 2 === 0 ? [0,2] : [1,3];
    case 'amp':      return r % 2 === 0 ? [0,2] : [1,3];
    case 'resistorL':return [[0,1],[1,2],[2,3],[3,0]][r];
    case 'ampL':     return [[0,1],[1,2],[2,3],[3,0]][r];
    case 'gear':     return [[0,1],[1,2],[2,3],[3,0]][r];
    case 'fuse':     return r % 2 === 0 ? [0,2] : [1,3];
    case 'igate':    return r % 2 === 0 ? [0,2] : [1,3];
    case 'portal':   return [[2],[3],[0],[1]][r];
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
  const powered = grid.map(row => row.map(() => 0));
  const MAX_POWER = 9;
  const pq = [];
  const stateMax = new Map();
  const portals = {};
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (grid[r][c].type === 'portal') {
        const id = grid[r][c].linkId;
        (portals[id] = portals[id] || []).push({ r, c });
      }
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (grid[r][c].type === 'source') {
        const ip = grid[r][c].initialPower || 9;
        powered[r][c] = Math.max(powered[r][c], ip);
        pq.push([ip, r, c, -1]);
        stateMax.set(`${r},${c},-1`, ip);
      }
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
        if (outPower > powered[pair.r][pair.c]) powered[pair.r][pair.c] = outPower;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          const ncell = grid[nr][nc];
          const nconns = getConnections(ncell.type, ncell.rotation);
          if (nconns.includes(OPPOSITE[outDir]) &&
              !(ncell.type === 'oneway' && OPPOSITE[outDir] !== OPPOSITE[ncell.rotation]) &&
              ncell.type !== 'source' &&
              !(ncell.type === 'fuse' && outPower > (ncell.limit || 2))) {
            const nKey = `${nr},${nc},${OPPOSITE[outDir]}`;
            if (outPower > (stateMax.get(nKey) || 0)) {
              stateMax.set(nKey, outPower);
              if (outPower > powered[nr][nc]) powered[nr][nc] = outPower;
              pq.push([outPower, nr, nc, OPPOSITE[outDir]]);
            }
          }
        }
      }
      continue;
    }
    const allConns = getConnections(cell.type, cell.rotation);
    const exitConns = (cell.type === 'oneway')
      ? ((entryDir === OPPOSITE[cell.rotation] || entryDir === -1) ? [cell.rotation] : [])
      : (cell.type === 'bridge' && entryDir !== -1)
        ? [OPPOSITE[entryDir]]
        : allConns;
    for (const dir of exitConns) {
      const nr = r + DIR_DELTA[dir][0];
      const nc = c + DIR_DELTA[dir][1];
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const ncell = grid[nr][nc];
      const nconns = getConnections(ncell.type, ncell.rotation);
      if (!nconns.includes(OPPOSITE[dir])) continue;
      if (ncell.type === 'oneway' && OPPOSITE[dir] !== OPPOSITE[ncell.rotation]) continue;
      if (ncell.type === 'source') continue;
      if (ncell.type === 'fuse' && outPower > (ncell.limit || 2)) continue;
      const nKey = `${nr},${nc},${OPPOSITE[dir]}`;
      const prev = stateMax.get(nKey) || 0;
      if (outPower > prev) {
        stateMax.set(nKey, outPower);
        if (outPower > powered[nr][nc]) powered[nr][nc] = outPower;
        pq.push([outPower, nr, nc, OPPOSITE[dir]]);
      }
    }
  }
  return powered;
}

function isSolved(grid, powered) {
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid[0].length; c++)
      if (grid[r][c].type === 'bulb' && !powered[r][c]) return false;
  return true;
}

function makeCell(type, rotation, locked = false, opts) { return Object.assign({ type, rotation, locked }, opts || {}); }
const E = () => makeCell('empty', 0);
const ow = (rot) => makeCell('oneway', rot);
const srcP = (rot, power) => makeCell('source', rot, false, { initialPower: power });
const fuse = (rot, limit) => makeCell('fuse', rot, false, { limit });
const portal = (rot, id) => makeCell('portal', rot, false, { linkId: id });

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
];

let allPassed = true;

for (let si = 0; si < STAGES.length; si++) {
  const stage = STAGES[si];
  const rows = stage.grid.length;
  const cols = stage.grid[0].length;

  // Apply solution rotations
  const solvedGrid = stage.grid.map((row, r) =>
    row.map((cell, c) => ({ ...cell, rotation: stage.solution[r][c] }))
  );

  const powered = computePowered(solvedGrid);
  const solved = isSolved(solvedGrid, powered);

  // Also check initial state is NOT already solved
  const initPowered = computePowered(stage.grid);
  const alreadySolved = isSolved(stage.grid, initPowered);

  // Find bulb position and check it
  let bulbPos = null;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (solvedGrid[r][c].type === 'bulb') bulbPos = [r, c];

  const status = solved ? '✅ PASS' : '❌ FAIL';
  const initStatus = alreadySolved ? ' ⚠️  初期状態が既に解けている!' : '';
  console.log(`[${si+1}] ${stage.name} ${status}${initStatus}`);

  if (!solved) {
    allPassed = false;
    // Debug: show powered state
    console.log('  Powered grid:');
    for (let r = 0; r < rows; r++) {
      const row = solvedGrid[r].map((cell, c) => {
        const p = powered[r][c] ? '●' : '○';
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
          console.log(`    [${r},${c}] ${cell.type}(rot=${cell.rotation}) → ${dirs} | powered=${powered[r][c]}`);
        }
      }
    }
  }
}

console.log('');
console.log(allPassed ? '🎉 全ステージ クリア可能！' : '⚠️  修正が必要なステージがあります');
if (!allPassed) process.exit(1);
