/**
 * app.js
 * ─────────────────────────────────────────────────────
 * Entry point.
 * - Initialises waveform and checks mic permission on load.
 * - Reads the setup form and starts the interview.
 */

'use strict';

// ─────────────────────────────────────────────────────
// Page init
// ─────────────────────────────────────────────────────
window.addEventListener('load', () => {
  buildWaveform();
  checkMicPermission();

  // Pre-load voices (browsers may not have them ready immediately)
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }
});

// ── Helper: Convert File to Base64 ────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // data:application/pdf;base64,... -> extract base64 only
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
}

// ── Start Interview — reads form values, validates, launches
// ─────────────────────────────────────────────────────
async function startInterview() {
  const userName = document.getElementById('userName').value.trim();
  const jobRole  = document.getElementById('jobRole').value.trim();
  const domain   = document.getElementById('domain').value.trim() || 'General';
  const projectDetails = document.getElementById('projectDetails').value.trim();
  const expLevel  = document.getElementById('expLevel').value;
  const qCount    = parseInt(document.getElementById('qCount').value, 10);
  const codeCount = parseInt(document.getElementById('codeCount').value, 10);

  // Resume data
  const useResume   = document.getElementById('useResume').checked;
  const resumeFile  = document.getElementById('resumeFile').files[0];
  let resumeData    = null;

  if (useResume && !resumeFile) {
    alert('Please select a PDF resume file.');
    return;
  }

  // Basic validation
  if (!userName) { alert('Please enter your name.'); return; }
  if (!jobRole)  { alert('Please enter the role you are applying for.'); return; }

  // Save to interview state object (defined in interview.js)
  interview.userName  = userName;
  interview.jobRole   = jobRole;
  interview.domain    = domain;
  interview.expLevel  = expLevel;
  interview.hrCount     = qCount;
  interview.techCount   = qCount;
  interview.codingCount = codeCount;
  interview.projectDetails = projectDetails;
  interview.qIndex      = 0;
  interview.answers     = [];

  // Update UI
  const btn = document.getElementById('startBtn');
  btn.disabled    = true;
  btn.textContent = '⏳ Processing PDF...';
  setStatus('think', 'LOADING');

  // Convert File if needed
  if (useResume && resumeFile) {
    try {
      resumeData = await fileToBase64(resumeFile);
      interview.resumeData = resumeData;
      interview.resumeType = resumeFile.type;
    } catch (e) {
      alert('Failed to read PDF file.');
      btn.disabled = false;
      btn.textContent = '🚀 Start Interview';
      return;
    }
  }

  btn.textContent = '⏳ Generating questions…';

  // Generate questions via Gemini
  try {
    interview.questions = await generateQuestions(
      userName, jobRole, domain, expLevel, qCount, qCount, codeCount, 
      '', // text resume (legacy)
      interview.resumeData, interview.resumeType,
      projectDetails
    );
  } catch (err) {
    alert(
      'Failed to generate questions.\n\n' +
      'Error: ' + err.message + '\n\n' +
      'Please make sure:\n' +
      '  1. node server.js is running\n' +
      '  2. GEMINI_API_KEY is set correctly in .env'
    );
    btn.disabled    = false;
    btn.textContent = '🚀 Start Interview';
    setStatus('', 'READY');
    return;
  }

  // Switch to interview screen
  showScreen('interviewScreen');
  document.getElementById('qCounter').textContent = `Q 1 / ${interview.questions.length}`;

  // Greeting
  const greeting =
    `Hello ${userName}! Welcome to your mock interview for the ${jobRole} position. ` +
    `I'm Alex, your AI interviewer today. ` +
    `We'll start with ${qCount} HR questions, followed by ${qCount} technical questions` +
    (codeCount > 0 ? `, and finally ${codeCount} coding challenges.` : '.') +
    ` When it's your turn, just follow the instructions on the screen. Let's begin!`;

  setStatus('live', 'SPEAKING');
  typeText(greeting, 'aiText', () => {
    speak(greeting, () => {
      askCurrentQuestion();
    });
  });
}

// Expose globally (called from index.html onclick)
window.startInterview = startInterview;
