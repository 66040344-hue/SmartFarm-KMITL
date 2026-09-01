/**
 * Smart Farm Management KMITL - Interactive Multi-mode Canvas Background Engine
 * High-performance 60FPS particle physics, IoT neural node connections & bio-luminescence.
 */

class AgriCanvasEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    // Configurable Settings
    this.mode = 'network'; // 'network' | 'bio' | 'grid'
    this.speedMultiplier = 1.0;
    this.density = 80;
    this.hyperGlow = true;

    // Mouse Tracking
    this.mouse = {
      x: -1000,
      y: -1000,
      radius: 180,
      active: false
    };

    // Data Storage
    this.nodes = [];
    this.pulses = [];
    this.bioParticles = [];
    this.gridRipples = [];

    this.width = 0;
    this.height = 0;
    this.dpr = window.devicePixelRatio || 1;

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Mouse Listeners
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.active = true;

      // Add bio trail if in bio mode
      if (this.mode === 'bio' && Math.random() < 0.3) {
        this.addBioTrail(e.clientX, e.clientY);
      }
    });

    window.addEventListener('mouseleave', () => {
      this.mouse.active = false;
      this.mouse.x = -1000;
      this.mouse.y = -1000;
    });

    window.addEventListener('click', (e) => {
      this.triggerClickPulse(e.clientX, e.clientY);
    });

    this.createParticles();
    this.animate();
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);

    // Recreate particles on resize
    this.createParticles();
  }

  setMode(newMode) {
    this.mode = newMode;
    this.createParticles();
  }

  setSpeed(speedVal) {
    this.speedMultiplier = parseFloat(speedVal);
  }

  setDensity(countVal) {
    this.density = parseInt(countVal);
    this.createParticles();
  }

  setHyperGlow(active) {
    this.hyperGlow = active;
  }

  createParticles() {
    this.nodes = [];
    this.bioParticles = [];

    const count = this.density;

    if (this.mode === 'network' || this.mode === 'grid') {
      for (let i = 0; i < count; i++) {
        const isGateway = Math.random() < 0.15;
        this.nodes.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          vx: (Math.random() - 0.5) * 0.8 * this.speedMultiplier,
          vy: (Math.random() - 0.5) * 0.8 * this.speedMultiplier,
          radius: isGateway ? Math.random() * 3 + 3 : Math.random() * 2 + 1.5,
          color: isGateway ? '#60EFFF' : (Math.random() < 0.7 ? '#00FF87' : '#00E5FF'),
          isGateway: isGateway,
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: 0.03 + Math.random() * 0.04,
          label: isGateway ? ['GATEWAY_01', 'NODE_IoT', 'SENSOR_EC', 'DRONE_A1'][Math.floor(Math.random() * 4)] : null
        });
      }
    }

    if (this.mode === 'bio') {
      for (let i = 0; i < count * 1.2; i++) {
        this.bioParticles.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: - (Math.random() * 0.6 + 0.3),
          size: Math.random() * 3.5 + 1,
          alpha: Math.random() * 0.8 + 0.2,
          sineOffset: Math.random() * Math.PI * 2,
          color: Math.random() < 0.6 ? '#00FF87' : '#60EFFF'
        });
      }
    }
  }

  addBioTrail(x, y) {
    this.bioParticles.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 1,
      vy: - (Math.random() * 1 + 0.5),
      size: Math.random() * 4 + 2,
      alpha: 1.0,
      sineOffset: Math.random() * Math.PI * 2,
      color: '#00FF87'
    });

    if (this.bioParticles.length > 200) {
      this.bioParticles.shift();
    }
  }

  triggerClickPulse(x, y) {
    // Spawn data pulses along nearest nodes
    if (this.mode === 'network') {
      for (let i = 0; i < this.nodes.length; i++) {
        const n = this.nodes[i];
        const dist = Math.hypot(n.x - x, n.y - y);
        if (dist < 220) {
          this.pulses.push({
            startX: x,
            startY: y,
            targetX: n.x,
            targetY: n.y,
            progress: 0,
            speed: 0.05 + Math.random() * 0.03,
            color: '#60EFFF'
          });
        }
      }
    }

    // Grid ripple effect
    this.gridRipples.push({
      x: x,
      y: y,
      radius: 5,
      maxRadius: 250,
      alpha: 1.0
    });
  }

  animate() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    if (this.mode === 'network') {
      this.updateAndDrawNetwork();
    } else if (this.mode === 'bio') {
      this.updateAndDrawBio();
    } else if (this.mode === 'grid') {
      this.updateAndDrawGrid();
    }

    // Render global click ripples
    this.drawRipples();

    requestAnimationFrame(() => this.animate());
  }

  /* ================= NETWORK MODE ================= */
  updateAndDrawNetwork() {
    const ctx = this.ctx;
    const maxConnDist = 140;

    // Update Nodes position
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      n.x += n.vx * this.speedMultiplier;
      n.y += n.vy * this.speedMultiplier;

      // Bounce off walls
      if (n.x < 0 || n.x > this.width) n.vx *= -1;
      if (n.y < 0 || n.y > this.height) n.vy *= -1;

      // Mouse attraction / repulsion magnetic wave
      if (this.mouse.active) {
        const dx = this.mouse.x - n.x;
        const dy = this.mouse.y - n.y;
        const dist = Math.hypot(dx, dy);

        if (dist < this.mouse.radius) {
          const force = (this.mouse.radius - dist) / this.mouse.radius;
          n.x += (dx / dist) * force * 1.5;
          n.y += (dy / dist) * force * 1.5;
        }
      }

      n.pulse += n.pulseSpeed;
    }

    // Draw Node Links (Connections)
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const n1 = this.nodes[i];
        const n2 = this.nodes[j];
        const dx = n1.x - n2.x;
        const dy = n1.y - n2.y;
        const dist = Math.hypot(dx, dy);

        if (dist < maxConnDist) {
          const alpha = (1 - dist / maxConnDist) * 0.45;
          ctx.beginPath();
          ctx.moveTo(n1.x, n1.y);
          ctx.lineTo(n2.x, n2.y);
          ctx.strokeStyle = `rgba(0, 255, 135, ${alpha})`;
          ctx.lineWidth = n1.isGateway || n2.isGateway ? 1.2 : 0.6;
          ctx.stroke();

          // Random chance to spawn traveling data packet pulse
          if (Math.random() < 0.0006 * this.speedMultiplier) {
            this.pulses.push({
              startX: n1.x,
              startY: n1.y,
              targetX: n2.x,
              targetY: n2.y,
              progress: 0,
              speed: 0.02 + Math.random() * 0.04,
              color: Math.random() < 0.5 ? '#00FF87' : '#60EFFF'
            });
          }
        }
      }

      // Draw Mouse Connections
      if (this.mouse.active) {
        const mDist = Math.hypot(this.mouse.x - this.nodes[i].x, this.mouse.y - this.nodes[i].y);
        if (mDist < this.mouse.radius) {
          const alpha = (1 - mDist / this.mouse.radius) * 0.7;
          ctx.beginPath();
          ctx.moveTo(this.nodes[i].x, this.nodes[i].y);
          ctx.lineTo(this.mouse.x, this.mouse.y);
          ctx.strokeStyle = `rgba(96, 239, 255, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // Draw Nodes
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const pulseSize = n.radius + Math.sin(n.pulse) * 1.2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(n.x, n.y, pulseSize, 0, Math.PI * 2);
      ctx.fillStyle = n.color;

      if (this.hyperGlow) {
        ctx.shadowColor = n.color;
        ctx.shadowBlur = n.isGateway ? 15 : 8;
      }

      ctx.fill();

      // Outer radar ring for Gateways
      if (n.isGateway) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, pulseSize * 2.8, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(96, 239, 255, ${0.3 + Math.sin(n.pulse) * 0.2})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Node tech text label
        if (n.label) {
          ctx.font = '9px Orbitron, sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.fillText(n.label, n.x + 12, n.y + 4);
        }
      }
      ctx.restore();
    }

    // Draw Traveling Data Pulses
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      p.progress += p.speed * this.speedMultiplier;

      const px = p.startX + (p.targetX - p.startX) * p.progress;
      const py = p.startY + (p.targetY - p.startY) * p.progress;

      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      if (this.hyperGlow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
      }
      ctx.fill();
      ctx.restore();

      if (p.progress >= 1) {
        this.pulses.splice(i, 1);
      }
    }
  }

  /* ================= BIO-PARTICLE MODE ================= */
  updateAndDrawBio() {
    const ctx = this.ctx;

    for (let i = 0; i < this.bioParticles.length; i++) {
      const p = this.bioParticles[i];
      p.sineOffset += 0.02 * this.speedMultiplier;
      p.x += Math.sin(p.sineOffset) * 0.6;
      p.y += p.vy * this.speedMultiplier;

      // Wrap around top screen
      if (p.y < -10) {
        p.y = this.height + 10;
        p.x = Math.random() * this.width;
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha * (0.6 + Math.sin(p.sineOffset) * 0.4);

      if (this.hyperGlow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
      }

      ctx.fill();
      ctx.restore();
    }
  }

  /* ================= CYBER GRID MODE ================= */
  updateAndDrawGrid() {
    const ctx = this.ctx;
    this.updateAndDrawNetwork(); // Render base nodes first

    // Draw Cyber Code Matrix Overlay
    ctx.save();
    ctx.font = '10px Orbitron, monospace';
    ctx.fillStyle = 'rgba(0, 255, 135, 0.18)';
    
    const columns = Math.floor(this.width / 120);
    const rows = Math.floor(this.height / 80);

    for (let c = 0; c < columns; c++) {
      for (let r = 0; r < rows; r++) {
        if ((c + r) % 3 === 0) {
          const x = c * 120 + 20;
          const y = r * 80 + 30;
          ctx.fillText(`KMITL_SYS [${c}:${r}]`, x, y);
        }
      }
    }
    ctx.restore();
  }

  /* ================= RIPPLES ================= */
  drawRipples() {
    const ctx = this.ctx;
    for (let i = this.gridRipples.length - 1; i >= 0; i--) {
      const r = this.gridRipples[i];
      r.radius += 4;
      r.alpha -= 0.02;

      ctx.save();
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 255, 135, ${r.alpha})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      if (r.alpha <= 0 || r.radius >= r.maxRadius) {
        this.gridRipples.splice(i, 1);
      }
    }
  }
}

// Global Engine Instance
let canvasEngine = null;

document.addEventListener('DOMContentLoaded', () => {
  canvasEngine = new AgriCanvasEngine('bgCanvas');
});
