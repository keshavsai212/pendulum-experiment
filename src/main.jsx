import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const defaults = {
  length: 1,
  mass: 1,
  gravity: 9.81,
  startAngle: 18,
  damping: 0.02,
};

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value) {
  return (value * 180) / Math.PI;
}

function insightFor(config, period) {
  if (config.damping > 0.07) {
    return "High damping removes energy quickly, so the bob settles down in fewer swings. Real pendulums lose energy to air resistance and friction at the pivot.";
  }

  if (config.startAngle > 35) {
    return "Large angles are useful to explore, but the simple period formula becomes less exact because the small-angle approximation starts to break down.";
  }

  if (config.gravity < 5) {
    return `With weaker gravity, the restoring pull is smaller, so the pendulum swings slowly. The predicted period is ${period.toFixed(2)} seconds.`;
  }

  if (config.length > 1.6) {
    return "Longer pendulums swing more slowly because the bob travels through a wider arc and gravity changes its angle more gradually.";
  }

  return "Mass changes the energy in the bob, but it does not change the ideal period. Length and gravity are the main controls for swing timing.";
}

function drawPendulum(ctx, canvas, theta, config) {
  const width = canvas.width;
  const height = canvas.height;
  const pivot = { x: width / 2, y: 84 };
  const pixelLength = Math.min(height * 0.68, 170 + config.length * 145);
  const bob = {
    x: pivot.x + Math.sin(theta) * pixelLength,
    y: pivot.y + Math.cos(theta) * pixelLength,
  };
  const bobRadius = 22 + config.mass * 4;

  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#f9fbf7");
  gradient.addColorStop(1, "#edf4ef");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#d8ded8";
  ctx.lineWidth = 1;
  for (let angle = -60; angle <= 60; angle += 15) {
    const rad = degreesToRadians(angle);
    ctx.beginPath();
    ctx.moveTo(pivot.x, pivot.y);
    ctx.lineTo(pivot.x + Math.sin(rad) * pixelLength, pivot.y + Math.cos(rad) * pixelLength);
    ctx.stroke();
  }

  ctx.strokeStyle = "#2b6f9f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(pivot.x, pivot.y, pixelLength, Math.PI / 2 - degreesToRadians(65), Math.PI / 2 + degreesToRadians(65));
  ctx.stroke();

  ctx.strokeStyle = "#26352f";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(pivot.x, pivot.y);
  ctx.lineTo(bob.x, bob.y);
  ctx.stroke();

  ctx.fillStyle = "#16201c";
  ctx.beginPath();
  ctx.arc(pivot.x, pivot.y, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#b24535";
  ctx.beginPath();
  ctx.arc(bob.x, bob.y, bobRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.beginPath();
  ctx.arc(bob.x - bobRadius / 3, bob.y - bobRadius / 3, bobRadius / 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#16201c";
  ctx.font = "700 18px system-ui";
  ctx.fillText(`${Math.abs(radiansToDegrees(theta)).toFixed(1)}°`, pivot.x + 18, pivot.y + 26);
}

function drawGraph(ctx, canvas, samples) {
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fbfcf9";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#d9dfda";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i += 1) {
    const y = (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#1d6b52";
  ctx.lineWidth = 3;
  ctx.beginPath();
  samples.forEach((sample, index) => {
    const x = (index / 159) * width;
    const y = height / 2 - (sample / 70) * (height / 2 - 18);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  ctx.fillStyle = "#5c6862";
  ctx.font = "700 14px system-ui";
  ctx.fillText("angle over time", 14, 24);
}

function App() {
  const pendulumCanvas = useRef(null);
  const graphCanvas = useRef(null);
  const configRef = useRef(defaults);
  const stateRef = useRef({
    theta: degreesToRadians(defaults.startAngle),
    omega: 0,
    running: true,
    lastTime: performance.now(),
    samples: [],
  });

  const [config, setConfig] = useState(defaults);
  const [readings, setReadings] = useState({
    angle: defaults.startAngle,
    energy: 0,
  });
  const [running, setRunning] = useState(true);

  const period = useMemo(() => 2 * Math.PI * Math.sqrt(config.length / config.gravity), [config.length, config.gravity]);
  const frequency = 1 / period;
  const insight = insightFor(config, period);

  function resetSimulation(nextConfig = configRef.current) {
    stateRef.current.theta = degreesToRadians(nextConfig.startAngle);
    stateRef.current.omega = 0;
    stateRef.current.samples = [];
    stateRef.current.lastTime = performance.now();
  }

  function updateConfig(key, value) {
    const nextConfig = { ...configRef.current, [key]: Number(value) };
    configRef.current = nextConfig;
    setConfig(nextConfig);

    if (key === "startAngle" || key === "length" || key === "gravity") {
      resetSimulation(nextConfig);
    }
  }

  function release() {
    resetSimulation();
    stateRef.current.running = true;
    setRunning(true);
  }

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    let animationFrame = 0;

    function animate(now) {
      const current = stateRef.current;
      const activeConfig = configRef.current;
      const dt = Math.min((now - current.lastTime) / 1000, 0.032);
      current.lastTime = now;

      if (current.running) {
        const acceleration = -(activeConfig.gravity / activeConfig.length) * Math.sin(current.theta) - activeConfig.damping * current.omega;
        current.omega += acceleration * dt;
        current.theta += current.omega * dt;
      }

      const height = activeConfig.length * (1 - Math.cos(current.theta));
      const potential = activeConfig.mass * activeConfig.gravity * height;
      const kinetic = 0.5 * activeConfig.mass * Math.pow(activeConfig.length * current.omega, 2);
      current.samples.push(radiansToDegrees(current.theta));

      if (current.samples.length > 160) {
        current.samples.shift();
      }

      if (pendulumCanvas.current && graphCanvas.current) {
        drawPendulum(pendulumCanvas.current.getContext("2d"), pendulumCanvas.current, current.theta, activeConfig);
        drawGraph(graphCanvas.current.getContext("2d"), graphCanvas.current, current.samples);
      }

      setReadings({
        angle: radiansToDegrees(current.theta),
        energy: potential + kinetic,
      });

      animationFrame = requestAnimationFrame(animate);
    }

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  function toggleRunning() {
    stateRef.current.running = !stateRef.current.running;
    setRunning(stateRef.current.running);
  }

  function resetAndRun() {
    resetSimulation();
    stateRef.current.running = true;
    setRunning(true);
  }

  return (
    <main className="app-shell">
      <section className="lab">
        <div className="sim-panel">
          <div className="sim-header">
            <div>
              <p className="eyebrow">Virtual Physics Lab</p>
              <h1>Pendulum Lab</h1>
            </div>
            <div className="status-pill">{running ? "Running" : "Paused"}</div>
          </div>

          <div className="canvas-wrap">
            <canvas ref={pendulumCanvas} width="900" height="640" aria-label="Animated pendulum simulation" />
          </div>

          <div className="toolbar" aria-label="Simulation controls">
            <button type="button" onClick={toggleRunning}>{running ? "Pause" : "Play"}</button>
            <button type="button" onClick={resetAndRun}>Reset</button>
            <button type="button" onClick={release}>Release</button>
          </div>
        </div>

        <aside className="side-panel">
          <section className="readouts" aria-label="Live experiment readings">
            <h2>Live Readings</h2>
            <div className="metric-grid">
              <Metric label="Period" value={`${period.toFixed(2)} s`} />
              <Metric label="Frequency" value={`${frequency.toFixed(2)} Hz`} />
              <Metric label="Angle" value={`${readings.angle.toFixed(1)}°`} />
              <Metric label="Energy" value={`${readings.energy.toFixed(2)} J`} />
            </div>
          </section>

          <section className="controls" aria-label="Pendulum settings">
            <h2>Experiment Controls</h2>
            <Slider label="Length" value={config.length} output={`${config.length.toFixed(2)} m`} min="0.25" max="2.5" step="0.05" onChange={(value) => updateConfig("length", value)} />
            <Slider label="Mass" value={config.mass} output={`${config.mass.toFixed(1)} kg`} min="0.2" max="5" step="0.1" onChange={(value) => updateConfig("mass", value)} />
            <Slider label="Gravity" value={config.gravity} output={`${config.gravity.toFixed(2)} m/s²`} min="1.62" max="24.79" step="0.01" onChange={(value) => updateConfig("gravity", value)} />
            <Slider label="Starting Angle" value={config.startAngle} output={`${config.startAngle.toFixed(0)}°`} min="3" max="65" step="1" onChange={(value) => updateConfig("startAngle", value)} />
            <Slider label="Damping" value={config.damping} output={config.damping.toFixed(3)} min="0" max="0.12" step="0.005" onChange={(value) => updateConfig("damping", value)} />
          </section>
        </aside>
      </section>

      <section className="learning-band">
        <article>
          <h2>What The Simulator Shows</h2>
          <p>{insight}</p>
        </article>
        <article>
          <h2>Guided Experiment</h2>
          <ol>
            <li>Choose a length and press Reset.</li>
            <li>Time ten complete swings.</li>
            <li>Divide by ten and compare with <strong>T = 2π√(L/g)</strong>.</li>
          </ol>
        </article>
        <article>
          <h2>Motion Graph</h2>
          <canvas ref={graphCanvas} width="520" height="220" aria-label="Angle over time graph" />
        </article>
      </section>
    </main>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Slider({ label, value, output, min, max, step, onChange }) {
  return (
    <label>
      <span>{label} <output>{output}</output></span>
      <input type="range" min={min} max={max} value={value} step={step} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

createRoot(document.getElementById("root")).render(<App />);
