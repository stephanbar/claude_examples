// DOM Elements
const sourceText = document.getElementById('source-text');
const targetText = document.getElementById('target-text');
const sourceLang = document.getElementById('source-lang');
const targetLang = document.getElementById('target-lang');
const swapBtn = document.getElementById('swap-languages');
const micBtn = document.getElementById('mic-btn');
const speakBtn = document.getElementById('speak-btn');
const clearBtn = document.getElementById('clear-btn');
const copyBtn = document.getElementById('copy-btn');
const charCount = document.querySelector('.char-count');
const statusMessage = document.getElementById('status-message');
const transliterationDiv = document.getElementById('transliteration');
const translationStatus = document.getElementById('translation-status');

// Translation state
let translationTimeout;
let currentTranslation = '';

// Speech Recognition Setup
let recognition;
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
} else {
    micBtn.disabled = true;
    micBtn.title = 'Speech recognition not supported';
}

// Speech Synthesis Setup
const synth = window.speechSynthesis;

// Event Listeners
sourceText.addEventListener('input', handleInput);
sourceLang.addEventListener('change', translateText);
targetLang.addEventListener('change', translateText);
swapBtn.addEventListener('click', swapLanguages);
micBtn.addEventListener('click', toggleSpeechRecognition);
speakBtn.addEventListener('click', speakTranslation);
clearBtn.addEventListener('click', clearText);
copyBtn.addEventListener('click', copyTranslation);

// Handle text input
function handleInput() {
    const text = sourceText.value;
    charCount.textContent = `${text.length} / 5000`;

    // Clear previous timeout
    clearTimeout(translationTimeout);

    if (text.trim().length > 0) {
        // Debounce translation (wait 500ms after user stops typing)
        translationTimeout = setTimeout(() => {
            translateText();
        }, 500);
    } else {
        targetText.textContent = '';
        transliterationDiv.classList.remove('visible');
        speakBtn.disabled = true;
        copyBtn.disabled = true;
        translationStatus.textContent = 'Translation will appear here';
    }
}

