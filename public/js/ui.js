/**
 * ui.js
 * ─────────────────────────────────────────────────────
 * Pure UI helpers — no business logic.
 * Every function here just updates the DOM.
 */

'use strict';

// ─────────────────────────────────────────────────────
// STATUS DOT + LABEL
// ─────────────────────────────────────────────────────

/**
 * @param {'live'|'think'|'listen'|''} cls
 * @param {string} label
 */
function setStatus(cls, label) {
  ['setupDot', 'intDot'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'dot';
    if (cls) el.classList.add(cls);
  });
  ['setupStatus', 'intStatus'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = label;
  });
}

// ─────────────────────────────────────────────────────
// MIC BUTTON
// ─────────────────────────────────────────────────────

/**
 * @param {'idle'|'recording'|'disabled'} state
 * @param {string} label
 * @param {string} icon  emoji
 */
function setMicUI(state, label, icon) {
  const btn  = document.getElementById('micBtn');
  const lbl  = document.getElementById('micLabel');
  const ico  = document.getElementById('micIcon');

  btn.className = 'mic-btn';
  if (state === 'recording') btn.classList.add('recording');
  if (state === 'disabled')  btn.classList.add('disabled');

  lbl.textContent = label;
  ico.textContent = icon;
}

/** Re-enable the mic button for the user to answer. */
function enableMic() {
  setMicUI('idle', 'Click to speak your answer', '🎤');
  setStatus('listen', 'YOUR TURN');
}

// ─────────────────────────────────────────────────────
// PROGRESS STRIP
// ─────────────────────────────────────────────────────

function updateProgress(currentIndex, total, round) {
  const pct = (currentIndex / total) * 100;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('qCounter').textContent = `Q ${currentIndex + 1} / ${total}`;

  const badge = document.getElementById('roundBadge');
  if (round === 'hr') {
    badge.textContent = 'HR ROUND';
    badge.className   = 'round-badge hr';
  } else if (round === 'tech') {
    badge.textContent = 'TECHNICAL ROUND';
    badge.className   = 'round-badge tech';
  } else {
    badge.textContent = 'CODING ROUND';
    badge.className   = 'round-badge coding';
  }
}

// ─────────────────────────────────────────────────────
// AI TEXT — typewriter effect
// ─────────────────────────────────────────────────────

let typewriterTimer = null;

function typeText(text, elementId, onComplete) {
  const el = document.getElementById(elementId);
  if (!el) { onComplete && onComplete(); return; }

  clearInterval(typewriterTimer);
  el.textContent = '';
  let i = 0;

  typewriterTimer = setInterval(() => {
    el.textContent += text[i];
    i++;
    if (i >= text.length) {
      clearInterval(typewriterTimer);
      onComplete && onComplete();
    }
  }, 24);
}

// ─────────────────────────────────────────────────────
// FEEDBACK PANEL
// ─────────────────────────────────────────────────────

/**
 * Show and populate the feedback panel.
 * @param {{ score:number, good:string, improve:string }} result
 */
function showFeedbackPanel(result) {
  // Score chip
  const chip = document.getElementById('scoreChip');
  chip.textContent = `${result.score}/10`;
  chip.className   = 'score-chip';
  if      (result.score >= 7) chip.classList.add('high');
  else if (result.score >= 4) chip.classList.add('mid');
  else                         chip.classList.add('low');

  // Text
  document.getElementById('fbGood').textContent    = result.good;
  document.getElementById('fbImprove').textContent = result.improve;

  // Show the panel
  document.getElementById('feedbackPanel').style.display = 'block';

  // Enable Next button
  const nextBtn = document.getElementById('nextBtn');
  nextBtn.style.opacity        = '1';
  nextBtn.style.pointerEvents  = 'auto';
}

function hideFeedbackPanel() {
  document.getElementById('feedbackPanel').style.display = 'none';
  // Reset transcript
  document.getElementById('transcript').innerHTML =
    '<span class="placeholder">Your spoken words will appear here in real time…</span>';
  // Disable mic until next question is read
  setMicUI('disabled', 'Waiting for question…', '🎤');
}

/**
 * Show and populate the coding feedback panel.
 */
function showCodingFeedback(result) {
  const chip = document.getElementById('codingScoreChip');
  chip.textContent = `${result.score}/10`;
  chip.className   = 'score-chip';
  if      (result.score >= 7) chip.classList.add('high');
  else if (result.score >= 4) chip.classList.add('mid');
  else                         chip.classList.add('low');

  document.getElementById('codingGood').textContent    = result.good;
  document.getElementById('codingImprove').innerHTML   = result.improve; // Use innerHTML for markdown code blocks if needed

  document.getElementById('codingFeedback').style.display = 'block';
  document.getElementById('submitCodeBtn').disabled = false;
  document.getElementById('submitCodeBtn').textContent = '🚀 Submit Solution';
}

function hideCodingFeedback() {
  document.getElementById('codingFeedback').style.display = 'none';
  document.getElementById('codeEditor').value = '';
}

// ── Handle File Selection ─────────────────────────────
function handleFileSelect(input) {
  const display = document.getElementById('fileNameDisplay');
  if (input.files && input.files[0]) {
    display.textContent = input.files[0].name;
    display.style.color = '#00ffcc';
  } else {
    display.textContent = 'Select Resume (PDF)';
    display.style.color = '#fff';
  }
}

// ── Toggle Resume Input visibility ────────────────────
function toggleResumeInput() {
  const checkbox  = document.getElementById('useResume');
  const container = document.getElementById('resumeContainer');
  if (container) {
    container.style.display = checkbox.checked ? 'block' : 'none';
  }
}

// ─────────────────────────────────────────────────────
// SCREEN SWITCHING
// ─────────────────────────────────────────────────────

function showScreen(screenId) {
  ['setupScreen', 'interviewScreen', 'codingScreen', 'resultsScreen'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = (id === screenId) ? (id === 'codingScreen' ? 'block' : 'flex') : 'none';
  });
}

// ─────────────────────────────────────────────────────
// RESULTS SCREEN
// ─────────────────────────────────────────────────────

function populateResults(hrScore, techScore, overallScore, verdictText) {
  document.getElementById('hrScore').textContent      = hrScore;
  document.getElementById('techScore').textContent    = techScore;
  document.getElementById('overallScore').textContent = overallScore;
  document.getElementById('verdictText').textContent  = verdictText;
}

// Expose globally
window.setStatus         = setStatus;
window.setMicUI          = setMicUI;
window.enableMic         = enableMic;
window.updateProgress    = updateProgress;
window.typeText          = typeText;
window.showFeedbackPanel = showFeedbackPanel;
window.hideFeedbackPanel = hideFeedbackPanel;
window.toggleResumeInput    = toggleResumeInput;
window.handleFileSelect     = handleFileSelect;
window.showScreen           = showScreen;
window.populateResults      = populateResults;
window.showCodingFeedback   = showCodingFeedback;
window.hideCodingFeedback   = hideCodingFeedback;
