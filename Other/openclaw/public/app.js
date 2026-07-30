const STORAGE_KEY = "openclaw-personal:v1";

const elements = {
  profileName: document.getElementById("profile-name"),
  profileRole: document.getElementById("profile-role"),
  profileFocus: document.getElementById("profile-focus"),
  apiEndpoint: document.getElementById("api-endpoint"),
  apiKey: document.getElementById("api-key"),
  modelName: document.getElementById("model-name"),
  temperature: document.getElementById("temperature"),
  streamResponse: document.getElementById("stream-response"),
  systemPrompt: document.getElementById("system-prompt"),
  presetList: document.getElementById("preset-list"),
  addPresetBtn: document.getElementById("add-preset-btn"),
  workspaceNotes: document.getElementById("workspace-notes"),
  exportBtn: document.getElementById("export-btn"),
  importBtn: document.getElementById("import-btn"),
  importFile: document.getElementById("import-file"),
  resetBtn: document.getElementById("reset-btn"),
  chatFeed: document.getElementById("chat-feed"),
  chatForm: document.getElementById("chat-form"),
  chatInput: document.getElementById("chat-input"),
  clearChatBtn: document.getElementById("clear-chat-btn"),
  sendBtn: document.getElementById("send-btn"),
  status: document.getElementById("status"),
  presetTemplate: document.getElementById("preset-template"),
  messageTemplate: document.getElementById("message-template")
};

const defaultState = {
  profile: {
    name: "",
    role: "",
    focus: ""
  },
  connection: {
    endpoint: "https://api.openai.com/v1/chat/completions",
    apiKey: "",
    model: "gpt-4.1-mini",
    temperature: "0.7",
    stream: true
  },
  systemPrompt:
    "You are OpenClaw, my personal AI copilot. Stay practical, calm, sharp, and action-oriented. Prefer concise plans, useful drafts, and honest tradeoffs.",
  notes: "",
  presets: [
    {
      id: crypto.randomUUID(),
      title: "Daily strategist",
      body: "Turn my messy thoughts into a short plan with priorities, blockers, and the next concrete action."
    },
    {
      id: crypto.randomUUID(),
      title: "Draft machine",
      body: "Take my rough idea and turn it into a polished draft in my tone. Keep it clear and direct."
    },
    {
      id: crypto.randomUUID(),
      title: "Hard critic",
      body: "Review the idea skeptically. Find weak spots, hidden assumptions, and what would fail in reality."
    }
  ],
  messages: []
};

let state = loadState();
let isSending = false;

hydrateForm();
renderPresets();
renderMessages();
bindEvents();

function bindEvents() {
  const formInputs = [
    elements.profileName,
    elements.profileRole,
    elements.profileFocus,
    elements.apiEndpoint,
    elements.apiKey,
    elements.modelName,
    elements.temperature,
    elements.streamResponse,
    elements.systemPrompt,
    elements.workspaceNotes
  ];

  for (const input of formInputs) {
    input.addEventListener("input", handleWorkspaceInput);
  }

  elements.addPresetBtn.addEventListener("click", handleAddPreset);
  elements.exportBtn.addEventListener("click", handleExport);
  elements.importBtn.addEventListener("click", () => elements.importFile.click());
  elements.importFile.addEventListener("change", handleImport);
  elements.resetBtn.addEventListener("click", handleReset);
  elements.chatForm.addEventListener("submit", handleChatSubmit);
  elements.clearChatBtn.addEventListener("click", handleClearChat);
}

function handleWorkspaceInput() {
  state.profile.name = cleanText(elements.profileName.value);
  state.profile.role = cleanText(elements.profileRole.value);
  state.profile.focus = elements.profileFocus.value.trim();
  state.connection.endpoint = cleanText(elements.apiEndpoint.value);
  state.connection.apiKey = elements.apiKey.value.trim();
  state.connection.model = cleanText(elements.modelName.value);
  state.connection.temperature = cleanText(elements.temperature.value) || "0.7";
  state.connection.stream = elements.streamResponse.checked;
  state.systemPrompt = elements.systemPrompt.value.trim();
  state.notes = elements.workspaceNotes.value;
  persistState();
}

function handleAddPreset() {
  state.presets.push({
    id: crypto.randomUUID(),
    title: `Preset ${state.presets.length + 1}`,
    body: ""
  });
  persistState();
  renderPresets();
}

function handlePresetChange(id, updates) {
  state.presets = state.presets.map((preset) => (preset.id === id ? { ...preset, ...updates } : preset));
  persistState();
}

function handlePresetUse(id) {
  const preset = state.presets.find((item) => item.id === id);
  if (!preset) return;

  const prefix = preset.body.trim();
  const existing = elements.chatInput.value.trim();
  elements.chatInput.value = existing ? `${prefix}\n\n${existing}` : prefix;
  elements.chatInput.focus();
  updateStatus(`Loaded preset: ${preset.title}`);
}