// Translate text using MyMemory API with CORS proxy fallback
async function translateText() {
    const text = sourceText.value.trim();

    if (!text) {
        return;
    }

    const srcLang = sourceLang.value === 'auto' ? 'en' : sourceLang.value;
    const tgtLang = targetLang.value;

    if (srcLang === tgtLang) {
        targetText.textContent = text;
        currentTranslation = text;
        speakBtn.disabled = false;
        copyBtn.disabled = false;
        translationStatus.textContent = 'Same language selected';
        handleTransliteration(text, tgtLang);
        return;
    }

    translationStatus.textContent = 'Translating...';
    targetText.textContent = '';

    try {
        // Using MyMemory Translation API (free, no API key required)
        const langPair = `${srcLang}|${tgtLang}`;
        const baseUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;

        let response;
        let data;

        // Try direct request first
        try {
            response = await fetch(baseUrl);
            data = await response.json();
        } catch (corsError) {
            // If CORS error, try with a CORS proxy
            console.log('Direct request failed, trying CORS proxy...');
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(baseUrl)}`;
            response = await fetch(proxyUrl);
            data = await response.json();
        }

        if (data.responseStatus === 200 || data.responseData) {
            currentTranslation = data.responseData.translatedText;

            // Check for API limit message
            if (currentTranslation.includes('MYMEMORY WARNING')) {
                currentTranslation = currentTranslation.split('MYMEMORY WARNING')[0].trim();
            }

            targetText.textContent = currentTranslation;
            speakBtn.disabled = false;
            copyBtn.disabled = false;
            translationStatus.textContent = 'Translation complete';
            showStatus('Translation successful', 'success');

            // Handle transliteration for Hebrew
            handleTransliteration(currentTranslation, tgtLang);
        } else {
            throw new Error(data.responseDetails || 'Translation failed');
        }
    } catch (error) {
        console.error('Translation error:', error);
        targetText.textContent = 'Translation error. Please try again.';
        translationStatus.textContent = 'Translation failed';
        showStatus('Translation failed: ' + error.message, 'error');
        speakBtn.disabled = true;
        copyBtn.disabled = true;
    }
}

// Handle transliteration for Hebrew
function handleTransliteration(text, lang) {
    if (lang === 'he' && text) {
        const transliterated = transliterateHebrew(text);
        if (transliterated) {
            transliterationDiv.textContent = transliterated;
            transliterationDiv.classList.add('visible');
        } else {
            transliterationDiv.classList.remove('visible');
        }
    } else {
        transliterationDiv.classList.remove('visible');
    }
}

// Simple Hebrew transliteration
function transliterateHebrew(text) {
    const hebrewToLatin = {
        'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v',
        'ז': 'z', 'ח': 'ch', 'ט': 't', 'י': 'y', 'כ': 'k', 'ך': 'kh',
        'ל': 'l', 'מ': 'm', 'ם': 'm', 'נ': 'n', 'ן': 'n', 'ס': 's',
        'ע': "'", 'פ': 'p', 'ף': 'f', 'צ': 'ts', 'ץ': 'ts', 'ק': 'k',
        'ר': 'r', 'ש': 'sh', 'ת': 't',
        // Vowels
        'ַ': 'a', 'ָ': 'a', 'ֶ': 'e', 'ֵ': 'e', 'ִ': 'i', 'ֹ': 'o',
        'ֻ': 'u', 'ְ': '', 'ּ': ''
    };

    let result = '';
    let hasHebrew = false;

    for (let char of text) {
        if (hebrewToLatin[char]) {
            result += hebrewToLatin[char];
            hasHebrew = true;
        } else if (char.match(/[\u0590-\u05FF]/)) {
            result += char;
            hasHebrew = true;
        } else {
            result += char;
        }
    }

    return hasHebrew ? result : '';
}

// Swap languages
function swapLanguages() {
    if (sourceLang.value === 'auto') {
        showStatus('Cannot swap when "Detect Language" is selected', 'error');
        return;
    }

    const tempLang = sourceLang.value;
    const tempText = sourceText.value;

    sourceLang.value = targetLang.value;
    targetLang.value = tempLang;
    sourceText.value = currentTranslation || '';

    if (sourceText.value) {
        translateText();
    }
}

// Speech Recognition
function toggleSpeechRecognition() {
    if (!recognition) {
        showStatus('Speech recognition not supported in this browser', 'error');
        return;
    }

    if (micBtn.classList.contains('recording')) {
        recognition.stop();
        micBtn.classList.remove('recording');
        return;
    }

    const lang = sourceLang.value === 'auto' ? 'en' : sourceLang.value;

    // Map language codes to speech recognition codes
    const langMap = {
        'en': 'en-US',
        'es': 'es-ES',
        'fr': 'fr-FR',
        'de': 'de-DE',
        'he': 'he-IL'
    };

    recognition.lang = langMap[lang] || 'en-US';

    recognition.onstart = function() {
        micBtn.classList.add('recording');
        showStatus('Listening... Speak now', 'info');
    };

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        sourceText.value = transcript;
        handleInput();
        showStatus('Speech recognized successfully', 'success');
    };

    recognition.onerror = function(event) {
        micBtn.classList.remove('recording');
        showStatus(`Speech recognition error: ${event.error}`, 'error');
    };

    recognition.onend = function() {
        micBtn.classList.remove('recording');
    };

    try {
        recognition.start();
    } catch (error) {
        micBtn.classList.remove('recording');
        showStatus('Could not start speech recognition', 'error');
    }
}

// Text to Speech
function speakTranslation() {
    if (!currentTranslation) {
        return;
    }

    // Cancel any ongoing speech
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(currentTranslation);
    const lang = targetLang.value;

    // Map language codes to speech synthesis codes
    const langMap = {
        'en': 'en-US',
        'es': 'es-ES',
        'fr': 'fr-FR',
        'de': 'de-DE',
        'he': 'he-IL'
    };

    utterance.lang = langMap[lang] || 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;

    utterance.onstart = function() {
        speakBtn.classList.add('active');
    };

    utterance.onend = function() {
        speakBtn.classList.remove('active');
    };

    utterance.onerror = function(event) {
        speakBtn.classList.remove('active');
        showStatus('Speech synthesis error', 'error');
    };

    synth.speak(utterance);
}

// Clear text
function clearText() {
    sourceText.value = '';
    targetText.textContent = '';
    transliterationDiv.classList.remove('visible');
    currentTranslation = '';
    charCount.textContent = '0 / 5000';
    speakBtn.disabled = true;
    copyBtn.disabled = true;
    translationStatus.textContent = 'Translation will appear here';
    statusMessage.textContent = '';
    statusMessage.className = 'status-message';
}

// Copy translation
async function copyTranslation() {
    if (!currentTranslation) {
        return;
    }

    try {
        await navigator.clipboard.writeText(currentTranslation);
        showStatus('Translation copied to clipboard', 'success');
        copyBtn.classList.add('active');
        setTimeout(() => {
            copyBtn.classList.remove('active');
        }, 1000);
    } catch (error) {
        showStatus('Failed to copy to clipboard', 'error');
    }
}

// Show status message
function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;

    setTimeout(() => {
        statusMessage.textContent = '';
        statusMessage.className = 'status-message';
    }, 3000);
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Check browser compatibility
    if (!('fetch' in window)) {
        showStatus('Your browser does not support all features', 'error');
    }

    // Set focus on input
    sourceText.focus();
});
