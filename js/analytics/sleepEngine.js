/**
 * Sleep Analytics & Sleep Score Engine
 * Computes the 0-100 Sleep Score, manages stage proportions, and generates personalized hygiene advice.
 */
export class SleepEngine {
  constructor() {
    this.storageKey = 'somnawave_sleep_analytics';
    this.currentSession = this.loadCurrentSession();
  }

  loadCurrentSession() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {}

    // Default reference night
    return {
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      totalMinutes: 465, // 7h 45m
      deepMinutes: 115,  // 24.7%
      remMinutes: 105,   // 22.5%
      lightMinutes: 220, // 47.3%
      awakeMinutes: 25,  // 5.5%
      averageHrv: 74,    // ms
      restingHeartRate: 52,
      noiseDisruptions: 3,
      score: 88
    };
  }

  saveSession(session) {
    this.currentSession = session;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(session));
    } catch (e) {}
  }

  calculateSleepScore(session) {
    // 1. Duration (Optimal: 420-540 min / 7-9 hours) -> Max 30 points
    const durationHours = session.totalMinutes / 60;
    let durationScore = 0;
    if (durationHours >= 7 && durationHours <= 9) durationScore = 30;
    else if (durationHours >= 6) durationScore = 24;
    else durationScore = 15;

    // 2. Deep Sleep Percentage (Optimal: 20-25%) -> Max 25 points
    const deepPercent = (session.deepMinutes / session.totalMinutes) * 100;
    let deepScore = 0;
    if (deepPercent >= 20) deepScore = 25;
    else if (deepPercent >= 15) deepScore = 20;
    else deepScore = 12;

    // 3. HRV Recovery & Stability (Optimal rMSSD: > 60 ms) -> Max 25 points
    let hrvScore = 0;
    if (session.averageHrv >= 70) hrvScore = 25;
    else if (session.averageHrv >= 50) hrvScore = 20;
    else hrvScore = 14;

    // 4. Disruption & Room Noise Spikes -> Max 20 points
    let disruptionScore = 20 - (session.noiseDisruptions * 3);
    disruptionScore = Math.max(5, Math.min(20, disruptionScore));

    const totalScore = Math.round(durationScore + deepScore + hrvScore + disruptionScore);
    return Math.min(100, Math.max(0, totalScore));
  }

  getHygieneInsights(session = this.currentSession) {
    const insights = [];

    // Insight 1: Noise Disruption & Masking
    if (session.noiseDisruptions > 2) {
      insights.push({
        type: 'pink',
        icon: '🛡️',
        title: `${session.noiseDisruptions} Room Noise Spikes Detected`,
        description: 'Subtle ambient disturbances were registered between 1 AM and 4 AM. We recommend enabling "Adaptive Pink Noise Masking" at 42dB to neutralize noise shocks.'
      });
    } else {
      insights.push({
        type: 'cyan',
        icon: '✨',
        title: 'Minimal Acoustic Disruptions',
        description: 'Your sleep environment remained acoustically serene throughout the night with excellent soundproofing stability.'
      });
    }

    // Insight 2: HRV & Parasympathetic Recovery
    if (session.averageHrv >= 65) {
      insights.push({
        type: 'cyan',
        icon: '🫀',
        title: 'Optimal Parasympathetic Recovery',
        description: `Average nocturnal HRV reached ${session.averageHrv}ms. Your cardiovascular system achieved deep restorative vagal tone during slow-wave Delta sleep.`
      });
    } else {
      insights.push({
        type: 'indigo',
        icon: '🌿',
        title: 'Elevate Nocturnal HRV',
        description: 'HRV baseline was slightly subdued. Try a 2.5Hz Delta Binaural Beats session 30 minutes before sleep to facilitate nervous system down-regulation.'
      });
    }

    // Insight 3: Deep Sleep Ratio
    const deepPct = Math.round((session.deepMinutes / session.totalMinutes) * 100);
    insights.push({
      type: 'indigo',
      icon: '🌙',
      title: `${deepPct}% Slow-Wave Deep Sleep`,
      description: `You spent ${Math.round(session.deepMinutes / 60 * 10) / 10} hours in restorative NREM Stage 3. Cellular repair and memory consolidation were efficiently maximized.`
    });

    return insights;
  }
}
