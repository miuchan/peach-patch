"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ModuleName =
  | "VCO"
  | "Wavetable"
  | "Sampler / Looper"
  | "Noise Source"
  | "VCF"
  | "VCA"
  | "Envelope Generator"
  | "LFO"
  | "Sequencer"
  | "Mixer"
  | "Attenuator"
  | "Multiple"
  | "Effects";

type Engine = {
  ctx: AudioContext;
  osc: OscillatorNode;
  wave: OscillatorNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
  oscGain: GainNode;
  waveGain: GainNode;
  noiseGain: GainNode;
  noise: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  amp: GainNode;
  delay: DelayNode;
  feedback: GainNode;
  wet: GainNode;
  dry: GainNode;
  master: GainNode;
};

const LIBRARY: { group: string; items: { name: ModuleName; icon: string; note: string }[] }[] = [
  {
    group: "SOURCES",
    items: [
      { name: "VCO", icon: "≈", note: "Analog oscillator" },
      { name: "Wavetable", icon: "〽", note: "Morphing spectrum" },
      { name: "Sampler / Looper", icon: "▰", note: "Play & capture" },
      { name: "Noise Source", icon: "░", note: "White / pink noise" },
    ],
  },
  {
    group: "SHAPE",
    items: [
      { name: "VCF", icon: "⌁", note: "Multimode filter" },
      { name: "VCA", icon: "◢", note: "Level & dynamics" },
      { name: "Envelope Generator", icon: "⌇", note: "ADSR contour" },
    ],
  },
  {
    group: "MODULATE",
    items: [
      { name: "LFO", icon: "∿", note: "Tempo or free" },
      { name: "Sequencer", icon: "▦", note: "16-step pattern" },
    ],
  },
  {
    group: "ROUTE + FX",
    items: [
      { name: "Mixer", icon: "≡", note: "4-channel mixer" },
      { name: "Attenuator", icon: "↘", note: "Scale a signal" },
      { name: "Multiple", icon: "⑂", note: "Split to four" },
      { name: "Effects", icon: "✦", note: "Delay + space" },
    ],
  },
];

const NOTES = [130.81, 155.56, 174.61, 196, 233.08, 261.63, 311.13, 349.23];
const DEFAULT_STEPS = [true, false, true, false, true, true, false, true, false, true, false, true, true, false, true, false];

function Knob({ label, value, min, max, step = 1, suffix = "", onChange, accent = "peach" }: {
  label: string; value: number; min: number; max: number; step?: number; suffix?: string;
  onChange: (value: number) => void; accent?: "peach" | "mint" | "blue";
}) {
  const rotation = -135 + ((value - min) / (max - min)) * 270;
  return (
    <label className="knob-control">
      <span className={`knob knob-${accent}`} style={{ "--turn": `${rotation}deg` } as React.CSSProperties}>
        <i />
        <input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      </span>
      <strong>{label}</strong>
      <small>{value}{suffix}</small>
    </label>
  );
}

function Scope({ playing, seed }: { playing: boolean; seed: number }) {
  const bars = Array.from({ length: 46 }, (_, i) => {
    const amp = playing ? 18 + Math.sin(i * 0.69 + seed) * 14 + Math.sin(i * 0.2) * 7 : 2;
    return Math.max(2, amp);
  });
  return <div className="mini-scope" aria-label={playing ? "Audio visualization active" : "Audio visualization idle"}>
    {bars.map((height, i) => <i key={i} style={{ height }} />)}
  </div>;
}

function Port({ type, label, active = true }: { type: "in" | "out"; label: string; active?: boolean }) {
  return <div className={`port port-${type} ${active ? "active" : ""}`} title={`${label} ${type}`}><i /><span>{label}</span></div>;
}

