document.addEventListener("DOMContentLoaded", () => {
  const auditSection = document.getElementById("audit");
  const questionEl = document.getElementById("auditQuestion");
  const form = document.getElementById("auditForm");
  const answerEl = document.getElementById("auditAnswer");
  const submitBtn = document.getElementById("auditSubmit");
  const loaderEl = document.getElementById("auditLoader");
  const resultEl = document.getElementById("auditResult");

  if (!auditSection || !form) return; // Audit-Bereich nicht auf dieser Seite vorhanden

  // ---------------------------------------------------------------------
  // Puter.js – kein API-Key nötig. puter.ai.chat() läuft komplett
  // client-seitig; Puter übernimmt Modell-Routing und Abrechnung nach dem
  // "User-Pays"-Modell (nicht dein Kontingent, sondern das der besuchenden
  // Person, sofern sie bei Puter eingeloggt ist / andernfalls ein
  // begrenztes Gast-Kontingent). Voraussetzung: das <script
  // src="https://js.puter.com/v2/"> im <head> von index.html.
  // ---------------------------------------------------------------------
  const AI_MODEL = "gpt-5.4-nano"; // schnell & günstig genug für zwei kurze Scherz-Anfragen

  const FALLBACK_QUESTIONS = [
    "Wie viele Kilobyte passen in eine Kaffeetasse?",
    "Wenn ein Toaster traurig ist, welche Farbe hat sein Toast?",
    "Nenne eine Zahl, die nach Montag riecht.",
    "Wie oft muss man einen Algorithmus gießen, damit er wächst?",
    "Beschreibe das Geräusch, das eine Kartoffel beim Nachdenken macht.",
    "Wie viele Ecken hat ein rundes Gefühl?",
    "Was sagt eine Steckdose, wenn sie Geburtstag hat?",
    "Wie schwer ist ein Gedanke, den man schon vergessen hat?"
  ];

  const FALLBACK_EVAL_TEXT =
    "Unser Prüf-Server hatte selbst gerade einen Roboter-Moment (Puter.js nicht erreichbar oder Limit erreicht) – wir werten das vorsichtshalber zu deinen Ungunsten. 🤖";

  let currentQuestion = "";
  let requestInFlight = false;

  function pickFallbackQuestion() {
    return FALLBACK_QUESTIONS[Math.floor(Math.random() * FALLBACK_QUESTIONS.length)];
  }

  // Manche Modelle umschließen kurze Antworten mit Anführungszeichen – die entfernen wir kosmetisch.
  function cleanText(text) {
    return String(text || "")
      .trim()
      .replace(/^["„“]+|["“”]+$/g, "")
      .trim();
  }

  // Grobe, rein kosmetische Einschätzung fürs Farbschema des Ergebnisses.
  function guessVerdictClass(text) {
    const lower = text.toLowerCase();
    const mentionsHuman = lower.includes("mensch");
    const mentionsRobot = lower.includes("roboter");
    return mentionsHuman && !mentionsRobot ? "human" : "robot";
  }

  async function generateQuestion() {
    if (typeof puter === "undefined" || !puter.ai) {
      return { question: pickFallbackQuestion(), isFallback: true };
    }
    try {
      const response = await puter.ai.chat(
        "Stelle eine ganz kurze, lustige Fangfrage (max. 1 Satz), um zu testen, ob der Nutzer ein " +
          "Roboter ist. Antworte ausschließlich auf Deutsch, ohne Anführungszeichen, ohne zusätzlichen " +
          "Text und ohne jegliche politischen oder anderweitig kontroversen Themen.",
        { model: AI_MODEL }
      );
      const text = cleanText(response && response.message && response.message.content);
      if (!text) throw new Error("puter-empty-response");
      return { question: text, isFallback: false };
    } catch (err) {
      console.warn("Bot-Audit: Frage konnte nicht generiert werden, nutze Fallback.", err);
      return { question: pickFallbackQuestion(), isFallback: true };
    }
  }

  async function evaluateAnswer(question, answer) {
    if (typeof puter === "undefined" || !puter.ai) {
      return { text: FALLBACK_EVAL_TEXT, isFallback: true };
    }
    try {
      const prompt =
        'Testfrage: "' + question + '"\n' +
        'Antwort des Nutzers: "' + answer + '"\n\n' +
        "Bewerte in genau 2 humorvollen Sätzen, ob diese Antwort eher von einem echten Roboter oder " +
        "einem Menschen stammt. Antworte ausschließlich auf Deutsch, ohne Anführungszeichen, ohne " +
        "zusätzlichen Text davor oder danach und ohne politische oder anderweitig kontroverse Themen.";
      const response = await puter.ai.chat(prompt, { model: AI_MODEL });
      const text = cleanText(response && response.message && response.message.content);
      if (!text) throw new Error("puter-empty-response");
      return { text, isFallback: false };
    } catch (err) {
      console.warn("Bot-Audit: Antwort konnte nicht bewertet werden, nutze Fallback.", err);
      return { text: FALLBACK_EVAL_TEXT, isFallback: true };
    }
  }

  function renderResult(text) {
    const verdictClass = guessVerdictClass(text);
    resultEl.innerHTML = "";
    resultEl.className = "audit__result audit__result--" + verdictClass;

    const headline = document.createElement("p");
    headline.className = "audit__result-headline";
    headline.textContent = verdictClass === "robot" ? "🤖 Das Urteil der KI:" : "🧑 Das Urteil der KI:";

    const commentEl = document.createElement("p");
    commentEl.className = "audit__result-comment";
    commentEl.textContent = text;

    resultEl.append(headline, commentEl);
    resultEl.hidden = false;
  }

  async function startAudit() {
    questionEl.textContent = "KI generiert Fangfrage...";
    answerEl.disabled = true;
    submitBtn.disabled = true;
    resultEl.hidden = true;
    resultEl.textContent = "";

    const { question } = await generateQuestion();
    currentQuestion = question;
    questionEl.textContent = question;
    answerEl.disabled = false;
    submitBtn.disabled = false;
    answerEl.value = "";
    answerEl.focus();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (requestInFlight) return;

    const answer = answerEl.value.trim();
    if (!answer) {
      answerEl.focus();
      return;
    }

    requestInFlight = true;
    answerEl.disabled = true;
    submitBtn.disabled = true;
    form.hidden = true;
    questionEl.textContent = "Schaltkreise werden analysiert...";
    loaderEl.hidden = false;
    resultEl.hidden = true;

    const { text } = await evaluateAnswer(currentQuestion, answer);

    loaderEl.hidden = true;
    questionEl.textContent = currentQuestion;
    renderResult(text);
    requestInFlight = false;
  });

  document.addEventListener(
    "robot-detected",
    () => {
      auditSection.hidden = false;
      startAudit();
    },
    { once: true }
  );
});
