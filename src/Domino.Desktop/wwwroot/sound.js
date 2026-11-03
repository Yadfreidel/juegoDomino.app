export class TableSound {
  constructor(){this.enabled=true;this.audio=null;this.preferences={master:.65,music:0,effects:.7,muted:false};}
  apply(preferences){this.preferences=preferences;this.enabled=!preferences.muted;if(this.musicGain)this.musicGain.gain.setTargetAtTime(this.enabled?preferences.master*preferences.music*.025:0,this.audio.currentTime,.2);}
  unlock() {
    if(!this.audio){this.audio=new AudioContext();this.musicGain=this.audio.createGain();this.musicGain.gain.value=0;this.musicGain.connect(this.audio.destination);for(const frequency of [146.83,220,293.66,369.99]){const tone=this.audio.createOscillator();tone.type='sine';tone.frequency.value=frequency;tone.connect(this.musicGain);tone.start();}this.apply(this.preferences);}
    this.audio.resume().catch(()=>{});
  }
  setEnabled(value){this.enabled=value;localStorage.setItem('patio-sound',String(value));if(value)this.play('select');}
  // Short synthesized clicks, one character per launch style: soft tap, firm slam, felt slide.
  play(kind='place') {
    if(!this.enabled)return;
    const voices={electric:{type:'sawtooth',from:1400,to:70,gain:.045,length:.65,filter:1800},celebrate:{type:'triangle',from:330,to:990,gain:.12,length:1.3},select:{type:'triangle',from:570,to:330,gain:.035,length:.12},place:{type:'triangle',from:380,to:105,gain:.13,length:.12},soft:{type:'triangle',from:420,to:140,gain:.09,length:.11},
      slam:{type:'square',from:240,to:55,gain:.16,length:.16},slide:{type:'sawtooth',from:900,to:260,gain:.035,length:.32,filter:700}};
    const v=voices[kind]??voices.place;
    try {
      this.unlock();const t=this.audio.currentTime,osc=this.audio.createOscillator(),gain=this.audio.createGain();let out=gain;
      osc.type=v.type;osc.frequency.setValueAtTime(v.from,t);osc.frequency.exponentialRampToValueAtTime(v.to,t+v.length*.6);
      gain.gain.setValueAtTime(Math.max(.0001,v.gain*this.preferences.master*this.preferences.effects),t);gain.gain.exponentialRampToValueAtTime(.0001,t+v.length);
      osc.connect(gain);
      if(v.filter){const low=this.audio.createBiquadFilter();low.type='lowpass';low.frequency.value=v.filter;gain.connect(low);out=low;}
      out.connect(this.audio.destination);osc.start();osc.stop(t+v.length+.01);osc.onended=()=>{osc.disconnect();gain.disconnect();if(out!==gain)out.disconnect();};
    }catch{/* Optional audio never blocks the game. */}
  }
  dispose(){this.audio?.close();}
}
