/* ===== Alimentação: metas, distribuição nas refeições e cardápio recomendado =====
   Recomendação geral com base em metas de calorias e macros (não é prescrição dietética individual).
   Referências de método: wger (plano = refeições → alimentos com quantidade, somatório por refeição e no total),
   meal_composer (quantidades a partir de metas de macros, com limites), Fitness-Tools (metas divididas entre refeições).
   Valores dos alimentos: js/taco.js (TACO 4ª ed., NEPA-UNICAMP). Funções puras: funcionam no app e no Node (testes). */

const DIETA_V = 1;

/* ---------- alimentos usados no cardápio (id TACO + medida caseira aproximada) ----------
   g  = grupo para substituições: C (carboidrato), P (proteína), G (gordura), F (fruta), L (leguminosa), V (vegetais)
   un = [nome da medida, gramas]  ·  passo = arredondamento em gramas (ou 'un' para unidades inteiras)
   tags = restrições: lactose, gluten, ovo, peixe, carne, frango */
const ALIM = {
  arroz:      { t: 3,   n: 'Arroz branco cozido',          g: 'C', un: ['colher de sopa cheia', 25], passo: 25, min: 50,  max: 300 },
  arroz_int:  { t: 1,   n: 'Arroz integral cozido',        g: 'C', un: ['colher de sopa cheia', 25], passo: 25, min: 50,  max: 300 },
  cuscuz:     { t: 533, n: 'Cuscuz de milho',              g: 'C', un: ['fatia média', 100],          passo: 20, min: 60,  max: 300 },
  macaxeira:  { t: 129, n: 'Macaxeira cozida',             g: 'C', un: ['pedaço médio', 100],         passo: 20, min: 60,  max: 300 },
  batata_doce:{ t: 88,  n: 'Batata-doce cozida',           g: 'C', un: ['unidade média', 150],        passo: 25, min: 75,  max: 350 },
  inhame:     { t: 102, n: 'Cará/inhame cozido',           g: 'C', un: ['pedaço médio', 100],         passo: 20, min: 60,  max: 300 },
  pao:        { t: 53,  n: 'Pão francês',                  g: 'C', un: ['unidade', 50],               passo: 'un', min: 1, max: 3, tags: ['gluten'] },
  pao_int:    { t: 52,  n: 'Pão de forma integral',        g: 'C', un: ['fatia', 25],                 passo: 'un', min: 1, max: 4, tags: ['gluten'] },
  goma:       { t: 124, n: 'Goma de tapioca',              g: 'C', un: ['colher de sopa', 20],        passo: 10, min: 30,  max: 120 },
  aveia:      { t: 7,   n: 'Aveia em flocos',              g: 'C', un: ['colher de sopa', 15],        passo: 5,  min: 0,   max: 60, tags: ['gluten'] },
  frango:     { t: 410, n: 'Peito de frango grelhado',     g: 'P', un: ['filé médio', 100],           passo: 10, min: 60,  max: 250, tags: ['frango'] },
  frango_desf:{ t: 408, n: 'Frango desfiado (peito cozido)', g: 'P', un: ['colher de sopa cheia', 25], passo: 10, min: 30, max: 200, tags: ['frango'] },
  patinho:    { t: 377, n: 'Patinho grelhado',             g: 'P', un: ['bife médio', 100],           passo: 10, min: 60,  max: 220, tags: ['carne'] },
  carne_moida:{ t: 326, n: 'Carne moída (acém) cozida',    g: 'P', un: ['colher de sopa cheia', 25],  passo: 10, min: 60,  max: 200, tags: ['carne'] },
  peixe:      { t: 301, n: 'Peixe branco assado (merluza)', g: 'P', un: ['filé médio', 120],          passo: 10, min: 80,  max: 260, tags: ['peixe'] },
  atum:       { t: 277, n: 'Atum em conserva (escorrido)', g: 'P', un: ['lata pequena', 120],         passo: 10, min: 40,  max: 140, tags: ['peixe'] },
  ovo:        { t: 488, n: 'Ovo cozido ou mexido',         g: 'P', un: ['unidade', 50],               passo: 'un', min: 1, max: 4, tags: ['ovo'] },
  clara:      { t: 486, n: 'Clara de ovo',                 g: 'P', un: ['unidade', 33],               passo: 'un', min: 1, max: 6, tags: ['ovo'] },
  leite_po:   { t: 456, n: 'Leite em pó desnatado',        g: 'P', un: ['colher de sopa', 10],        passo: 5,  min: 10,  max: 50, tags: ['lactose'] },
  iogurte:    { t: 449, n: 'Iogurte natural desnatado',    g: 'P', un: ['pote', 170],                 passo: 'un', min: 1, max: 2, tags: ['lactose'] },
  queijo:     { t: 461, n: 'Queijo minas frescal',         g: 'G', un: ['fatia', 30],                 passo: 'un', min: 1, max: 3, tags: ['lactose'] },
  requeijao:  { t: 468, n: 'Requeijão cremoso',            g: 'G', un: ['colher de sopa', 15],        passo: 5,  min: 10,  max: 45, tags: ['lactose'] },
  azeite:     { t: 260, n: 'Azeite de oliva',              g: 'G', un: ['colher de sopa', 8],         passo: 2,  min: 0,   max: 16 },
  manteiga:   { t: 261, n: 'Manteiga',                     g: 'G', un: ['colher de chá', 5],          passo: 'un', min: 0, max: 3, tags: ['lactose'] },
  castanha:   { t: 589, n: 'Castanha-do-pará',             g: 'G', un: ['unidade', 4],                passo: 'un', min: 1, max: 8 },
  caju:       { t: 588, n: 'Castanha-de-caju',             g: 'G', un: ['unidade', 2.5],              passo: 'un', min: 2, max: 16 },
  amendoim:   { t: 558, n: 'Amendoim torrado',             g: 'G', un: ['colher de sopa', 15],        passo: 5,  min: 5,   max: 40 },
  abacate:    { t: 163, n: 'Abacate',                      g: 'G', un: ['colher de sopa', 30],        passo: 15, min: 30,  max: 150 },
  feijao:     { t: 561, n: 'Feijão carioca',               g: 'L', un: ['concha média', 100],         passo: 20, min: 60,  max: 160 },
  feijao_preto:{ t: 567, n: 'Feijão preto',                g: 'L', un: ['concha média', 100],         passo: 20, min: 60,  max: 160 },
  lentilha:   { t: 577, n: 'Lentilha cozida',              g: 'L', un: ['concha média', 100],         passo: 20, min: 60,  max: 160 },
  banana:     { t: 182, n: 'Banana-prata',                 g: 'F', un: ['unidade', 70],               passo: 'un', min: 1, max: 2 },
  mamao:      { t: 225, n: 'Mamão',                        g: 'F', un: ['fatia média', 150],          passo: 'un', min: 1, max: 2 },
  maca:       { t: 222, n: 'Maçã',                         g: 'F', un: ['unidade', 130],              passo: 'un', min: 1, max: 2 },
  laranja:    { t: 208, n: 'Laranja',                      g: 'F', un: ['unidade', 150],              passo: 'un', min: 1, max: 2 },
  melancia:   { t: 235, n: 'Melancia',                     g: 'F', un: ['fatia média', 200],          passo: 'un', min: 1, max: 2 },
  salada:     { t: 78,  n: 'Salada de folhas e tomate',    g: 'V', un: ['prato de sobremesa', 100],   fixo: true, livre: true },
  legumes:    { t: 72,  n: 'Legumes refogados (abobrinha)', g: 'V', un: ['colher de servir', 100],    fixo: true, livre: true },
  brocolis:   { t: 100, n: 'Brócolis cozido',              g: 'V', un: ['ramos', 100],                fixo: true, livre: true },
  cenoura:    { t: 109, n: 'Cenoura e chuchu cozidos',     g: 'V', un: ['colher de servir', 100],     fixo: true, livre: true },
  cafe:       { t: 471, n: 'Café sem açúcar',              g: 'V', un: ['xícara', 100],               fixo: true }
};

