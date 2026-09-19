/**
 * Aura AI Core Sphere Canvas Renderer
 * Renders an interactive 3D particle sphere reacting dynamically to AI states:
 * - idle: Breathing cyan/purple glow and gentle particle orbit
 * - listening: Expanding sonic waveform rings
 * - thinking: Accelerating electric purple particle vortex
 * - speaking: Harmonic audio frequency pulses and energy ribbons
 */

class AuraSphere {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    
    this.state = 'idle'; // 'idle' | 'listening' | 'thinking' | 'speaking'
    this.audioLevel = 0;
    this.particles = [];
    this.particleCount = 120;
    this.time = 0;
    this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    
    this.init();
  }

  init() {
    this.resize();
    this.createParticles();
    this.bindEvents();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const size = Math.min(rect.width || 360, rect.height || 360);
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = size;
    this.height = size;
    this.cx = size / 2;
    this.cy = size / 2;
    this.baseRadius = size * 0.28;
  }

  createParticles() {
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      // Golden spiral distribution on sphere surface
      const theta = Math.acos(1 - 2 * (i + 0.5) / this.particleCount);
      const phi = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
      
      this.particles.push({
        theta,
        phi,
        baseTheta: theta,
        basePhi: phi,
        size: Math.random() * 2.2 + 1.2,
        speed: (Math.random() * 0.008 + 0.004) * (Math.random() > 0.5 ? 1 : -1),
        colorType: Math.random() > 0.5 ? 'cyan' : 'purple',
        pulseOffset: Math.random() * Math.PI * 2
      });
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());
    
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.targetX = (e.clientX - rect.left - rect.width / 2) * 0.15;
      this.mouse.targetY = (e.clientY - rect.top - rect.height / 2) * 0.15;
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.mouse.targetX = 0;
      this.mouse.targetY = 0;
    });
  }

  setState(newState) {
    this.state = newState;
    const stateBadge = document.getElementById('core-state-badge');
    const stateText = document.getElementById('core-state-text');
    const stateDot = document.getElementById('core-state-dot');
    const audioWaves = document.getElementById('audio-wave-bars');
    const micRipple = document.getElementById('mic-ripple');

    if (!stateBadge || !stateText || !stateDot) return;

    // Reset common styles
    stateBadge.className = "flex items-center space-x-2 px-3.5 py-1 rounded-full bg-charcoal/90 border transition-all";
    stateDot.className = "w-2 h-2 rounded-full animate-ping";

    switch(newState) {
      case 'listening':
        stateBadge.classList.add('border-neon-emerald/60', 'shadow-[0_0_15px_rgba(16,185,129,0.3)]');
        stateText.textContent = "AURA LISTENING...";
        stateText.className = "text-xs font-mono font-bold tracking-widest text-neon-emerald uppercase";
        stateDot.className = "w-2 h-2 rounded-full bg-neon-emerald animate-ping";
        if (audioWaves) audioWaves.style.opacity = '1';
        if (micRipple) micRipple.style.opacity = '1';
        break;

      case 'thinking':
        stateBadge.classList.add('border-neon-purple/60', 'shadow-[0_0_20px_rgba(155,81,224,0.4)]');
        stateText.textContent = "SYNTHESIZING...";
        stateText.className = "text-xs font-mono font-bold tracking-widest text-neon-purple uppercase";
        stateDot.className = "w-2 h-2 rounded-full bg-neon-purple animate-ping";
        if (audioWaves) audioWaves.style.opacity = '0';
        if (micRipple) micRipple.style.opacity = '0';
        break;

      case 'speaking':
        stateBadge.classList.add('border-neon-cyan/60', 'shadow-[0_0_20px_rgba(0,242,254,0.4)]');
        stateText.textContent = "AURA SPEAKING";
        stateText.className = "text-xs font-mono font-bold tracking-widest text-neon-cyan uppercase";
        stateDot.className = "w-2 h-2 rounded-full bg-neon-cyan animate-ping";
        if (audioWaves) audioWaves.style.opacity = '1';
        if (micRipple) micRipple.style.opacity = '0';
        break;

      case 'idle':
      default:
        stateBadge.classList.add('border-neon-cyan/40', 'shadow-[0_0_15px_rgba(0,242,254,0.15)]');
        stateText.textContent = "AURA IDLE";
        stateText.className = "text-xs font-mono font-bold tracking-widest text-neon-cyan uppercase";
        stateDot.className = "w-2 h-2 rounded-full bg-neon-cyan animate-pulse";
        if (audioWaves) audioWaves.style.opacity = '0';
        if (micRipple) micRipple.style.opacity = '0';
        break;
    }
  }

  setAudioLevel(level) {
    this.audioLevel = Math.max(0, Math.min(1, level));
  }

  animate() {
    this.time += 0.02;
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Smooth mouse interpolation
    this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.1;
    this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.1;

    const centerX = this.cx + this.mouse.x;
    const centerY = this.cy + this.mouse.y;

    // Determine state dynamics
    let speedMult = 1.0;
    let radiusPulse = Math.sin(this.time * 2) * 4;
    let coreGlowColor = 'rgba(0, 242, 254, 0.4)';
    let primaryColor = '#00F2FE';
    let secondaryColor = '#9B51E0';

    if (this.state === 'listening') {
      speedMult = 1.4;
      radiusPulse = Math.sin(this.time * 6) * 12 + (this.audioLevel * 18);
      coreGlowColor = 'rgba(16, 185, 129, 0.5)';
      primaryColor = '#10B981';
      secondaryColor = '#00F2FE';
      this.drawAcousticRings(centerX, centerY);
    } else if (this.state === 'thinking') {
      speedMult = 3.5;
      radiusPulse = Math.sin(this.time * 8) * 8 + Math.cos(this.time * 12) * 5;
      coreGlowColor = 'rgba(155, 81, 224, 0.6)';
      primaryColor = '#9B51E0';
      secondaryColor = '#4FACFE';
      this.drawEnergyVortex(centerX, centerY);
    } else if (this.state === 'speaking') {
      speedMult = 2.0;
      radiusPulse = Math.sin(this.time * 4) * 10 + Math.sin(this.time * 10) * 6;
      coreGlowColor = 'rgba(0, 242, 254, 0.5)';
      primaryColor = '#00F2FE';
      secondaryColor = '#9B51E0';
      this.drawHarmonicWaveforms(centerX, centerY);
    }

    const currentRadius = this.baseRadius + radiusPulse;

    // 1. Draw Outer Glowing Plasma Orb
    const radialGrad = this.ctx.createRadialGradient(
      centerX, centerY, currentRadius * 0.2,
      centerX, centerY, currentRadius * 1.3
    );
    radialGrad.addColorStop(0, coreGlowColor);
    radialGrad.addColorStop(0.6, 'rgba(155, 81, 224, 0.15)');
    radialGrad.addColorStop(1, 'transparent');

    this.ctx.fillStyle = radialGrad;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, currentRadius * 1.3, 0, Math.PI * 2);
    this.ctx.fill();

    // 2. Draw Core Solid Sphere with Cyberpunk Edge
    const innerGrad = this.ctx.createRadialGradient(
      centerX - currentRadius * 0.2, centerY - currentRadius * 0.2, currentRadius * 0.1,
      centerX, centerY, currentRadius * 0.95
    );
    innerGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    innerGrad.addColorStop(0.3, primaryColor);
    innerGrad.addColorStop(0.8, secondaryColor);
    innerGrad.addColorStop(1, '#0B0F17');

    this.ctx.fillStyle = innerGrad;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, currentRadius * 0.85, 0, Math.PI * 2);
    this.ctx.fill();

    // 3. Render 3D Orbiting Particle Shell
    this.drawParticles(centerX, centerY, currentRadius, speedMult, primaryColor, secondaryColor);

    requestAnimationFrame(this.animate);
  }

  drawParticles(cx, cy, radius, speedMult, primaryColor, secondaryColor) {
    const rotX = this.time * 0.3 * speedMult + (this.mouse.y * 0.01);
    const rotY = this.time * 0.5 * speedMult + (this.mouse.x * 0.01);

    // Sort particles for 3D depth rendering
    const rendered = this.particles.map(p => {
      let phi = p.phi + (p.speed * speedMult * 10);
      let theta = p.theta;

      // 3D Cartesian coordinates
      let x = radius * Math.sin(theta) * Math.cos(phi);
      let y = radius * Math.sin(theta) * Math.sin(phi);
      let z = radius * Math.cos(theta);

      // Rotate around X axis
      let y1 = y * Math.cos(rotX) - z * Math.sin(rotX);
      let z1 = y * Math.sin(rotX) + z * Math.cos(rotX);

      // Rotate around Y axis
      let x2 = x * Math.cos(rotY) + z1 * Math.sin(rotY);
      let z2 = -x * Math.sin(rotY) + z1 * Math.cos(rotY);

      // 2D Projection
      const fov = 300;
      const scale = fov / (fov + z2 + radius * 0.5);
      const projX = cx + x2 * scale;
      const projY = cy + y1 * scale;
      const alpha = Math.max(0.15, Math.min(1, (z2 + radius) / (2 * radius)));

      return {
        x: projX,
        y: projY,
        z: z2,
        size: p.size * scale,
        alpha,
        color: p.colorType === 'cyan' ? primaryColor : secondaryColor
      };
    });

    rendered.sort((a, b) => a.z - b.z);

    // Render connection lines for close particle pairs
    this.ctx.lineWidth = 0.5;
    for (let i = 0; i < rendered.length; i += 2) {
      const p1 = rendered[i];
      const p2 = rendered[(i + 1) % rendered.length];
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (dist < 40 && p1.z > 0 && p2.z > 0) {
        this.ctx.strokeStyle = `rgba(0, 242, 254, ${p1.alpha * 0.3})`;
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.stroke();
      }
    }

    // Render individual glowing particle nodes
    for (const p of rendered) {
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.alpha;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1.0;
  }

  drawAcousticRings(cx, cy) {
    const ringCount = 3;
    for (let i = 0; i < ringCount; i++) {
      const progress = ((this.time * 1.5 + i * 0.35) % 1);
      const r = this.baseRadius * (1.1 + progress * 0.8);
      const alpha = (1 - progress) * 0.6;
      
      this.ctx.strokeStyle = `rgba(16, 185, 129, ${alpha})`;
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  drawEnergyVortex(cx, cy) {
    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(this.time * 4);
    
    for (let i = 0; i < 4; i++) {
      this.ctx.rotate(Math.PI / 2);
      this.ctx.strokeStyle = `rgba(155, 81, 224, ${0.4 + Math.sin(this.time * 8 + i) * 0.2})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, this.baseRadius * 1.15, 0, Math.PI * 0.3);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  drawHarmonicWaveforms(cx, cy) {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    
    const points = 36;
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const mod = Math.sin(angle * 5 + this.time * 8) * 8 + Math.cos(angle * 3 + this.time * 5) * 4;
      const r = this.baseRadius * 1.08 + mod;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.restore();
  }
}

window.AuraSphere = AuraSphere;
