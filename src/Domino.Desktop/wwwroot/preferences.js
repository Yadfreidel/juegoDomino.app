import {DEFAULT_LAUNCH,launchStyle} from './launch-styles.js';
const defaults={master:.65,music:0,effects:.7,muted:false,sensitivity:1,invertY:false,reducedMotion:false,quality:'medium',vibration:false,confirm:false,largeTiles:false,mutedPlayers:[],launchStyle:DEFAULT_LAUNCH};
export class Preferences extends EventTarget {
  constructor(){super();let saved={};try{saved=JSON.parse(localStorage.getItem('patio-preferences')||'{}');}catch{}this.value=this.validate({...defaults,...saved});}
  validate(value){const v={...defaults,...value};for(const key of ['master','music','effects'])v[key]=Math.min(1,Math.max(0,Number(v[key])||0));v.sensitivity=Math.min(2,Math.max(.3,Number(v.sensitivity)||1));if(!['low','medium','high'].includes(v.quality))v.quality='medium';for(const key of ['muted','invertY','reducedMotion','vibration','confirm','largeTiles'])v[key]=v[key]===true;v.launchStyle=launchStyle(v.launchStyle);v.mutedPlayers=Array.isArray(v.mutedPlayers)?[...new Set(v.mutedPlayers.filter(k=>['ana','carlos','luis'].includes(k)))]:[];return v;}
  set(patch){this.value=this.validate({...this.value,...patch});localStorage.setItem('patio-preferences',JSON.stringify(this.value));this.dispatchEvent(new Event('change'));}
  reset(){this.value={...defaults};this.set({});}
}