function handlePresetDelete(id) {
  state.presets = state.presets.filter((preset) => preset.id !== id);
  persistState();
  renderPresets();
}

function handleExport() {
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  anchor.href = url;
  anchor.download = `openclaw-workspace-${stamp}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  updateStatus("Workspace exported.");
}

async function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    state = mergeWithDefaults(parsed);
    persistState();
    hydrateForm();
    renderPresets();
    renderMessages();
    updateStatus("Workspace imported.");
  } catch (error) {
    updateStatus(`Import failed: ${error.message || "invalid file"}`, true);
  } finally {
    elements.importFile.value = "";
  }
}

function handleReset() {
  const confirmed = window.confirm("Reset the whole OpenClaw workspace on this browser?");
  if (!confirmed) return;

  state = structuredClone(defaultState);
  persistState();
  hydrateForm();
  renderPresets();
  renderMessages();
  updateStatus("Workspace reset.");
}

function handleClearChat() {
  if (!state.messages.length) return;
  const confirmed = window.confirm("Clear the current chat history?");
  if (!confirmed) return;

  state.messages = [];
  persistState();
  renderMessages();
  updateStatus("Chat cleared.");
}

async function handleChatSubmit(event) {
  event.preventDefault();
  if (isSending) return;

  const message = elements.chatInput.value.trim();
  if (!message) {
    updateStatus("Write a message first.", true);
    return;
  }

  if (!state.connection.endpoint || !state.connection.model || !state.connection.apiKey) {
    updateStatus("Fill in endpoint, model, and API key before sending.", true);
    return;
  }

  const userMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: message,
    createdAt: new Date().toISOString()
  };

  state.messages.push(userMessage);
  persistState();
  renderMessages();
  elements.chatInput.value = "";

  setSending(true);
  updateStatus(state.connection.stream ? "Streaming response..." : "Waiting for model response...");

  try {
    const assistantMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString()
    };

    state.messages.push(assistantMessage);
    persistState();
    renderMessages();

    const assistantText = await requestAssistantReply((partialText) => {
      updateAssistantMessage(assistantMessage.id, partialText);
    });

    updateAssistantMessage(assistantMessage.id, assistantText);
    persistState();
    updateStatus("Response received.");
  } catch (error) {
    removeEmptyAssistantDraft();
    updateStatus(error.message || "Request failed.", true);
  } finally {
    setSending(false);
  }
}

async function requestAssistantReply(onPartial) {
  const payload = {
    model: state.connection.model,
    temperature: clampTemperature(state.connection.temperature),
    messages: buildMessagesForApi(),
    stream: Boolean(state.connection.stream)
  };

  const response = await fetch(state.connection.endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${state.connection.apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = data?.error?.message || data?.message || `HTTP ${response.status}`;
    throw new Error(detail);
  }

  if (state.connection.stream) {
    return readStreamingResponse(response, onPartial);
  }

  const data = await response.json().catch(() => ({}));
  const text = extractAssistantText(data);
  if (!text) {
    throw new Error("The model response was empty.");
  }
  return text;
}

function buildMessagesForApi() {
  const profileContext = [
    state.profile.name ? `Name: ${state.profile.name}` : "",
    state.profile.role ? `Role: ${state.profile.role}` : "",
    state.profile.focus ? `Current focus: ${state.profile.focus}` : "",
    state.notes ? `Workspace notes:\n${state.notes}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");

  const systemMessage = [state.systemPrompt, profileContext].filter(Boolean).join("\n\n");
  const messages = state.messages.map((item) => ({
    role: item.role,
    content: item.content
  }));

  return [{ role: "system", content: systemMessage }].concat(messages);
}

function extractAssistantText(data) {
  const choice = data?.choices?.[0];
  if (!choice) return "";

  const content = choice?.message?.content;
  if (typeof content === "string") return content.trim();

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

async function readStreamingResponse(response, onPartial) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.body || !contentType.toLowerCase().includes("text/event-stream")) {
    const data = await response.json().catch(() => ({}));
    const text = extractAssistantText(data);
    if (!text) {
      throw new Error("The model response was empty.");
    }
    if (typeof onPartial === "function") {
      onPartial(text);
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() || "";

    for (const event of events) {
      const lines = event
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"));

      for (const line of lines) {
        const data = line.slice(5).trim();
        if (!data) continue;
        if (data === "[DONE]") {
          return fullText.trim();
        }

        try {
          const parsed = JSON.parse(data);
          const deltaText = extractDeltaText(parsed);
          if (!deltaText) continue;
          fullText += deltaText;
          if (typeof onPartial === "function") {
            onPartial(fullText);
          }
        } catch {
          continue;
        }
      }
    }

    if (done) {
      break;
    }
  }

  if (!fullText.trim()) {
    throw new Error("The model response was empty.");
  }
  return fullText.trim();
}

