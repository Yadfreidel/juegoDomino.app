export class TableSound {
  constructor(){this.enabled=true;this.audio=null;this.preferences={master:.65,music:0,effects:.7,muted:false};}
  apply(preferences){this.preferences=preferences;this.enabled=!preferences.muted;if(this.musicGain)this.musicGain.gain.setTargetAtTime(this.enabled?preferences.master*preferences.music*.025:0,this.audio.currentTime,.2);}
  unlock() {
    if(!this.audio){this.audio=new AudioContext();this.musicGain=this.audio.createGain();this.musicGain.gain.value=0;this.musicGain.connect(this.audio.destination);for(const frequency of [146.83,220,293.66,369.99]){const tone=this.audio.createOscillator();tone.type='sine';tone.frequency.value=frequency;tone.connect(this.musicGain);tone.start();}this.apply(this.preferences);}
    this.audio.resume().catch(()=>{});
  }
  setEnabled(value){this.enabled=value;localStorage.setItem('patio-sound',String(value));if(value)this.play('select');}
  play(kind='place') {
    if(!this.enabled)return;
    try {
      this.unlock();const t=this.audio.currentTime,osc=this.audio.createOscillator(),gain=this.audio.createGain();
      osc.type='triangle';osc.frequency.setValueAtTime(kind==='select'?570:380,t);osc.frequency.exponentialRampToValueAtTime(kind==='select'?330:105,t+.07);
      gain.gain.setValueAtTime(Math.max(.0001,(kind==='select'?.035:.13)*this.preferences.master*this.preferences.effects),t);gain.gain.exponentialRampToValueAtTime(.0001,t+.12);
      osc.connect(gain);gain.connect(this.audio.destination);osc.start();osc.stop(t+.13);osc.onended=()=>{osc.disconnect();gain.disconnect();};
    }catch{/* Optional audio never blocks the game. */}
  }
  dispose(){this.audio?.close();}
}