/* ---------- refeições (o Tel pode mudar horários e percentuais) ---------- */
const DIETA_REFEICOES = [
  { k: 'cafe',    n: 'Café da manhã',   h: '07:00', pct: 20, opc: 3 },
  { k: 'lanche1', n: 'Lanche da manhã', h: '10:00', pct: 10, opc: 1 },
  { k: 'almoco',  n: 'Almoço',          h: '12:30', pct: 30, opc: 3 },
  { k: 'lanche2', n: 'Lanche da tarde', h: '16:00', pct: 10, opc: 1 },
  { k: 'jantar',  n: 'Jantar',          h: '19:30', pct: 20, opc: 3 },
  { k: 'ceia',    n: 'Ceia',            h: '22:00', pct: 10, opc: 1 }
];

/* ---------- modelos de cardápio por refeição ----------
   Cada item: [alimento, papel]. Papel 'C'/'P'/'G' = quantidade calculada para bater a meta;
   'fixo' = porção fixa (fruta, leguminosa, vegetais). Ordem = preferência (os primeiros entram primeiro). */
const DIETA_MODELOS = {
  cafe: [
    { n: 'Cuscuz com ovos',              i: [['cuscuz', 'C'], ['ovo', 'P'], ['queijo', 'G'], ['mamao', 'fixo'], ['cafe', 'fixo']] },
    { n: 'Pão com ovos e banana',        i: [['pao', 'C'], ['ovo', 'P'], ['manteiga', 'G'], ['banana', 'fixo'], ['cafe', 'fixo']] },
    { n: 'Tapioca com frango',           i: [['goma', 'C'], ['frango_desf', 'P'], ['requeijao', 'G'], ['mamao', 'fixo'], ['cafe', 'fixo']] },
    { n: 'Mingau de aveia com banana',   i: [['aveia', 'C'], ['leite_po', 'P'], ['castanha', 'G'], ['banana', 'fixo']] },
    { n: 'Macaxeira com ovos',           i: [['macaxeira', 'C'], ['ovo', 'P'], ['manteiga', 'G'], ['cafe', 'fixo']] }
  ],
  lanche1: [
    { n: 'Vitamina de banana com aveia', i: [['aveia', 'C'], ['leite_po', 'P'], ['castanha', 'G'], ['banana', 'fixo']] },
    { n: 'Fruta com iogurte e castanhas', i: [['aveia', 'C'], ['iogurte', 'P'], ['caju', 'G'], ['maca', 'fixo']] },
    { n: 'Pão integral com ovo',         i: [['pao_int', 'C'], ['ovo', 'P'], ['abacate', 'G']] }
  ],
  almoco: [
    { n: 'Arroz, feijão e frango',       i: [['arroz', 'C'], ['frango', 'P'], ['azeite', 'G'], ['feijao', 'fixo'], ['salada', 'fixo']] },
    { n: 'Macaxeira com patinho',        i: [['macaxeira', 'C'], ['patinho', 'P'], ['azeite', 'G'], ['legumes', 'fixo']] },
    { n: 'Peixe com batata-doce',        i: [['batata_doce', 'C'], ['peixe', 'P'], ['azeite', 'G'], ['feijao', 'fixo'], ['salada', 'fixo']] },
    { n: 'Arroz integral, feijão preto e carne', i: [['arroz_int', 'C'], ['patinho', 'P'], ['azeite', 'G'], ['feijao_preto', 'fixo'], ['brocolis', 'fixo']] },
    { n: 'Arroz, lentilha e ovos',       i: [['arroz', 'C'], ['ovo', 'P'], ['azeite', 'G'], ['lentilha', 'fixo'], ['salada', 'fixo']] }
  ],
  lanche2: [
    { n: 'Sanduíche de frango',          i: [['pao_int', 'C'], ['frango_desf', 'P'], ['requeijao', 'G']] },
    { n: 'Tapioca com ovo',              i: [['goma', 'C'], ['ovo', 'P'], ['abacate', 'G']] },
    { n: 'Iogurte com aveia e fruta',    i: [['aveia', 'C'], ['iogurte', 'P'], ['castanha', 'G'], ['banana', 'fixo']] }
  ],
  jantar: [
    { n: 'Cuscuz com frango',            i: [['cuscuz', 'C'], ['frango', 'P'], ['azeite', 'G'], ['salada', 'fixo']] },
    { n: 'Batata-doce com ovos e legumes', i: [['batata_doce', 'C'], ['ovo', 'P'], ['azeite', 'G'], ['cenoura', 'fixo']] },
    { n: 'Macaxeira com carne moída',    i: [['macaxeira', 'C'], ['carne_moida', 'P'], ['azeite', 'G'], ['salada', 'fixo']] },
    { n: 'Arroz com peixe e legumes',    i: [['arroz', 'C'], ['peixe', 'P'], ['azeite', 'G'], ['legumes', 'fixo']] },
    { n: 'Inhame com atum',              i: [['inhame', 'C'], ['atum', 'P'], ['azeite', 'G'], ['salada', 'fixo']] }
  ],
  ceia: [
    { n: 'Iogurte com aveia',            i: [['aveia', 'C'], ['iogurte', 'P'], ['castanha', 'G']] },
    { n: 'Ovos com abacate',             i: [['pao_int', 'C'], ['ovo', 'P'], ['abacate', 'G']] },
    { n: 'Mingau de aveia',              i: [['aveia', 'C'], ['leite_po', 'P'], ['amendoim', 'G']] }
  ]
};

