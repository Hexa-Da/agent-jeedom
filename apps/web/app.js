const MAX_IMAGE_SIDE = 1600;
const MAX_IMAGES = 4;

const $ = (id) => document.getElementById(id);
const els = {
  banner: $("banner"),
  welcome: $("welcome"),
  chat: $("chat"),
  messages: $("messages"),
  status: $("status"),
  composer: $("composer"),
  input: $("input"),
  attachments: $("attachments"),
  file: $("file"),
  send: $("btn-send"),
  attach: $("btn-attach"),
  newButtons: [$("btn-new"), $("welcome-new")],
  resume: $("welcome-resume"),
  profileButton: $("btn-profile"),
  quit: $("btn-quit"),
  profileDialog: $("profile-dialog"),
  profileForm: $("profile-form"),
  profileFields: $("profile-fields"),
  profileCancel: $("profile-cancel"),
};

const state = { busy: false, attachments: [], hasApiKey: true, onboardingDone: false };

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Une erreur est survenue.");
  return body;
}

function showBanner(text, isError = false) {
  els.banner.textContent = text;
  els.banner.classList.toggle("error", isError);
  els.banner.hidden = !text;
}

function setBusy(busy, statusText = "") {
  state.busy = busy;
  for (const el of [els.send, els.attach, els.profileButton, els.quit, els.resume, ...els.newButtons]) {
    el.disabled = busy;
  }
  els.input.disabled = busy;
  els.status.textContent = statusText;
  els.status.hidden = !statusText;
}

function showView(view) {
  els.welcome.hidden = view !== "welcome";
  els.chat.hidden = view !== "chat";
}

// --- Rendu markdown minimal (le texte est échappé avant toute mise en forme) ---

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function renderBlocks(text) {
  const html = [];
  let list = null;
  let paragraph = [];
  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${paragraph.map(inline).join("<br>")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) html.push(`<${list.tag}>${list.items.map((item) => `<li>${inline(item)}</li>`).join("")}</${list.tag}>`);
    list = null;
  };
  for (const line of text.split("\n")) {
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (ordered || bullet) {
      flushParagraph();
      const tag = ordered ? "ol" : "ul";
      if (list && list.tag !== tag) flushList();
      list ??= { tag, items: [] };
      list.items.push((ordered || bullet)[1]);
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return html.join("");
}

function renderMarkdown(text) {
  return text
    .split(/```[^\n]*\n?([\s\S]*?)```/g)
    .map((part, index) => (index % 2 === 1 ? `<pre><code>${escapeHtml(part.replace(/\n$/, ""))}</code></pre>` : renderBlocks(part)))
    .join("");
}

// --- Messages ---

function addMessage(role, text, imageUrls = []) {
  const el = document.createElement("div");
  el.className = `message ${role}`;
  for (const url of imageUrls) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Capture d'écran jointe";
    el.append(img);
  }
  if (role === "assistant") {
    el.insertAdjacentHTML("beforeend", renderMarkdown(text));
  } else {
    el.append(document.createTextNode(text));
  }
  els.messages.append(el);
  els.messages.scrollTop = els.messages.scrollHeight;
  return el;
}

function renderSession(session) {
  els.messages.replaceChildren();
  for (const message of session.messages) {
    const imageNote = message.images ? `[${message.images} capture(s) d'écran jointe(s)] ` : "";
    addMessage(message.role, imageNote + message.text);
  }
  showView("chat");
}

// --- Envoi et streaming ---

async function streamReply({ text, images, hidden }, bubble) {
  const response = await fetch("/api/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, images, hidden }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Une erreur est survenue.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let reply = "";
  let target = bubble;

  const handle = (event) => {
    if (event.type === "delta") {
      reply += event.text;
      target ??= addMessage("assistant", "");
      target.innerHTML = renderMarkdown(reply);
      els.messages.scrollTop = els.messages.scrollHeight;
      els.status.hidden = true;
    } else if (event.type === "status") {
      els.status.textContent = event.text;
      els.status.hidden = false;
    } else if (event.type === "error") {
      throw new Error(event.message);
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separator;
    while ((separator = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      if (chunk.startsWith("data: ")) handle(JSON.parse(chunk.slice(6)));
    }
  }
}

async function sendMessage({ text, images = [], hidden = false }) {
  setBusy(true, "L'assistant réfléchit…");
  if (!hidden) {
    addMessage("user", text || "Voici une capture d'écran.", images.map((image) => image.url));
  }
  try {
    await streamReply({ text, images: images.map(({ data, mimeType }) => ({ data, mimeType })), hidden });
  } catch (err) {
    addMessage("assistant", `⚠️ ${err.message}`);
  } finally {
    setBusy(false);
    els.input.focus();
  }
}

// --- Pièces jointes ---

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => reject(new Error("Image illisible."));
    img.src = url;
  });
}

