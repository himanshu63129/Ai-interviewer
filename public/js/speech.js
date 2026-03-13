/**
 * speech.js
 * ─────────────────────────────────────────────────────
 * Handles:
 * 1. Text-to-Speech (TTS) using window.speechSynthesis
 * 2. Speech-to-Text (STT) using window.webkitSpeechRecognition
 * 3. Audio Visualizer (Waveform) using AudioContext
 */

'use strict';

let recognition = null;
let isRecording = false;
let shouldRestart = false; // Flag for auto-restart on timeout
let transcriptBuffer = ''; // Store text across restarts
let audioContext = null;
let analyser = null;
let dataArray = null;
let animationFrameId = null;

// ─────────────────────────────────────────────────────
// 1. TEXT-TO-SPEECH (SPEAK)
// ─────────────────────────────────────────────────────

function speak(text, onEnd) {
  if (!window.speechSynthesis) {
    onEnd && onEnd();
    return;
  }
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const ut = new SpeechSynthesisUtterance(text);
  
  // Try to find a nice natural voice (e.g. Google UK English Female)
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'));
  if (preferred) ut.voice = preferred;

  ut.rate  = 1.0;
  ut.pitch = 1.0;

  ut.onend = () => {
    onEnd && onEnd();
  };

  window.speechSynthesis.speak(ut);
}

function stopSpeaking() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

// ─────────────────────────────────────────────────────
// 2. SPEECH-TO-TEXT (REC)
// ─────────────────────────────────────────────────────

function initRecognition() {
  const SpeechRev = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRev) {
    alert('Web Speech API (Recognition) is not supported in this browser. Please use Chrome.');
    return;
  }

  recognition = new SpeechRev();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    setMicUI('recording', 'Listening... Click to stop', '⏹️');
    startWaveform();
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let currentFinal = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        currentFinal += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    if (currentFinal) transcriptBuffer += currentFinal + ' ';

    const transcriptEl = document.getElementById('transcript');
    transcriptEl.innerHTML = `<span>${transcriptBuffer}</span><span class="interim">${interimTranscript}</span>`;
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    if (event.error === 'not-allowed') {
      document.getElementById('micBanner').style.display = 'block';
      isRecording = false;
      shouldRestart = false;
    }
  };

  recognition.onend = () => {
    if (shouldRestart) {
      console.log('Recognition timed out, restarting...');
      recognition.start();
    } else {
      isRecording = false;
      stopWaveform();
    }
  };
}

function handleMicClick() {
  if (!recognition) initRecognition();
  if (!isRecording) {
    startRecording();
  } else {
    stopRecording();
  }
}

function startRecording() {
  if (!recognition) initRecognition();
  document.getElementById('transcript').innerHTML = ''; 
  transcriptBuffer = '';
  isRecording = true;
  shouldRestart = true;
  recognition.start();
}

function stopRecording() {
  if (!recognition) return;
  shouldRestart = false;
  recognition.stop();
  setMicUI('disabled', 'Processing...', '⏳');
  
  // Wait a small moment for final results to settle
  setTimeout(() => {
    const text = document.getElementById('transcript').innerText.trim();
    if (text) {
      onAnswerReady(text);
    } else {
      setMicUI('idle', 'No speech detected. Try again.', '🎤');
      enableMic();
      isRecording = false;
    }
  }, 1000);
}

function forceStopRecording(msg) {
  if (recognition && isRecording) {
    recognition.stop();
    if (msg) console.log(msg);
  }
}

function checkMicPermission() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(() => {
      document.getElementById('micBanner').style.display = 'none';
    })
    .catch(() => {
      document.getElementById('micBanner').style.display = 'block';
    });
}

// ─────────────────────────────────────────────────────
// 3. AUDIO VISUALIZER
// ─────────────────────────────────────────────────────

function buildWaveform() {
  const container = document.getElementById('waveform');
  if (!container) return;
  container.innerHTML = '';
  // Create 30 bars
  for (let i = 0; i < 30; i++) {
    const bar = document.createElement('div');
    bar.className = 'wave-bar';
    container.appendChild(bar);
  }
}

async function startWaveform() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);

    dataArray = new Uint8Array(analyser.frequencyBinCount);
    updateWaveform();
  } catch (err) {
    console.warn('Could not start waveform visualizer:', err);
  }
}

function updateWaveform() {
  if (!analyser) return;
  analyser.getByteFrequencyData(dataArray);

  const bars = document.querySelectorAll('.wave-bar');
  bars.forEach((bar, i) => {
    // Map frequency data to height
    const val = dataArray[i % dataArray.length] || 0;
    const height = Math.max(6, (val / 255) * 40);
    bar.style.height = height + 'px';
    if (val > 10) bar.classList.add('active');
    else bar.classList.remove('active');
  });

  animationFrameId = requestAnimationFrame(updateWaveform);
}

function stopWaveform() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  if (audioContext) audioContext.close();
  analyser = null;
  const bars = document.querySelectorAll('.wave-bar');
  bars.forEach(bar => {
    bar.style.height = '6px';
    bar.classList.remove('active');
  });
}

// Expose globally
window.speak                = speak;
window.stopSpeaking         = stopSpeaking;
window.handleMicClick       = handleMicClick;
window.forceStopRecording   = forceStopRecording;
window.checkMicPermission   = checkMicPermission;
window.buildWaveform        = buildWaveform;