/* ---------- valores ---------- */
const _TACO_IDX = {};
function tacoById(id) {
  if (!_TACO_IDX._ok) { (typeof TACO !== 'undefined' ? TACO : []).forEach(r => { _TACO_IDX[r[0]] = r; }); _TACO_IDX._ok = 1; }
  return _TACO_IDX[id] || null;
}
// valores por 100 g: {kcal, p, c, g}
function alimVal(key) {
  const a = ALIM[key], r = a && tacoById(a.t);
  return r ? { kcal: r[3], p: r[4], c: r[5], g: r[6] } : { kcal: 0, p: 0, c: 0, g: 0 };
}
function itemVal(key, gramas) {
  const v = alimVal(key), f = (gramas || 0) / 100;
  return { kcal: v.kcal * f, p: v.p * f, c: v.c * f, g: v.g * f };
}
function somaVals(list) {
  return list.reduce((s, v) => ({ kcal: s.kcal + v.kcal, p: s.p + v.p, c: s.c + v.c, g: s.g + v.g }), { kcal: 0, p: 0, c: 0, g: 0 });
}

/* ---------- gasto e metas ---------- */
const DIETA_OBJ = { emagrecer: { n: 'Emagrecer', aj: -20 }, manter: { n: 'Manter / recompor', aj: 0 }, ganhar: { n: 'Ganhar massa', aj: 10 } };
const DIETA_MACROS_PADRAO = { c: 40, p: 30, g: 30 }; // padrão do Tel

