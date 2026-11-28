// Testes do módulo de alimentação (node tests/dieta.test.mjs)
import fs from 'node:fs'; import vm from 'node:vm'; import assert from 'node:assert/strict';
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../js/taco.js', import.meta.url), 'utf8') + '\n' + fs.readFileSync(new URL('../js/dieta.js', import.meta.url), 'utf8') + ';this.D={gerarDieta,ALIM,tacoById,medidaTxt,dietaTMB,dietaMetas,ajustarOpcao,recalcOpcao,TACO}', ctx);
const D = ctx.D; let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
ok(D.TACO.length > 550, 'TACO carregada');
for (const [k, a] of Object.entries(D.ALIM)) ok(D.tacoById(a.t), 'alimento sem dado na TACO: ' + k);
const t = D.dietaTMB({ sexo: 'M', peso: 80, altura: 178, idade: 30 }); ok(t.v === 1768 && t.metodo === 'Mifflin-St Jeor', 'Mifflin');
ok(D.dietaTMB({ peso: 80, bf: 20 }).v === 1752, 'Katch-McArdle');
const m = D.dietaMetas({ tmb: 1768, fator: 1.55, objetivo: 'emagrecer' });
ok(m.gasto === 2740 && m.kcal === 2190 && m.c === 219 && m.p === 164 && m.g === 73, '40/30/30 e −20%');
ok(D.dietaMetas({ tmb: 1768, fator: 1.55, objetivo: 'ganhar' }).kcal === 3010, '+10%');
const p = D.gerarDieta({ sexo: 'M', peso: 80, altura: 178, idade: 30, fator: 1.55, objetivo: 'emagrecer' });
ok(p.refeicoes.length === 6, '6 refeições');
ok(p.refeicoes.reduce((s, r) => s + r.pct, 0) === 100, 'percentuais somam 100');
for (const r of p.refeicoes) {
  ok(r.opcoes.length === (['cafe', 'almoco', 'jantar'].includes(r.k) ? 3 : 1), 'opções em ' + r.k);
  for (const o of r.opcoes) ok(o.desvio <= 15, `${r.k}/${o.nome}: desvio ${o.desvio}%`);
}
const dia = p.refeicoes.reduce((s, r) => s + r.opcoes[0].total.kcal, 0);
ok(Math.abs(dia - p.metas.kcal) / p.metas.kcal < 0.06, 'dia dentro de 6% da meta: ' + dia);
const v = D.gerarDieta({ sexo: 'F', peso: 62, altura: 163, idade: 27, fator: 1.375, objetivo: 'ganhar', restricoes: { tags: ['lactose', 'ovo'], aversoes: 'fígado, macaxeira' } });
const usados = v.refeicoes.flatMap(r => r.opcoes.flatMap(o => o.itens.map(i => i.k)));
ok(!usados.some(k => /ovo|clara|queijo|leite|iogurte|requeijao|manteiga|macaxeira/.test(k)), 'respeita restrições e aversões');
ok(v.refeicoes.every(r => r.opcoes.length >= 1), 'toda refeição tem ao menos 1 opção com restrições');
const o = JSON.parse(JSON.stringify(p.refeicoes[2].opcoes[0])); o.itens[0].gramas += 100; D.recalcOpcao(o, p.refeicoes[2].meta); ok(o.desvio > 15, 'recalcula ao mudar gramas');
D.ajustarOpcao(o, p.refeicoes[2].meta); ok(o.desvio <= 5, 'ajustar para a meta volta para perto: ' + o.desvio);
ok(D.medidaTxt({ k: 'ovo', gramas: 100, un: 2 }) === '2 unidades · 100 g', 'medida caseira');
ok(D.medidaTxt({ k: 'salada', gramas: 100 }) === 'à vontade', 'vegetais à vontade');
console.log(`dieta OK — ${n} verificações`);