function extractDeltaText(data) {
  const choice = data?.choices?.[0];
  const content = choice?.delta?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        return "";
      })
      .join("");
  }

  return "";
}

function renderPresets() {
  elements.presetList.innerHTML = "";

  if (!state.presets.length) {
    const empty = document.createElement("p");
    empty.className = "chat-empty";
    empty.textContent = "No presets yet. Add one and use it to seed your next chat.";
    elements.presetList.append(empty);
    return;
  }

  state.presets.forEach((preset, index) => {
    const fragment = elements.presetTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".preset-card");
    const label = fragment.querySelector(".preset-label");
    const title = fragment.querySelector(".preset-title");
    const body = fragment.querySelector(".preset-body");
    const useBtn = fragment.querySelector(".preset-use");
    const deleteBtn = fragment.querySelector(".preset-delete");

    label.textContent = `Preset ${index + 1}`;
    title.textContent = preset.title || `Preset ${index + 1}`;
    body.value = preset.body || "";

    title.contentEditable = "true";
    title.spellcheck = false;
    title.addEventListener("blur", () => {
      handlePresetChange(preset.id, { title: cleanText(title.textContent) || `Preset ${index + 1}` });
      renderPresets();
    });

    body.addEventListener("input", () => handlePresetChange(preset.id, { body: body.value }));
    useBtn.addEventListener("click", () => handlePresetUse(preset.id));
    deleteBtn.addEventListener("click", () => handlePresetDelete(preset.id));

    card.dataset.presetId = preset.id;
    elements.presetList.append(fragment);
  });
}

function renderMessages() {
  elements.chatFeed.innerHTML = "";

  if (!state.messages.length) {
    const empty = document.createElement("p");
    empty.className = "chat-empty";
    empty.textContent =
      "Start with a plan request, a rough draft, a review prompt, or a reflection question. Your history stays on this browser.";
    elements.chatFeed.append(empty);
    return;
  }

  state.messages.forEach((message) => {
    const fragment = elements.messageTemplate.content.cloneNode(true);
    const root = fragment.querySelector(".message");
    const role = fragment.querySelector(".message-role");
    const time = fragment.querySelector(".message-time");
    const body = fragment.querySelector(".message-body");

    root.dataset.role = message.role;
    role.textContent = message.role === "assistant" ? "OpenClaw" : "You";
    time.textContent = formatTime(message.createdAt);
    body.textContent = message.content;
    elements.chatFeed.append(fragment);
  });

  elements.chatFeed.scrollTop = elements.chatFeed.scrollHeight;
}

function updateAssistantMessage(messageId, content) {
  const target = state.messages.find((message) => message.id === messageId);
  if (!target) return;
  target.content = content;
  persistState();
  renderMessages();
}

function removeEmptyAssistantDraft() {
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage?.role === "assistant" && !cleanText(lastMessage.content)) {
    state.messages.pop();
    persistState();
    renderMessages();
  }
}

function hydrateForm() {
  elements.profileName.value = state.profile.name;
  elements.profileRole.value = state.profile.role;
  elements.profileFocus.value = state.profile.focus;
  elements.apiEndpoint.value = state.connection.endpoint;
  elements.apiKey.value = state.connection.apiKey;
  elements.modelName.value = state.connection.model;
  elements.temperature.value = state.connection.temperature;
  elements.streamResponse.checked = Boolean(state.connection.stream);
  elements.systemPrompt.value = state.systemPrompt;
  elements.workspaceNotes.value = state.notes;
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return mergeWithDefaults(parsed);
  } catch {
    return structuredClone(defaultState);
  }
}

function mergeWithDefaults(raw) {
  const next = structuredClone(defaultState);
  const source = raw && typeof raw === "object" ? raw : {};

  next.profile = { ...next.profile, ...(source.profile || {}) };
  next.connection = { ...next.connection, ...(source.connection || {}) };
  next.systemPrompt = typeof source.systemPrompt === "string" ? source.systemPrompt : next.systemPrompt;
  next.notes = typeof source.notes === "string" ? source.notes : next.notes;
  next.messages = Array.isArray(source.messages) ? source.messages.filter(isValidMessage) : [];
  next.presets =
    Array.isArray(source.presets) && source.presets.length ? source.presets.map(normalizePreset) : next.presets;
  return next;
}

function normalizePreset(preset, index) {
  return {
    id: typeof preset?.id === "string" && preset.id ? preset.id : crypto.randomUUID(),
    title: cleanText(preset?.title) || `Preset ${index + 1}`,
    body: typeof preset?.body === "string" ? preset.body : ""
  };
}

function isValidMessage(item) {
  return item && typeof item.role === "string" && typeof item.content === "string";
}

function setSending(value) {
  isSending = value;
  elements.sendBtn.disabled = value;
}

function updateStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.style.color = isError ? "var(--danger)" : "";
}

function cleanText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function clampTemperature(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0.7;
  return Math.min(2, Math.max(0, parsed));
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric"
  }).format(date);
}