// TMB: Mifflin-St Jeor; com % de gordura, Katch-McArdle (370 + 21,6 × massa magra)
function dietaTMB({ sexo, peso, altura, idade, bf }) {
  if (!peso) return null;
  if (bf != null && bf > 3 && bf < 60) return { v: Math.round(370 + 21.6 * peso * (1 - bf / 100)), metodo: 'Katch-McArdle' };
  if (!altura || !idade || !sexo) return null;
  return { v: Math.round(10 * peso + 6.25 * altura - 5 * idade + (sexo === 'F' ? -161 : 5)), metodo: 'Mifflin-St Jeor' };
}

// metas diárias: kcal e gramas de cada macro
function dietaMetas({ tmb, fator, objetivo, ajuste, macros }) {
  const gasto = Math.round(tmb * (fator || 1.2));
  const aj = ajuste != null ? ajuste : (DIETA_OBJ[objetivo] || DIETA_OBJ.manter).aj;
  const kcal = Math.round(gasto * (1 + aj / 100) / 10) * 10;
  const m = macros || DIETA_MACROS_PADRAO;
  return { gasto, ajuste: aj, kcal, macros: { c: m.c, p: m.p, g: m.g },
    c: Math.round(kcal * m.c / 100 / 4), p: Math.round(kcal * m.p / 100 / 4), g: Math.round(kcal * m.g / 100 / 9) };
}

// meta de uma refeição pela porcentagem do dia
function metaRefeicao(metas, pct) {
  return { kcal: Math.round(metas.kcal * pct / 100), c: metas.c * pct / 100, p: metas.p * pct / 100, g: metas.g * pct / 100 };
}

