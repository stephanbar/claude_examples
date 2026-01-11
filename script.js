// DOM Elements
const sourceText = document.getElementById('source-text');
const targetText = document.getElementById('target-text');
const targetLangLabel = document.getElementById('target-lang-label');
const selectedLangSpan = document.getElementById('selected-lang');
const langDropdownBtn = document.getElementById('lang-dropdown-btn');
const langOptions = document.getElementById('lang-options');
const translateBtn = document.getElementById('translate-btn');
const micBtn = document.getElementById('mic-btn');
const speakBtn = document.getElementById('speak-btn');
const clearBtn = document.getElementById('clear-btn');
const copyBtn = document.getElementById('copy-btn');
const charCountSpan = document.getElementById('char-count');
const statusMessage = document.getElementById('status-message');
const transliterationDiv = document.getElementById('transliteration');

// Language data
const languages = {
    'es': 'Spanish',
    'de': 'German',
    'fr': 'French',
    'he': 'Hebrew'
};

// Translation state
let currentTranslation = '';
let selectedLang = 'es';

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
translateBtn.addEventListener('click', translateText);
langDropdownBtn.addEventListener('click', toggleDropdown);
micBtn.addEventListener('click', toggleSpeechRecognition);
speakBtn.addEventListener('click', speakTranslation);
clearBtn.addEventListener('click', clearText);
copyBtn.addEventListener('click', copyTranslation);

// Language option click handlers
document.querySelectorAll('.lang-option').forEach(option => {
    option.addEventListener('click', () => selectLanguage(option));
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!langDropdownBtn.contains(e.target) && !langOptions.contains(e.target)) {
        langOptions.classList.remove('show');
    }
});

// Handle text input
function handleInput() {
    const text = sourceText.value;
    charCountSpan.textContent = text.length;
}

// Toggle dropdown
function toggleDropdown() {
    langOptions.classList.toggle('show');
}

// Select language
function selectLanguage(option) {
    const lang = option.dataset.lang;
    const langName = option.textContent;

    // Update selection
    document.querySelectorAll('.lang-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    option.classList.add('selected');

    selectedLang = lang;
    selectedLangSpan.textContent = langName;
    targetLangLabel.textContent = langName.toUpperCase();

    // Close dropdown
    langOptions.classList.remove('show');

    // Clear previous translation
    targetText.textContent = '';
    transliterationDiv.classList.remove('visible');
    speakBtn.disabled = true;
    copyBtn.disabled = true;
}

// Translate text using MyMemory API with CORS proxy fallback
async function translateText() {
    const text = sourceText.value.trim();

    if (!text) {
        showStatus('Please enter text to translate', 'info');
        return;
    }

    const srcLang = 'en';
    const tgtLang = selectedLang;

    translateBtn.disabled = true;
    translateBtn.innerHTML = `
        Translating...
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
            <circle cx="12" cy="12" r="10"></circle>
        </svg>
    `;

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
            showStatus('Translation successful', 'success');

            // Handle transliteration for Hebrew
            handleTransliteration(currentTranslation, tgtLang);
        } else {
            throw new Error(data.responseDetails || 'Translation failed');
        }
    } catch (error) {
        console.error('Translation error:', error);
        targetText.textContent = 'Translation error. Please try again.';
        showStatus('Translation failed: ' + error.message, 'error');
        speakBtn.disabled = true;
        copyBtn.disabled = true;
    } finally {
        translateBtn.disabled = false;
        translateBtn.innerHTML = `
            Translate
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
        `;
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

    recognition.lang = 'en-US';

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

    // Map language codes to speech synthesis codes
    const langMap = {
        'en': 'en-US',
        'es': 'es-ES',
        'fr': 'fr-FR',
        'de': 'de-DE',
        'he': 'he-IL'
    };

    utterance.lang = langMap[selectedLang] || 'en-US';
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
    charCountSpan.textContent = '0';
    speakBtn.disabled = true;
    copyBtn.disabled = true;
    statusMessage.classList.remove('show');
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
    statusMessage.className = `status-message ${type} show`;

    setTimeout(() => {
        statusMessage.classList.remove('show');
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

    // Set default language
    selectedLangSpan.textContent = 'Spanish';
    targetLangLabel.textContent = 'SPANISH';
});
