/**
 * Sleep Analytics Canvas Charts
 * Renders:
 * 1. Radial Sleep Score Gauge (0-100)
 * 2. Hypnogram Sleep Stage Timeline (Awake, REM, Light, Deep)
 * 3. Nocturnal HRV Trend Graph (rMSSD in ms over nocturnal hours)
 */
export class AnalyticsCharts {
  constructor() {
    this.dpr = window.devicePixelRatio || 1;
  }

  // --- 1. Radial Sleep Score Gauge ---
  renderScoreGauge(canvas, score) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * this.dpr;
    canvas.height = rect.height * this.dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(this.dpr, this.dpr);

    const w = rect.width;
    const h = rect.height;
    const centerX = w / 2;
    const centerY = h / 2;
    const radius = Math.min(centerX, centerY) - 14;
    const startAngle = 0.75 * Math.PI;
    const endAngle = 2.25 * Math.PI;
    const totalAngle = endAngle - startAngle;

    ctx.clearRect(0, 0, w, h);

    // Background Arc
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Active Score Arc
    const scoreFraction = Math.max(0, Math.min(100, score)) / 100;
    const currentEndAngle = startAngle + (totalAngle * scoreFraction);

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#4f46e5');
    grad.addColorStop(0.5, '#8b5cf6');
    grad.addColorStop(1, '#06b6d4');

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, currentEndAngle);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // --- 2. Hypnogram Sleep Stage Timeline ---
  renderHypnogram(canvas, stageHistory) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * this.dpr;
    canvas.height = rect.height * this.dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(this.dpr, this.dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    // Stages from top to bottom
    const stages = [
      { name: 'Awake', y: 0.15, color: '#f59e0b' },
      { name: 'REM',   y: 0.40, color: '#a855f7' },
      { name: 'Light', y: 0.65, color: '#06b6d4' },
      { name: 'Deep',  y: 0.90, color: '#4f46e5' }
    ];

    // Draw horizontal reference lines
    ctx.font = '10px -apple-system, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.lineWidth = 1;

    for (const stage of stages) {
      const yPos = h * stage.y;
      ctx.fillText(stage.name, 4, yPos - 3);

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.moveTo(42, yPos);
      ctx.lineTo(w - 8, yPos);
      ctx.stroke();
    }

    // Default 7-hour hypnogram if no history passed
    const data = stageHistory || [
      { t: 0, s: 'Awake' }, { t: 0.08, s: 'Light' }, { t: 0.18, s: 'Deep' },
      { t: 0.32, s: 'REM' }, { t: 0.42, s: 'Light' }, { t: 0.52, s: 'Deep' },
      { t: 0.70, s: 'Light' }, { t: 0.82, s: 'REM' }, { t: 0.94, s: 'Light' },
      { t: 1.0, s: 'Awake' }
    ];

    // Plot step-line hypnogram
    const startX = 46;
    const usableW = w - startX - 10;

    ctx.beginPath();
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'miter';

    let lastX = startX;
    let lastY = h * 0.15;

    for (let i = 0; i < data.length; i++) {
      const pt = data[i];
      const targetStage = stages.find(s => s.name === pt.s) || stages[2];
      const currentX = startX + (pt.t * usableW);
      const currentY = h * targetStage.y;

      if (i === 0) {
        ctx.moveTo(currentX, currentY);
      } else {
        // Step horizontal then vertical
        ctx.lineTo(currentX, lastY);
        ctx.lineTo(currentX, currentY);
      }

      lastX = currentX;
      lastY = currentY;
    }

    ctx.strokeStyle = '#8b5cf6';
    ctx.stroke();
  }

  // --- 3. Nocturnal HRV Trend Graph ---
  renderHrvTrend(canvas, hrvData) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * this.dpr;
    canvas.height = rect.height * this.dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(this.dpr, this.dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const points = hrvData || [
      { hour: '11PM', val: 45 },
      { hour: '12AM', val: 56 },
      { hour: '1AM',  val: 72 },
      { hour: '2AM',  val: 84 },
      { hour: '3AM',  val: 88 },
      { hour: '4AM',  val: 78 },
      { hour: '5AM',  val: 82 },
      { hour: '6AM',  val: 68 }
    ];

    const paddingLeft = 32;
    const paddingBottom = 20;
    const usableW = w - paddingLeft - 12;
    const usableH = h - paddingBottom - 12;

    // Y Axis labels (30 - 100 ms)
    ctx.font = '9px monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText('90ms', 4, 14);
    ctx.fillText('60ms', 4, usableH / 2 + 8);
    ctx.fillText('30ms', 4, usableH + 6);

    // Gridlines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    [14, usableH / 2 + 8, usableH + 6].forEach(y => {
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y - 4);
      ctx.lineTo(w - 8, y - 4);
      ctx.stroke();
    });

    // Plot Points & Bezier Smooth Curve
    const coords = points.map((p, i) => {
      const x = paddingLeft + (i / (points.length - 1)) * usableW;
      const normalizedY = 1 - ((p.val - 30) / (95 - 30));
      const y = 8 + normalizedY * usableH;
      return { x, y, hour: p.hour };
    });

    // Gradient fill under curve
    const areaGrad = ctx.createLinearGradient(0, 0, 0, h);
    areaGrad.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
    areaGrad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

    ctx.beginPath();
    ctx.moveTo(coords[0].x, usableH + 8);
    coords.forEach(pt => ctx.lineTo(pt.x, pt.y));
    ctx.lineTo(coords[coords.length - 1].x, usableH + 8);
    ctx.closePath();
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // Line curve
    ctx.beginPath();
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.5;
    coords.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();

    // Draw glowing points & X axis hour tags
    coords.forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.fillText(pt.hour, pt.x, h - 4);
    });
  }
}