/* ---------- restrições ---------- */
function _norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
// restricoes: lista de tags (lactose, gluten, ovo, peixe, carne, frango); aversoes: texto livre ("fígado, beterraba")
function alimPermitido(key, restr) {
  const a = ALIM[key]; if (!a) return false;
  if ((a.tags || []).some(t => (restr.tags || []).includes(t))) return false;
  const nm = _norm(a.n), av = (restr.aversoes || []);
  return !av.some(w => w && w.length >= 3 && nm.includes(w));
}
function lerRestricoes(tags, texto) {
  const av = _norm(texto).split(/[,;\n/]|\se\s/).map(s => s.trim().replace(/^(nao como|nao gosto de|sem)\s+/, '')).filter(s => s.length >= 3);
  return { tags: (tags || []).slice(), aversoes: av };
}
// troca um alimento proibido por outro do mesmo grupo
// (só entre os alimentos usados nos modelos daquela refeição, para não sair "aveia com frango")
function substitutoPermitido(key, restr, usados, refK) {
  if (alimPermitido(key, restr)) return key;
  const g = ALIM[key].g, pool = DIETA_MODELOS[refK] ? DIETA_MODELOS[refK].flatMap(md => md.i.map(x => x[0])) : Object.keys(ALIM);
  return pool.find(k => ALIM[k].g === g && !ALIM[k].livre && k !== 'cafe' && !usados.has(k) && alimPermitido(k, restr)) || null;
}

/* ---------- cálculo das quantidades ----------
   Minimiza o erro relativo de carboidrato, proteína e gordura (e calorias) com limites por alimento,
   por descida coordenada com mínimo exato em cada alimento; depois arredonda para medidas caseiras. */
function _gramasDe(a, x) { return a.passo === 'un' ? x * a.un[1] : x; }
function _limites(a) { return a.passo === 'un' ? [a.min, a.max] : [a.min, a.max]; }
function resolverRefeicao(itens, meta) {
  const fixos = itens.filter(it => it.papel === 'fixo');
  const vars = itens.filter(it => it.papel !== 'fixo');
  const base = somaVals(fixos.map(it => itemVal(it.k, it.gramas)));
  const T = { c: Math.max(meta.c - base.c, 0), p: Math.max(meta.p - base.p, 0), g: Math.max(meta.g - base.g, 0), kcal: Math.max(meta.kcal - base.kcal, 0) };
  const W = { c: 1 / Math.max(meta.c, 5) ** 2, p: 3 / Math.max(meta.p, 5) ** 2, g: 1 / Math.max(meta.g, 3) ** 2, kcal: 1 / Math.max(meta.kcal, 50) ** 2 };
  // coeficientes por "unidade de variável" (1 unidade ou 1 g)
  const A = vars.map(it => { const a = ALIM[it.k], v = alimVal(it.k), f = (a.passo === 'un' ? a.un[1] : 1) / 100; return { c: v.c * f, p: v.p * f, g: v.g * f, kcal: v.kcal * f }; });
  const L = vars.map(it => _limites(ALIM[it.k]));
  let x = vars.map((it, i) => (L[i][0] + L[i][1]) / 2 * 0.5 || L[i][0]);
  const ks = ['c', 'p', 'g', 'kcal'];
  for (let iter = 0; iter < 60; iter++) {
    for (let i = 0; i < x.length; i++) {
      let num = 0, den = 0;
      for (const m of ks) {
        let r = T[m]; for (let j = 0; j < x.length; j++) if (j !== i) r -= A[j][m] * x[j];
        num += W[m] * A[i][m] * r; den += W[m] * A[i][m] * A[i][m];
      }
      x[i] = den ? Math.min(L[i][1], Math.max(L[i][0], num / den)) : L[i][0];
    }
  }
  // arredondar: testa piso/teto de cada variável e fica com a melhor combinação
  const err = xs => ks.reduce((s, m) => { let v = 0; xs.forEach((q, j) => v += A[j][m] * q); return s + W[m] * (v - T[m]) ** 2; }, 0);
  const opts = x.map((q, i) => { const a = ALIM[vars[i].k], st = a.passo === 'un' ? 1 : a.passo; const lo = Math.max(L[i][0], Math.floor(q / st) * st), hi = Math.min(L[i][1], Math.ceil(q / st) * st); return lo === hi ? [lo] : [lo, hi]; });
  let best = null, bestE = Infinity;
  (function rec(i, cur) { if (i === opts.length) { const e = err(cur); if (e < bestE) { bestE = e; best = cur.slice(); } return; } for (const o of opts[i]) { cur.push(o); rec(i + 1, cur); cur.pop(); } })(0, []);
  const out = itens.map(it => {
    if (it.papel === 'fixo') return { k: it.k, papel: 'fixo', gramas: it.gramas };
    const i = vars.indexOf(it), a = ALIM[it.k], q = best[i];
    return { k: it.k, papel: it.papel, gramas: Math.round(_gramasDe(a, q)), un: a.passo === 'un' ? q : null };
  }).filter(it => it.papel === 'fixo' || it.gramas > 0);
  return out;
}