export default function SynthStudio() {
  const engineRef = useRef<Engine | null>(null);
  const timerRef = useRef<number | null>(null);
  const stepRef = useRef(-1);
  const stepsRef = useRef(DEFAULT_STEPS);
  const [audioOn, setAudioOn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [bpm, setBpm] = useState(124);
  const [steps, setSteps] = useState(DEFAULT_STEPS);
  const [waveform, setWaveform] = useState<OscillatorType>("sawtooth");
  const [octave, setOctave] = useState(0);
  const [cutoff, setCutoff] = useState(1850);
  const [resonance, setResonance] = useState(4.2);
  const [attack, setAttack] = useState(0.01);
  const [release, setRelease] = useState(0.22);
  const [lfoRate, setLfoRate] = useState(2);
  const [delayMix, setDelayMix] = useState(22);
  const [master, setMaster] = useState(72);
  const [added, setAdded] = useState<ModuleName[]>(["Attenuator", "Multiple"]);
  const [selected, setSelected] = useState<ModuleName>("VCF");
  const [saved, setSaved] = useState("Saved locally");
  const [toast, setToast] = useState("Smart patch ready — press Start Audio");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [moduleSearch, setModuleSearch] = useState("");

  useEffect(() => { stepsRef.current = steps; }, [steps]);

  const updateNode = useCallback((key: string, value: number) => {
    const e = engineRef.current;
    if (!e) return;
    const now = e.ctx.currentTime;
    if (key === "cutoff") e.filter.frequency.setTargetAtTime(value, now, 0.015);
    if (key === "resonance") e.filter.Q.setTargetAtTime(value, now, 0.015);
    if (key === "lfo") e.lfo.frequency.setTargetAtTime(value, now, 0.02);
    if (key === "delay") {
      e.wet.gain.setTargetAtTime(value / 100, now, 0.02);
      e.dry.gain.setTargetAtTime(1 - value / 180, now, 0.02);
    }
    if (key === "master") e.master.gain.setTargetAtTime(value / 100 * 0.32, now, 0.02);
  }, []);

  const startAudio = async () => {
    if (engineRef.current) {
      await engineRef.current.ctx.resume();
      setAudioOn(true);
      return;
    }
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const wave = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const oscGain = ctx.createGain();
    const waveGain = ctx.createGain();
    const noiseGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    const delay = ctx.createDelay(2);
    const feedback = ctx.createGain();
    const wet = ctx.createGain();
    const dry = ctx.createGain();
    const masterNode = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    osc.type = waveform;
    wave.setPeriodicWave(ctx.createPeriodicWave(new Float32Array([0, 0.9, 0.4, 0.18, 0.11, 0.06]), new Float32Array(6)));
    osc.frequency.value = 130.81;
    wave.frequency.value = 130.81;
    oscGain.gain.value = 0.56;
    waveGain.gain.value = 0.22;
    noiseGain.gain.value = 0.015;
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    filter.Q.value = resonance;
    amp.gain.value = 0;
    delay.delayTime.value = 0.28;
    feedback.gain.value = 0.34;
    wet.gain.value = delayMix / 100;
    dry.gain.value = 1 - delayMix / 180;
    masterNode.gain.value = master / 100 * 0.32;
    compressor.threshold.value = -14;
    compressor.ratio.value = 5;
    osc.connect(oscGain).connect(filter);
    wave.connect(waveGain).connect(filter);
    noise.connect(noiseGain).connect(filter);
    filter.connect(amp);
    amp.connect(dry).connect(compressor);
    amp.connect(delay).connect(wet).connect(compressor);
    delay.connect(feedback).connect(delay);
    compressor.connect(masterNode).connect(ctx.destination);
    lfo.frequency.value = lfoRate;
    lfoGain.gain.value = 280;
    lfo.connect(lfoGain).connect(filter.frequency);
    osc.start(); wave.start(); lfo.start(); noise.start();
    engineRef.current = { ctx, osc, wave, lfo, lfoGain, oscGain, waveGain, noiseGain, noise, filter, amp, delay, feedback, wet, dry, master: masterNode };
    await ctx.resume();
    setAudioOn(true);
    setToast("Audio is live — the patch is ready to play");
  };

  const trigger = useCallback((index: number) => {
    const e = engineRef.current;
    if (!e || !stepsRef.current[index]) return;
    const now = e.ctx.currentTime;
    const noteIndex = [0, 2, 3, 5, 0, 4, 6, 3, 7, 5, 2, 3, 0, 6, 4, 2][index];
    const freq = NOTES[noteIndex] * Math.pow(2, octave);
    e.osc.frequency.setTargetAtTime(freq, now, 0.008);
    e.wave.frequency.setTargetAtTime(freq * 0.5, now, 0.008);
    e.amp.gain.cancelScheduledValues(now);
    e.amp.gain.setValueAtTime(0.0001, now);
    e.amp.gain.exponentialRampToValueAtTime(0.72, now + Math.max(attack, 0.006));
    e.amp.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(attack + release, 0.08));
  }, [attack, release, octave]);

  const stopSequence = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setPlaying(false);
    setCurrentStep(-1);
    stepRef.current = -1;
  }, []);

  const togglePlay = async () => {
    if (playing) return stopSequence();
    await startAudio();
    const tick = () => {
      stepRef.current = (stepRef.current + 1) % 16;
      setCurrentStep(stepRef.current);
      trigger(stepRef.current);
    };
    tick();
    timerRef.current = window.setInterval(tick, 60000 / bpm / 4);
    setPlaying(true);
  };

  useEffect(() => {
    if (!playing) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      stepRef.current = (stepRef.current + 1) % 16;
      setCurrentStep(stepRef.current);
      trigger(stepRef.current);
    }, 60000 / bpm / 4);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [bpm, playing, trigger]);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    engineRef.current?.ctx.close();
  }, []);

  const savePatch = () => {
    const patch = { version: 1, bpm, steps, waveform, octave, cutoff, resonance, attack, release, lfoRate, delayMix, master, added };
    localStorage.setItem("peach-cat-patch", JSON.stringify(patch));
    setSaved("Saved just now");
    setToast("Patch saved to this device");
  };

  const addModule = (name: ModuleName) => {
    setSelected(name);
    if (!added.includes(name)) {
      setAdded((current) => [...current, name]);
      setToast(`${name} inserted and auto-patched`);
    } else {
      setToast(`${name} focused in the inspector`);
    }
    setLibraryOpen(false);
  };

  return (
    <main className="studio-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">P</span><span><b>PEACH/</b>PATCH<small>WEB MODULAR STUDIO</small></span></div>
        <div className="transport" aria-label="Transport controls">
          <button className="icon-button" aria-label="Rewind" onClick={() => { stepRef.current = -1; setCurrentStep(-1); }}>↤</button>
          <button data-testid="play" className={`play-button ${playing ? "is-playing" : ""}`} onClick={togglePlay}>{playing ? "■" : "▶"}</button>
          <div className="bpm"><span>BPM</span><input aria-label="Tempo in BPM" type="number" min="50" max="220" value={bpm} onChange={(e) => setBpm(Math.max(50, Math.min(220, Number(e.target.value))))} /></div>
          <div className="meter"><i className={playing ? "pulse" : ""} /><i /><i /><i /></div>
        </div>
        <div className="top-actions">
          <span className="save-state"><i />{saved}</span>
          <button onClick={savePatch}>Save</button>
          <button className="primary" data-testid="audio-toggle" onClick={startAudio}>{audioOn ? "Audio on" : "Start audio"}</button>
        </div>
      </header>

      <section className="workspace">
        <aside className={`library ${libraryOpen ? "open" : ""}`}>
          <div className="panel-heading"><span>MODULES</span><button aria-label="Close module library" onClick={() => setLibraryOpen(false)}>×</button></div>
          <label className="search"><span>⌕</span><input aria-label="Search modules" placeholder="Search modules" value={moduleSearch} onChange={(event) => setModuleSearch(event.target.value)} /></label>
          {LIBRARY.map((group) => <div className="library-group" key={group.group}>
            <h3>{group.group}</h3>
            {group.items.filter((item) => `${item.name} ${item.note}`.toLowerCase().includes(moduleSearch.toLowerCase())).map((item) => <button data-module={item.name} className={selected === item.name ? "selected" : ""} key={item.name} onClick={() => addModule(item.name)}>
              <i>{item.icon}</i><span><b>{item.name}</b><small>{item.note}</small></span><em>{added.includes(item.name) ? "•" : "+"}</em>
            </button>)}
          </div>)}
          <div className="library-tip"><b>Tip</b><p>Click a module. Peach/Patch inserts it where the signal makes sense.</p></div>
        </aside>

        <section className="patch-area">
          <div className="patch-toolbar">
            <div><button className="mobile-library" onClick={() => setLibraryOpen(true)}>＋ Modules</button><b>Morning Circuit</b><span>Instrument · auto-patched</span></div>
            <div className="zoom"><button>−</button><span>88%</span><button>＋</button><button className="fit">Fit</button></div>
          </div>

          <div className="flow-label"><span>SIGNAL FLOW</span><i /><b>8 modules · 9 smart connections</b></div>
          <div className="rack-flow">
            <article className="module-card peach" role="button" tabIndex={0} aria-label="Select VCO module" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelected("VCO"); }} onClick={() => setSelected("VCO")} data-testid="module-vco">
              <div className="module-top"><span>01</span><div><b>VCO</b><small>PRIMARY OSCILLATOR</small></div><button aria-label="VCO options">•••</button></div>
              <Scope playing={playing} seed={currentStep} />
              <div className="wave-tabs" role="group" aria-label="Oscillator waveform">
                {(["sine", "triangle", "sawtooth", "square"] as OscillatorType[]).map((w) => <button aria-label={`${w} waveform`} className={waveform === w ? "active" : ""} key={w} onClick={(e) => { e.stopPropagation(); setWaveform(w); if (engineRef.current) engineRef.current.osc.type = w; }}>{w === "sine" ? "∿" : w === "triangle" ? "△" : w === "sawtooth" ? "⋰" : "⊓"}</button>)}
              </div>
              <div className="knob-row">
                <Knob label="OCT" value={octave} min={-2} max={2} onChange={setOctave} />
                <Knob label="FINE" value={0} min={-50} max={50} suffix="¢" onChange={() => {}} />
                <Knob label="LEVEL" value={56} min={0} max={100} suffix="%" onChange={(v) => { if (engineRef.current) engineRef.current.oscGain.gain.value = v / 100; }} />
              </div>
              <div className="ports"><Port type="in" label="PITCH"/><Port type="in" label="FM"/><Port type="out" label="OUT"/></div>
            </article>

            <article className="module-card mint" role="button" tabIndex={0} aria-label="Select Mixer module" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelected("Mixer"); }} onClick={() => setSelected("Mixer")} data-testid="module-mixer">
              <div className="module-top"><span>02</span><div><b>4× MIX</b><small>SOURCES</small></div><button aria-label="Mixer options">•••</button></div>
              <div className="mixer-strips">
                {["VCO", "WAVE", "SAMPLE", "NOISE"].map((name, i) => <label key={name}><span>{name}</span><input aria-label={`${name} level`} type="range" min="0" max="100" defaultValue={[56, 22, 0, 4][i]} /><i /></label>)}
              </div>
              <div className="ports"><Port type="in" label="1–4"/><Port type="out" label="MIX"/></div>
            </article>

            <article className="module-card blue selected-card" role="button" tabIndex={0} aria-label="Select VCF module" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelected("VCF"); }} onClick={() => setSelected("VCF")} data-testid="module-vcf">
              <div className="module-top"><span>03</span><div><b>VCF</b><small>STATE VARIABLE</small></div><button aria-label="Filter options">•••</button></div>
              <div className="filter-graph"><i style={{ "--cutoff": `${Math.min(86, Math.max(18, cutoff / 55))}%` } as React.CSSProperties} /><span>LP 24</span></div>
              <div className="knob-row">
                <Knob label="CUTOFF" value={cutoff} min={120} max={6000} step={10} suffix="Hz" accent="blue" onChange={(v) => { setCutoff(v); updateNode("cutoff", v); }} />
                <Knob label="RES" value={resonance} min={0} max={18} step={0.1} accent="blue" onChange={(v) => { setResonance(v); updateNode("resonance", v); }} />
                <Knob label="DRIVE" value={8} min={0} max={24} suffix="dB" accent="blue" onChange={() => {}} />
              </div>
              <div className="ports"><Port type="in" label="IN"/><Port type="in" label="CV"/><Port type="out" label="LP"/></div>
            </article>

            <article className="module-card violet" role="button" tabIndex={0} aria-label="Select Envelope Generator module" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelected("Envelope Generator"); }} onClick={() => setSelected("Envelope Generator")} data-testid="module-envelope">
              <div className="module-top"><span>04</span><div><b>ENVELOPE</b><small>SNAPPY ADSR</small></div><button aria-label="Envelope options">•••</button></div>
              <div className="envelope-graph"><i/><i/><i/><i/></div>
              <div className="compact-controls">
                <label>A<input aria-label="Envelope attack" type="range" min="0.005" max="0.5" step="0.005" value={attack} onChange={(e) => setAttack(Number(e.target.value))}/><span>{Math.round(attack * 1000)}ms</span></label>
                <label>D<input aria-label="Envelope decay" type="range" min="0.02" max="1" step="0.01" defaultValue="0.18"/><span>180ms</span></label>
                <label>S<input aria-label="Envelope sustain" type="range" min="0" max="100" defaultValue="62"/><span>62%</span></label>
                <label>R<input aria-label="Envelope release" type="range" min="0.03" max="1.2" step="0.01" value={release} onChange={(e) => setRelease(Number(e.target.value))}/><span>{Math.round(release * 1000)}ms</span></label>
              </div>
              <div className="ports"><Port type="in" label="GATE"/><Port type="out" label="ENV"/></div>
            </article>

            <article className="module-card dark" role="button" tabIndex={0} aria-label="Select Effects module" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelected("Effects"); }} onClick={() => setSelected("Effects")} data-testid="module-effects">
              <div className="module-top"><span>05</span><div><b>SPACE ECHO</b><small>STEREO EFFECT</small></div><button aria-label="Effects options">•••</button></div>
              <div className="echo-display"><span>1/8<small>SYNC</small></span><div><i/><i/><i/></div></div>
              <div className="knob-row">
                <Knob label="TIME" value={28} min={4} max={80} suffix="%" accent="mint" onChange={() => {}} />
                <Knob label="FEED" value={34} min={0} max={80} suffix="%" accent="mint" onChange={(v) => { if (engineRef.current) engineRef.current.feedback.gain.value = v / 100; }} />
                <Knob label="MIX" value={delayMix} min={0} max={70} suffix="%" accent="mint" onChange={(v) => { setDelayMix(v); updateNode("delay", v); }} />
              </div>
              <div className="ports"><Port type="in" label="IN"/><Port type="out" label="L/R"/></div>
            </article>
          </div>

          <button className="add-inline" onClick={() => setLibraryOpen(true)}><span>＋</span><b>Add module</b><small>auto-connects to this flow</small></button>
          {added.length > 0 && <div className="utility-row">{added.map((name) => <button key={name} onClick={() => setSelected(name)}><i>{LIBRARY.flatMap(g => g.items).find(i => i.name === name)?.icon}</i><span><b>{name}</b><small>Utility · connected</small></span><em>→</em></button>)}</div>}
        </section>

        <aside className="inspector">
          <div className="panel-heading"><span>INSPECTOR</span><button aria-label="Close inspector">×</button></div>
          <div className="inspector-title"><i>{LIBRARY.flatMap(g => g.items).find(i => i.name === selected)?.icon}</i><span><b>{selected}</b><small>Selected module</small></span></div>
          <section><h3>QUICK CONTROL</h3>
            <Knob label={selected === "LFO" ? "RATE" : selected === "VCF" ? "CUTOFF" : "AMOUNT"} value={selected === "LFO" ? lfoRate : selected === "VCF" ? cutoff : 72} min={selected === "VCF" ? 120 : 0} max={selected === "VCF" ? 6000 : selected === "LFO" ? 12 : 100} step={selected === "LFO" ? 0.1 : 1} onChange={(v) => { if (selected === "LFO") { setLfoRate(v); updateNode("lfo", v); } if (selected === "VCF") { setCutoff(v); updateNode("cutoff", v); } }} accent="blue" />
          </section>
          <section className="routing"><h3>SMART ROUTING</h3><div><span>Source</span><b>{selected === "VCF" ? "4× MIX" : "AUTO"}</b></div><i>↓</i><div><span>Destination</span><b>{selected === "VCF" ? "ENVELOPE / VCA" : "BEST MATCH"}</b></div><p><i /> Signal type checked · no clipping</p></section>
          <section className="help-card"><h3>WHAT IT DOES</h3><p>{selected === "VCF" ? "Shapes brightness. Lower cutoff for warmth; raise resonance for a more vocal edge." : `${selected} is already connected in the active patch. Use the quick control to hear its role immediately.`}</p><button onClick={() => setToast("Context help pinned — adjust a control to hear the difference")}>Show me in the patch</button></section>
          <section className="macro-section"><h3>PERFORM MACROS</h3><label><span><b>1</b> BRIGHTNESS</span><input aria-label="Brightness macro" type="range" min="120" max="6000" value={cutoff} onChange={(e) => { const v = Number(e.target.value); setCutoff(v); updateNode("cutoff", v); }}/></label><label><span><b>2</b> SPACE</span><input aria-label="Space macro" type="range" min="0" max="70" value={delayMix} onChange={(e) => { const v = Number(e.target.value); setDelayMix(v); updateNode("delay", v); }}/></label></section>
        </aside>
      </section>

      <section className="sequencer" data-testid="sequencer">
        <div className="seq-title"><span>06</span><div><b>STEP SEQUENCER</b><small>16 STEPS · 1/16 · C MINOR</small></div><button aria-label="Randomize pattern" onClick={() => setSteps(steps.map(() => Math.random() > 0.45))}>↝ Random</button></div>
        <div className="steps">
          {steps.map((active, i) => <button data-testid={`step-${i + 1}`} aria-label={`Step ${i + 1}`} aria-pressed={active} className={`${active ? "active" : ""} ${currentStep === i ? "playing" : ""}`} key={i} onClick={() => setSteps(steps.map((s, n) => n === i ? !s : s))}><span>{i + 1}</span><i style={{ height: `${20 + [32, 48, 26, 58, 38, 68, 28, 50][i % 8]}%` }} /><em>{["C3", "—", "E♭3", "—", "G3", "B♭3", "—", "G3"][i % 8]}</em></button>)}
        </div>
        <div className="seq-actions"><button onClick={() => setSteps(DEFAULT_STEPS)}>A</button><button>B</button><span>SWING <input aria-label="Swing" type="range" min="0" max="70" defaultValue="18" /></span></div>
      </section>

      <footer><span><i className={audioOn ? "online" : ""}/>{audioOn ? "Audio engine ready" : "Audio waiting"}</span><span>44.1 kHz · Web Audio</span><div className="master"><b>MASTER</b><input aria-label="Master volume" type="range" min="0" max="100" value={master} onChange={(e) => { const v = Number(e.target.value); setMaster(v); updateNode("master", v); }}/><em>{master}%</em></div></footer>
      <div className="toast" role="status">{toast}</div>
    </main>
  );
}
