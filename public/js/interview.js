/**
 * interview.js
 * ─────────────────────────────────────────────────────
 * The interview state machine.
 */

'use strict';

// ─────────────────────────────────────────────────────
// Interview state
// ─────────────────────────────────────────────────────
const interview = {
  userName    : '',
  jobRole     : '',
  domain      : '',
  expLevel    : '',
  hrCount     : 5,
  techCount   : 5,
  codingCount : 0,
  resume      : '',   // Raw resume text
  resumeData  : null, // Base64 data
  resumeType  : '',   // MIME type
  projectDetails: '', // Details about a specific project
  questions   : [],   // [{round:'hr'|'tech'|'coding', text:string}]
  answers     : [],   // [{question, round, answer, score, good, improve}]
  qIndex      : 0,
};

// ─────────────────────────────────────────────────────
// Ask the current question
// ─────────────────────────────────────────────────────
function askCurrentQuestion() {
  const q     = interview.questions[interview.qIndex];
  const total = interview.questions.length;

  updateProgress(interview.qIndex, total, q.round);

  if (q.round === 'coding') {
    showScreen('codingScreen');
    typeText(q.text, 'codingProblem', () => {
      setStatus('live', 'SPEAKING');
      speak("Here is your coding challenge: " + q.text, () => {
        setStatus('live', 'WAITING');
      });
    });
    return;
  }

  // Voice rounds
  showScreen('interviewScreen');
  typeText(q.text, 'aiText', () => {
    setStatus('live', 'SPEAKING');
    speak(q.text, () => {
      enableMic();
    });
  });
}

// ─────────────────────────────────────────────────────
// Called by speech.js when the user stops recording
// ─────────────────────────────────────────────────────
async function onAnswerReady(answer) {
  const q = interview.questions[interview.qIndex];

  let result;
  try {
    result = await evaluateAnswer(
      q.text, q.round, answer,
      interview.jobRole, interview.expLevel, interview.domain
    );
  } catch (err) {
    console.error('Evaluation failed:', err);
    result = {
      score   : 5,
      good    : 'Answer was recorded.',
      improve : 'Could not auto-evaluate. Please continue to the next question.',
    };
  }

  // Save
  interview.answers.push({
    question : q.text,
    round    : q.round,
    answer,
    score    : result.score,
    good     : result.good,
    improve  : result.improve,
  });

  showFeedbackPanel(result);
  speakFeedback(result);
}

// ─────────────────────────────────────────────────────
// Submit code for evaluation
// ─────────────────────────────────────────────────────
async function submitCode() {
  const q = interview.questions[interview.qIndex];
  const code = document.getElementById('codeEditor').value.trim();

  if (!code) { alert('Please enter your solution.'); return; }

  const btn = document.getElementById('submitCodeBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Evaluating...';

  let result;
  try {
    result = await evaluateCode(q.text, code, interview.jobRole, interview.domain);
  } catch (err) {
    console.error('Code evaluation failed:', err);
    result = {
      score: 5,
      good: 'Code submitted.',
      improve: 'Could not auto-evaluate code. Proceeding to next round.'
    };
  }

  interview.answers.push({
    question: q.text,
    round: 'coding',
    answer: code,
    score: result.score,
    good: result.good,
    improve: result.improve
  });

  showCodingFeedback(result);
  speak(`Your code scored ${result.score} out of 10. Check the analysis on the screen.`);
}

// ─────────────────────────────────────────────────────
// Speak feedback after evaluation
// ─────────────────────────────────────────────────────
function speakFeedback(result) {
  const tone =
    result.score >= 7 ? 'Great job!' :
    result.score >= 4 ? 'Good effort.' :
                        'Here is how to improve.';

  const text = `You scored ${result.score} out of 10. ${tone} ${result.improve}`;

  setStatus('live', 'SPEAKING');
  speak(text, () => { setStatus('live', 'WAITING'); });
}

// ─────────────────────────────────────────────────────
// Move to the next question
// ─────────────────────────────────────────────────────
function nextQuestion() {
  hideFeedbackPanel();
  hideCodingFeedback();

  const nextIndex = interview.qIndex + 1;

  if (nextIndex >= interview.questions.length) {
    showResults();
    return;
  }

  interview.qIndex = nextIndex;
  askCurrentQuestion();
}

// ─────────────────────────────────────────────────────
// Show final results
// ─────────────────────────────────────────────────────
async function showResults() {
  stopSpeaking();
  showScreen('resultsScreen');

  const hrAnswers = interview.answers.filter((a) => a.round === 'hr');
  const techAnswers = interview.answers.filter((a) => a.round === 'tech');
  const avg = (arr) =>
    arr.length ? (arr.reduce((s, a) => s + a.score, 0) / arr.length).toFixed(1) : '—';

  const hrAvg   = avg(hrAnswers);
  const techAvg = avg(techAnswers);
  const overall = avg(interview.answers);

  populateResults(hrAvg, techAvg, overall, 'Generating your verdict…');

  // Get AI verdict
  try {
    const verdict = await generateVerdict(
      interview.userName, interview.jobRole, interview.answers
    );
    populateResults(hrAvg, techAvg, overall, verdict);
    speak(verdict);
  } catch (_) {
    populateResults(hrAvg, techAvg, overall,
      'Great effort! Review your per-question scores and focus on the improvement tips provided.');
  }
}

// ─────────────────────────────────────────────────────
// End interview early
// ─────────────────────────────────────────────────────
function endInterview() {
  if (!confirm('End the interview early and see results?')) return;
  stopSpeaking();
  forceStopRecording('Interview ended.');
  if (interview.answers.length === 0) { restart(); return; }
  showResults();
}

// ─────────────────────────────────────────────────────
// Restart — go back to setup screen
// ─────────────────────────────────────────────────────
function restart() {
  stopSpeaking();
  interview.questions = [];
  interview.answers   = [];
  interview.qIndex    = 0;
  showScreen('setupScreen');
  setStatus('', 'READY');
  const btn = document.getElementById('startBtn');
  btn.disabled    = false;
  btn.textContent = '🚀 Start Interview';
}

// Expose globally
window.interview      = interview;
window.askCurrentQuestion = askCurrentQuestion;
window.onAnswerReady  = onAnswerReady;
window.submitCode     = submitCode;
window.nextQuestion   = nextQuestion;
window.endInterview   = endInterview;
window.restart        = restart;