function totalRefeicao(itens) { return somaVals(itens.map(it => itemVal(it.k, it.gramas))); }

/* ---------- montar uma opção a partir de um modelo ---------- */
function montarOpcao(modelo, meta, restr, refK) {
  const usados = new Set(), itens = [];
  for (const [k0, papel] of modelo.i) {
    const k = substitutoPermitido(k0, restr, usados, refK);
    if (!k) { if (papel === 'fixo') continue; return null; }
    usados.add(k);
    const a = ALIM[k];
    itens.push({ k, papel, gramas: papel === 'fixo' ? (a.un ? a.un[1] : 100) : 0 });
  }
  const r = resolverRefeicao(itens, meta), tot = totalRefeicao(r);
  const trocou = itens.some((it, i) => it.k !== (modelo.i.find(x => x[1] === it.papel && x[1] !== 'fixo') || [it.k])[0] && it.papel !== 'fixo');
  const curto = k => ALIM[k].n.toLowerCase().replace(/\s*\(.*\)/, '').replace(/ cozid[oa]s?| grelhado| assado| em flocos| de milho| desnatado| natural/g, '');
  const nome = trocou ? (x => x.charAt(0).toUpperCase() + x.slice(1))(`${curto(itens.find(i => i.papel === 'C').k)} com ${curto(itens.find(i => i.papel === 'P').k)}`) : modelo.n;
  const desvio = Math.max(Math.abs(tot.kcal - meta.kcal) / Math.max(meta.kcal, 1), 0);
  return { nome, itens: r, total: arred(tot), desvio: Math.round(desvio * 100) };
}
function arred(v) { return { kcal: Math.round(v.kcal), p: Math.round(v.p), c: Math.round(v.c), g: Math.round(v.g) }; }

/* ---------- substituições (equivalência pelo macro principal do grupo) ---------- */
const _MACRO_DO_GRUPO = { C: 'c', P: 'p', G: 'g', L: 'c', F: 'c' };
function substituicoes(itemK, gramas, restr, limite, refK) {
  const a = ALIM[itemK], m = _MACRO_DO_GRUPO[a.g]; if (!m) return [];
  const daRef = refK && DIETA_MODELOS[refK] ? new Set(DIETA_MODELOS[refK].flatMap(md => md.i.map(x => x[0]))) : null;
  const alvo = alimVal(itemK)[m] * gramas / 100; if (!alvo) return [];
  return Object.keys(ALIM).filter(k => k !== itemK && ALIM[k].g === a.g && (!daRef || daRef.has(k)) && alimPermitido(k, restr || { tags: [], aversoes: [] })).map(k => {
    const v = alimVal(k)[m]; if (!v) return null;
    const b = ALIM[k]; let g = alvo / v * 100;
    if (b.passo === 'un') { const u = Math.max(1, Math.round(g / b.un[1])); return { k, gramas: Math.round(u * b.un[1]), un: u }; }
    const st = b.passo || 10; g = Math.max(st, Math.round(g / st) * st); return { k, gramas: g, un: null };
  }).filter(Boolean).slice(0, limite || 4);
}

/* ---------- texto da medida caseira ---------- */
function medidaTxt(it) {
  const a = ALIM[it.k]; if (!a) return it.gramas + ' g';
  if (a.livre) return 'à vontade';
  if (a.k === 'cafe' || it.k === 'cafe') return '1 xícara';
  if (it.un != null) { const n = it.un; const nome = a.un[0]; return `${n} ${n === 1 ? nome : plural(nome)} · ${it.gramas} g`; }
  const q = it.gramas / a.un[1], qr = Math.max(0.5, Math.round(q * 2) / 2), qs = q >= 0.9 && q <= 1.1 ? '1' : qr === 0.5 ? '½' : qr.toString().replace('.', ',');
  return `${qs} ${qr > 1.1 && qs !== '1' ? plural(a.un[0]) : a.un[0]} · ${it.gramas} g`;
}
function plural(s) {
  return s.split(' ').map((w, i) => i === 0 || /^(média|médio|cheia|pequena)$/.test(w) ? w.replace(/ão$/, 'ões').replace(/(a|e|o|á|é|ó)$/, '$1s').replace(/r$/, 'res').replace(/l$/, 'is').replace(/^médias?$/, 'médias').replace(/^médios?$/, 'médios').replace(/^cheias?$/, 'cheias').replace(/^pequenas?$/, 'pequenas') : w).join(' ').replace(/sses/, 'ss');
}

