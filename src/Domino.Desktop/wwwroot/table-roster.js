// Presentation of the authoritative seating and rules. Nothing here affects legality or scoring.
const display={tu:'Tú',ana:'Ana',carlos:'Carlos',luis:'Luis'};
const fallback=['tu','carlos','ana','luis'];

export function seatKeys(state){return state?.seats?.map(s=>s.name)??fallback;}
export function seatNames(state){return seatKeys(state).map((key,seat)=>seat===0?localName():display[key]??key);}
export function localName(){try{return localStorage.getItem('patio-name')||'Tú';}catch{return 'Tú';}}
export function teamNames(state){const n=seatNames(state);return {us:`${n[0]} & ${n[2]}`,them:`${n[1]} & ${n[3]}`};}

export const RULE_DEFAULTS=Object.freeze({nextOpener:'winner',counting:'all',blockRule:'blocker-next',blockTie:'blocker',bonus:25,capicua:true,pasoCorrido:true,paseSalida:true});
export function isDefaultRules(s){return Object.entries(RULE_DEFAULTS).every(([k,v])=>s?.[k]===undefined||s[k]===v);}

export function rulesSummary(s) {
  const bonuses=[s.capicua!==false&&'capicúa',s.pasoCorrido!==false&&'paso corrido',s.paseSalida!==false&&'pase de salida'].filter(Boolean);
  return [
    'Primera salida con 6–6',
    s.nextOpener==='rotate'?'después la salida rota a la derecha':s.nextOpener==='double-six'?'cada mano abre con 6–6':'después sale quien gana la mano',
    s.counting==='opponents'?'se cuentan solo las pintas de la pareja perdedora':'se cuentan las pintas de las cuatro manos',
    s.blockRule==='team'?'tranque por suma de parejas':'tranque: trancador contra el rival de su derecha',
    s.blockTie==='void'?'empate de tranque anula la mano':'empate de tranque para el trancador',
    s.bonus&&bonuses.length?`bonos de ${s.bonus}: ${bonuses.join(', ')}`:'sin bonificaciones'
  ].join(' · ')+'.';
}

export function conditionsSummary(s) {
  const difficulty=s.difficulty==='easy'?'fáciles':s.difficulty==='hard'?'difíciles':'intermedios';
  return `Meta ${s.target} · ${s.turnSeconds?s.turnSeconds+' s por turno (al vencer se juega la menor ficha legal)':'Sin límite de tiempo'} · ${s.environment==='terrace'?'Terraza frente al mar':'Patio de barrio'} · Bots ${difficulty} · Mensajes ${s.quickMessages?'activados':'desactivados'}`;
}

// Lists which conditions differ, so a host edit is announced instead of applied silently.
const labels={name:'nombre',target:'meta',turnSeconds:'tiempo por turno',difficulty:'dificultad',environment:'escenario',bonus:'valor de bonos',quickMessages:'mensajes',partner:'parejas',nextOpener:'salida',counting:'conteo',blockRule:'tranque',blockTie:'empate de tranque',capicua:'capicúa',pasoCorrido:'paso corrido',paseSalida:'pase de salida'};
export function changedConditions(before,after){if(!before||!after)return [];return Object.keys(labels).filter(k=>before[k]!==after[k]).map(k=>labels[k]);}
