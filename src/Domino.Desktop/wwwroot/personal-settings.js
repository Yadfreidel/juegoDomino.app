const $=id=>document.getElementById(id);
export function bindPersonalSettings(preferences,sound,getScene) {
  const fields={master:'master-volume',music:'music-volume',effects:'effects-volume',sensitivity:'camera-sensitivity',invertY:'invert-y',reducedMotion:'reduced-motion',vibration:'vibration',quality:'quality',confirm:'confirm-setting',largeTiles:'large-tiles'};
  for(const [key,id] of Object.entries(fields))$(id).oninput=()=>{const el=$(id);preferences.set({[key]:el.type==='checkbox'?el.checked:el.type==='range'?Number(el.value):el.value});if(['master','music','effects'].includes(key))sound.unlock();};
  $('audio-setting').onchange=e=>{preferences.set({muted:!e.target.checked});if(e.target.checked)sound.play('select');};
  $('sound').onclick=()=>{preferences.set({muted:!preferences.value.muted});if(!preferences.value.muted)sound.play('select');};
  $('reset-settings').onclick=()=>preferences.reset();
  $('vibration').disabled=typeof navigator.vibrate!=='function';$('vibration-note').textContent=$('vibration').disabled?'Este navegador no ofrece vibración.':'La vibración depende del dispositivo y de los permisos del navegador.';
  function apply(){const p=preferences.value;for(const [key,id] of Object.entries(fields)){if($(id).type==='checkbox')$(id).checked=p[key];else $(id).value=String(p[key]);}sound.apply(p);$('audio-setting').checked=!p.muted;$('sound').setAttribute('aria-pressed',String(!p.muted));document.body.classList.toggle('large-tiles',p.largeTiles);document.body.classList.toggle('reduced-motion',p.reducedMotion);const scene=getScene();if(scene){if(scene.qualityLevel!==p.quality)scene.quality(p.quality);scene.reducedMotion=p.reducedMotion;scene.view.reducedMotion=p.reducedMotion;scene.view.sensitivity=p.sensitivity;scene.view.invertY=p.invertY;}}
  preferences.addEventListener('change',apply);apply();return apply;
}