async function toAttachment(file) {
  const { img, url } = await loadImage(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    return { data: dataUrl.split(",")[1], mimeType: "image/jpeg", url: dataUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function renderAttachments() {
  els.attachments.replaceChildren(
    ...state.attachments.map((attachment, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "attachment";
      const img = document.createElement("img");
      img.src = attachment.url;
      img.alt = "Capture jointe";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.title = "Retirer cette image";
      remove.addEventListener("click", () => {
        state.attachments.splice(index, 1);
        renderAttachments();
      });
      wrapper.append(img, remove);
      return wrapper;
    }),
  );
}

async function addFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    if (state.attachments.length >= MAX_IMAGES) {
      showBanner(`Maximum ${MAX_IMAGES} images par message.`, true);
      break;
    }
    try {
      state.attachments.push(await toAttachment(file));
    } catch (err) {
      showBanner(err.message, true);
    }
  }
  renderAttachments();
}

// --- Conversations ---

async function refreshState() {
  const current = await api("/api/state");
  state.hasApiKey = current.hasApiKey;
  state.onboardingDone = current.onboardingDone;
  return current;
}

async function startNewConversation() {
  setBusy(true, "Préparation de la conversation…");
  try {
    await api("/api/chat/new", { method: "POST" });
    await refreshState();
    renderSession({ messages: [] });
    setBusy(false);
    if (!state.onboardingDone) {
      await sendMessage({
        text: "Lance l'onboarding : lis et suis skills/onboarding/SKILL.md.",
        hidden: true,
      });
    }
  } catch (err) {
    setBusy(false);
    showBanner(err.message, true);
    if (els.chat.hidden) showView("welcome");
  }
}

async function resumeConversation() {
  setBusy(true, "Reprise de la conversation…");
  try {
    const { session } = await api("/api/chat/resume", { method: "POST" });
    renderSession(session);
  } catch (err) {
    showBanner(err.message, true);
  } finally {
    setBusy(false);
  }
}

// --- Mon profil ---

async function openProfile() {
  try {
    const { sections } = await api("/api/profile");
    els.profileFields.replaceChildren(
      ...sections.map((section, index) => {
        const label = document.createElement("label");
        label.textContent = section.title;
        const textarea = document.createElement("textarea");
        textarea.rows = 3;
        textarea.value = section.body;
        textarea.dataset.title = section.title;
        textarea.dataset.index = String(index);
        label.append(textarea);
        return label;
      }),
    );
    els.profileDialog.showModal();
  } catch (err) {
    showBanner(err.message, true);
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const sections = [...els.profileFields.querySelectorAll("textarea")].map((textarea) => ({
    title: textarea.dataset.title,
    body: textarea.value,
  }));
  try {
    await api("/api/profile", { method: "PUT", body: JSON.stringify({ sections }) });
    els.profileDialog.close();
    showBanner("Profil enregistré. Il sera pris en compte dès la prochaine conversation.");
  } catch (err) {
    showBanner(err.message, true);
  }
}

// --- Démarrage ---

async function quit() {
  if (!confirm("Quitter l'assistant ?")) return;
  setBusy(true, "Fermeture en cours…");
  try {
    await api("/api/quit", { method: "POST" });
  } catch {
    // Le serveur s'arrête : la connexion peut se couper avant la réponse.
  }
  document.body.innerHTML = '<main class="welcome"><h2>L\'assistant est fermé.</h2><p>Vous pouvez fermer cette page.</p></main>';
}

els.composer.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = els.input.value.trim();
  if ((!text && state.attachments.length === 0) || state.busy) return;
  const images = state.attachments;
  els.input.value = "";
  state.attachments = [];
  renderAttachments();
  await sendMessage({ text, images });
});

els.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    els.composer.requestSubmit();
  }
});

els.input.addEventListener("paste", (event) => {
  const files = [...(event.clipboardData?.files ?? [])];
  if (files.some((file) => file.type.startsWith("image/"))) {
    event.preventDefault();
    addFiles(files);
  }
});

els.attach.addEventListener("click", () => els.file.click());
els.file.addEventListener("change", async () => {
  await addFiles([...els.file.files]);
  els.file.value = "";
});

for (const button of els.newButtons) button.addEventListener("click", startNewConversation);
els.resume.addEventListener("click", resumeConversation);
els.profileButton.addEventListener("click", openProfile);
els.profileCancel.addEventListener("click", () => els.profileDialog.close());
els.profileForm.addEventListener("submit", saveProfile);
els.quit.addEventListener("click", quit);

async function init() {
  try {
    const current = await refreshState();
    if (!current.hasApiKey) {
      showBanner("L'assistant n'est pas configuré : la clé API Cursor est absente (voir le fichier README).", true);
    }
    if (current.session.active) {
      renderSession(current.session);
    } else if (!current.onboardingDone && current.hasApiKey) {
      await startNewConversation();
    } else {
      els.resume.hidden = !current.session.canResume;
      showView("welcome");
    }
  } catch (err) {
    showBanner(`Impossible de joindre l'assistant : ${err.message}`, true);
  }
}

init();