/* ---------- gerar o plano completo ----------
   dados: {sexo, peso, altura, idade, bf, fator, objetivo, ajuste, macros, refeicoes, restricoes:{tags, aversoes(texto)}, seed}
   retorna o plano no formato guardado no programa do aluno (lib.diet) */
function gerarDieta(dados) {
  const tmb = dietaTMB(dados); if (!tmb) return { erro: 'Faltam dados para calcular o gasto: sexo, idade, peso e altura.' };
  const metas = dietaMetas({ tmb: tmb.v, fator: dados.fator, objetivo: dados.objetivo, ajuste: dados.ajuste, macros: dados.macros });
  const restr = lerRestricoes(dados.restricoes && dados.restricoes.tags, dados.restricoes && dados.restricoes.aversoes);
  const refs = (dados.refeicoes || DIETA_REFEICOES).map(r => Object.assign({}, r));
  const seed = dados.seed || 0;
  const refeicoes = refs.filter(r => r.pct > 0).map(r => {
    const meta = metaRefeicao(metas, r.pct);
    const mods = (DIETA_MODELOS[r.k] || DIETA_MODELOS.lanche2);
    const ordem = mods.map((m, i) => mods[(i + seed) % mods.length]);
    const ops = [];
    const nomes = new Set();
    const tenta = (lista, ref, tol) => { for (const m of lista) { if (ops.length >= (r.opc || 1)) break; const o = montarOpcao(m, meta, restr, ref); if (o && o.desvio <= tol && !nomes.has(o.nome)) { nomes.add(o.nome); ops.push(o); } } };
    tenta(ordem, r.k, 15);
    // lanches e ceia podem usar os modelos uns dos outros quando as restrições eliminam os próprios
    if (ops.length < (r.opc || 1) && /lanche|ceia/.test(r.k)) ['lanche1', 'lanche2', 'ceia'].filter(x => x !== r.k).forEach(x => tenta(DIETA_MODELOS[x], x, 15));
    if (!ops.length) tenta(ordem, r.k, 40);
    const s = ops[0] ? ops[0].itens.filter(it => it.papel !== 'fixo' && ALIM[it.k].g !== 'V').map(it => ({ k: it.k, gramas: it.gramas, por: substituicoes(it.k, it.gramas, restr, 3, r.k) })) : [];
    return { k: r.k, n: r.n, h: r.h, pct: r.pct, meta: arred(meta), opcoes: ops, subs: s };
  });
  return {
    v: DIETA_V, criado: Date.now(), status: 'rascunho',
    base: { sexo: dados.sexo, peso: dados.peso, altura: dados.altura, idade: dados.idade, bf: dados.bf ?? null, fator: dados.fator, tmb: tmb.v, metodo: tmb.metodo },
    objetivo: dados.objetivo || 'manter', metas, agua: Math.round(dados.peso * 35 / 100) / 10,
    restricoes: { tags: restr.tags, aversoes: (dados.restricoes && dados.restricoes.aversoes) || '' },
    refeicoes
  };
}

// recalcula totais de uma opção depois que o Tel muda gramas ou troca alimento
function recalcOpcao(o, meta) { o.total = arred(totalRefeicao(o.itens)); o.desvio = Math.round(Math.abs(o.total.kcal - meta.kcal) / Math.max(meta.kcal, 1) * 100); return o; }
// "Ajustar quantidades para a meta" mantendo os alimentos escolhidos pelo Tel
function ajustarOpcao(o, meta) { const r = resolverRefeicao(o.itens.map(it => ({ k: it.k, papel: it.papel, gramas: it.gramas })), meta); o.itens = r; return recalcOpcao(o, meta); }

if (typeof module !== 'undefined') module.exports = { ALIM, DIETA_REFEICOES, DIETA_MODELOS, DIETA_OBJ, DIETA_MACROS_PADRAO, dietaTMB, dietaMetas, metaRefeicao, gerarDieta, resolverRefeicao, totalRefeicao, substituicoes, medidaTxt, lerRestricoes, alimPermitido, recalcOpcao, ajustarOpcao, alimVal, tacoById };
