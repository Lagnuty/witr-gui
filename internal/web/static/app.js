const state = {
  processes: [],
  ports: [],
  current: null,
  processSort: { key: "MemoryRSS", desc: true },
  portSort: { key: "Port", desc: false },
  lang: localStorage.getItem("witr-lang") || "ru",
};

const $ = (id) => document.getElementById(id);

const i18n = {
  ru: {
    action: "Действие",
    actions: "Действия",
    address: "Адрес",
    allStates: "Все состояния",
    analyze: "Анализ",
    analyzing: "Анализ...",
    apply: "Применить",
    choosePid: "Выбери PID для продолжения",
    children: "Дочерние процессы",
    command: "Команда",
    connecting: "Подключение...",
    copied: "Raw output скопирован.",
    copy: "Копировать",
    details: "Подробнее",
    envEmpty: "Переменные окружения не видны.",
    envFilter: "Фильтр переменных окружения",
    exact: "Точно",
    health: "Состояние",
    inspectEyebrow: "Живой анализ причин",
    inspectPid: "Проверить PID",
    inspectTitle: "Проверь процесс, порт, PID или файл",
    language: "Язык",
    listeningPorts: "Слушающие порты",
    localServer: "Локальный сервер",
    memory: "Память",
    multipleMatches: "Несколько совпадений",
    name: "Имя",
    navInspect: "Проверка",
    navPorts: "Порты",
    navProcesses: "Процессы",
    network: "Сеть",
    networkBindings: "Сетевые привязки",
    noAncestry: "Дерево запуска не найдено.",
    noChildren: "Дочерние процессы не найдены.",
    noListeningPorts: "Слушающие порты не найдены.",
    noResult: "Нет результата",
    noSocket: "Нет состояния сокета для этой цели.",
    noWarnings: "Предупреждений нет.",
    overview: "Обзор",
    pause: "Пауза",
    port: "Порт",
    portFilter: "Поиск порта, протокола, адреса, состояния",
    portsTitle: "Порты",
    process: "Процесс",
    processDetails: "Детали процесса",
    processFilter: "Поиск PID, пользователя, имени, команды",
    processesTitle: "Процессы",
    protocol: "Протокол",
    raw: "Raw",
    ready: "Анализ завершён.",
    resolvedTarget: "Найденная цель",
    resume: "Продолжить",
    runConfirm: "Выполнить",
    shown: "показано",
    socketState: "Состояние сокета",
    source: "Источник",
    started: "Запущен",
    state: "Состояние",
    systemSnapshot: "Снимок системы",
    tagline: "Почему это запущено?",
    target: "Цель",
    targetFile: "Файл",
    targetName: "Имя процесса",
    targetPort: "Порт",
    targetType: "Тип цели",
    tree: "Дерево",
    unknown: "неизвестно",
    user: "Пользователь",
    verbose: "Подробно",
    warnings: "Предупреждения",
  },
  en: {
    action: "Action",
    actions: "Actions",
    address: "Address",
    allStates: "All states",
    analyze: "Analyze",
    analyzing: "Analyzing...",
    apply: "Apply",
    choosePid: "Choose a PID to continue",
    children: "Children",
    command: "Command",
    connecting: "Connecting...",
    copied: "Raw output copied.",
    copy: "Copy",
    details: "Details",
    envEmpty: "No environment variables visible.",
    envFilter: "Filter environment variables",
    exact: "Exact",
    health: "Health",
    inspectEyebrow: "Live process causality",
    inspectPid: "Inspect PID",
    inspectTitle: "Inspect any process, port, PID, or file",
    language: "Language",
    listeningPorts: "Listening ports",
    localServer: "Local server",
    memory: "Memory",
    multipleMatches: "Multiple matches",
    name: "Name",
    navInspect: "Inspect",
    navPorts: "Ports",
    navProcesses: "Processes",
    network: "Network",
    networkBindings: "Network bindings",
    noAncestry: "No ancestry found.",
    noChildren: "No direct children found.",
    noListeningPorts: "No listening ports reported.",
    noResult: "No result",
    noSocket: "No socket state for this target.",
    noWarnings: "No warnings reported.",
    overview: "Overview",
    pause: "Pause",
    port: "Port",
    portFilter: "Search port, protocol, address, state",
    portsTitle: "Ports",
    process: "Process",
    processDetails: "Process details",
    processFilter: "Search PID, user, name, command",
    processesTitle: "Processes",
    protocol: "Protocol",
    raw: "Raw",
    ready: "Analysis complete.",
    resolvedTarget: "Resolved target",
    resume: "Resume",
    runConfirm: "Run",
    shown: "shown",
    socketState: "Socket state",
    source: "Source",
    started: "Started",
    state: "State",
    systemSnapshot: "System snapshot",
    tagline: "Why is this running?",
    target: "Target",
    targetFile: "File",
    targetName: "Process name",
    targetPort: "Port",
    targetType: "Target type",
    tree: "Tree",
    unknown: "unknown",
    user: "User",
    verbose: "Verbose",
    warnings: "Warnings",
  },
};

const t = (key) => i18n[state.lang][key] || i18n.en[key] || key;

const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;
  return element;
};

const cell = (text, className) => node("td", className, text);

const applyI18n = () => {
  document.documentElement.lang = state.lang;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  $("languageSelect").value = state.lang;
  if (!state.current) {
    $("message").textContent = "";
  }
  renderProcesses();
  renderPorts();
  if (state.current) renderResult(state.current.result, state.current.output);
};

const iconSpec = (proc = {}) => {
  const name = `${proc.Command || ""} ${proc.Cmdline || ""}`.toLowerCase();
  if (proc.Container || name.includes("docker") || name.includes("containerd") || name.includes("podman")) {
    return ["CNT", "container"];
  }
  if (proc.Service || name.includes("systemd") || name.includes("svchost") || name.includes("launchd")) {
    return ["SYS", "system"];
  }
  if (/(chrome|edge|firefox|safari|browser|brave|opera)/.test(name)) return ["WEB", "web"];
  if (/(postgres|mysql|mariadb|redis|mongo|sqlite|db)/.test(name)) return ["DB", "database"];
  if (/(nginx|apache|httpd|caddy|traefik|node|bun|deno|uvicorn|gunicorn)/.test(name)) {
    return ["SRV", "server"];
  }
  if (/(powershell|cmd.exe|bash|zsh|fish|terminal|conhost|wt.exe)/.test(name)) return ["SH", "shell"];
  if (/(code|cursor|idea|goland|pycharm|webstorm|devenv)/.test(name)) return ["DEV", "dev"];
  const command = (proc.Command || "?").replace(/\.exe$/i, "");
  return [command.slice(0, 3).toUpperCase() || "APP", "app"];
};

const processIcon = (proc, size = "") => {
  const [label, kind] = iconSpec(proc);
  return node("span", `process-icon ${kind} ${size}`.trim(), label);
};

const processNameCell = (proc) => {
  const wrapper = node("div", "process-name-cell");
  const text = node("span", "", proc.Command || t("unknown"));
  wrapper.append(processIcon(proc), text);
  return wrapper;
};

const api = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || data.Error || "request failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
};

const fmtBytes = (bytes) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Number(bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
};

const fmtDate = (value) => {
  if (!value || value.startsWith("0001-")) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleString();
};

const setMessage = (text, isError = false) => {
  const box = $("message");
  box.textContent = text || "";
  box.classList.toggle("error", isError);
};

const showView = (name) => {
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.querySelectorAll(".nav-button").forEach((button) => button.classList.remove("active"));
  $(`view-${name}`).classList.add("active");
  document.querySelector(`[data-view="${name}"]`).classList.add("active");
};

const showTab = (name) => {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
  document.querySelector(`[data-tab="${name}"]`).classList.add("active");
  $(`tab-${name}`).classList.add("active");
};

const statusText = async () => {
  try {
    const status = await api("/api/status");
    $("serverVersion").textContent = status.version || "dev build";
    $("serverMeta").textContent = `PID ${status.osPid}`;
    document.querySelector(".status-dot").classList.add("ready");
  } catch (error) {
    $("serverMeta").textContent = "Offline";
  }
};

const loadProcesses = async () => {
  state.processes = await api("/api/processes");
  renderProcesses();
};

const loadPorts = async () => {
  state.ports = await api("/api/ports");
  renderPorts();
};

const inspectTarget = async (payload) => {
  setMessage(t("analyzing"));
  $("matchesPanel").classList.add("hidden");
  try {
    const data = await api("/api/analyze", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    renderResult(data.result, data.output);
    setMessage(t("ready"));
  } catch (error) {
    if (error.status === 409 && error.data.matches) {
      renderMatches(error.data.matches);
      $("resultPanel").classList.add("hidden");
      setMessage(error.data.error || "Multiple matches found.");
      return;
    }
    $("resultPanel").classList.add("hidden");
    setMessage(error.message, true);
  }
};

const inspectPID = (pid) => {
  showView("inspect");
  $("targetType").value = "pid";
  $("targetValue").value = String(pid);
  inspectTarget({ type: "pid", value: String(pid), verbose: $("verboseMode").checked });
};

const inspectPort = (port) => {
  showView("inspect");
  $("targetType").value = "port";
  $("targetValue").value = String(port);
  inspectTarget({ type: "port", value: String(port), verbose: $("verboseMode").checked });
};

const renderMatches = (matches) => {
  const list = $("matchesList");
  list.replaceChildren();
  for (const proc of matches) {
    const card = node("div", "match-card");
    const title = node("strong", "", proc.Command || "unknown");
    const pid = node("span", "muted", ` PID ${proc.PID}`);
    const cmd = node("span", "muted mono", proc.Cmdline || "");
    const button = node("button", "", t("inspectPid"));
    button.type = "button";
    button.addEventListener("click", () => inspectPID(proc.PID));
    title.appendChild(pid);
    card.prepend(processIcon(proc, "lg"));
    card.append(title, cmd, button);
    list.appendChild(card);
  }
  $("matchesPanel").classList.remove("hidden");
};

const renderResult = (result, output = {}) => {
  state.current = { result, output };
  if (!result) return;

  const proc = result.Process || {};
  const src = result.Source || {};
  $("resultPanel").classList.remove("hidden");
  $("matchesPanel").classList.add("hidden");
  const icon = processIcon(proc, "lg");
  icon.id = "processIcon";
  $("processIcon").replaceWith(icon);
  $("processName").textContent = proc.Command || result.ResolvedTarget || t("unknown");
  $("processCmd").textContent = proc.Cmdline || proc.Exe || "";
  $("processPid").textContent = proc.PID || "0";
  $("sourceType").textContent = src.Name || src.Type || t("unknown");
  $("processUser").textContent = proc.User || t("unknown");
  $("processHealth").textContent = proc.Health || t("unknown");
  $("processStarted").textContent = fmtDate(proc.StartedAt);

  renderDetails(result);
  renderWarnings(result.Warnings || []);
  renderTree(result);
  renderNetwork(result);
  renderEnv(proc.Env || []);
  renderRaw();
};

const detailRows = (result) => {
  const proc = result.Process || {};
  const src = result.Source || {};
  return [
    [state.lang === "ru" ? "Исполняемый файл" : "Executable", proc.Exe],
    [state.lang === "ru" ? "Рабочая папка" : "Working directory", proc.WorkingDir],
    [state.lang === "ru" ? "Git репозиторий" : "Git repository", proc.GitRepo],
    [state.lang === "ru" ? "Git ветка" : "Git branch", proc.GitBranch],
    ["Container", proc.Container],
    ["Service", proc.Service],
    [state.lang === "ru" ? "Описание источника" : "Source description", src.Description],
    [state.lang === "ru" ? "Unit файл" : "Source unit file", src.UnitFile],
    [state.lang === "ru" ? "Родительский PID" : "Parent PID", proc.PPID],
    ["CPU", proc.CPUPercent ? `${proc.CPUPercent.toFixed(1)}%` : ""],
    ["Memory", proc.MemoryRSS ? `${fmtBytes(proc.MemoryRSS)} (${(proc.MemoryPercent || 0).toFixed(1)}%)` : ""],
    [state.lang === "ru" ? "Потоки" : "Threads", proc.ThreadCount],
    [state.lang === "ru" ? "Файловые дескрипторы" : "File descriptors", proc.FDCount ? `${proc.FDCount} / ${proc.FDLimit || "?"}` : ""],
    [state.lang === "ru" ? "Capabilities" : "Capabilities", (proc.Capabilities || []).join(", ")],
    [state.lang === "ru" ? "Бинарник удалён" : "Binary deleted", proc.ExeDeleted ? (state.lang === "ru" ? "да" : "yes") : (state.lang === "ru" ? "нет" : "no")],
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");
};

const renderDetails = (result) => {
  const dl = $("detailList");
  dl.replaceChildren();
  for (const [key, value] of detailRows(result)) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = key;
    dd.textContent = value;
    dl.append(dt, dd);
  }
};

const renderWarnings = (warnings) => {
  const list = $("warningsList");
  list.replaceChildren();
  if (!warnings.length) {
    const empty = document.createElement("div");
    empty.className = "compact-row muted";
    empty.textContent = t("noWarnings");
    list.appendChild(empty);
    return;
  }
  for (const warning of warnings) {
    const item = document.createElement("div");
    item.className = "warning-item";
    item.textContent = warning;
    list.appendChild(item);
  }
};

const renderTree = (result) => {
  const graph = $("treeGraph");
  graph.replaceChildren();
  const ancestry = result.Ancestry || [];
  ancestry.forEach((proc, index) => {
    const treeNode = document.createElement("div");
    treeNode.className = `tree-node ${index === ancestry.length - 1 ? "current" : ""}`;
    treeNode.style.marginLeft = `${Math.min(index * 24, 180)}px`;
    treeNode.replaceChildren(processIcon(proc), node("span", "", `${proc.Command || t("unknown")} (PID ${proc.PID})`));
    treeNode.addEventListener("click", () => inspectPID(proc.PID));
    graph.appendChild(treeNode);
  });
  if (!ancestry.length) {
    graph.replaceChildren(node("div", "compact-row muted", t("noAncestry")));
  }

  const children = $("childrenList");
  children.replaceChildren();
  const childList = result.Children || [];
  if (!childList.length) {
    children.replaceChildren(node("div", "compact-row muted", t("noChildren")));
    return;
  }
  for (const child of childList.slice(0, 30)) {
    const row = document.createElement("button");
    row.className = "compact-row row-action";
    row.replaceChildren(processIcon(child), node("span", "", `${child.Command || t("unknown")} (PID ${child.PID})`));
    row.addEventListener("click", () => inspectPID(child.PID));
    children.appendChild(row);
  }
};

const renderNetwork = (result) => {
  const proc = result.Process || {};
  const ports = $("listeningPorts");
  ports.replaceChildren();
  const portList = proc.ListeningPorts || [];
  const addrList = proc.BindAddresses || [];
  if (!portList.length) {
    ports.replaceChildren(node("div", "compact-row muted", t("noListeningPorts")));
  } else {
    portList.forEach((port, index) => {
      const row = document.createElement("div");
      row.className = "compact-row";
      row.textContent = `${addrList[index] || "*"}:${port}`;
      ports.appendChild(row);
    });
  }
  $("socketInfo").textContent = result.SocketInfo
    ? JSON.stringify(result.SocketInfo, null, 2)
    : t("noSocket");
};

const renderEnv = (env) => {
  const filter = $("envFilter").value.trim().toLowerCase();
  const visible = env.filter((line) => !filter || line.toLowerCase().includes(filter));
  $("envCount").textContent = `${visible.length} ${t("shown")}`;
  $("envOutput").textContent = visible.length ? visible.join("\n") : t("envEmpty");
};

const renderRaw = () => {
  if (!state.current) return;
  const mode = $("rawMode").value;
  $("rawOutput").textContent = state.current.output[mode] || "";
};

const sortValues = (a, b, key, desc) => {
  const av = a[key] ?? "";
  const bv = b[key] ?? "";
  const result = typeof av === "number" && typeof bv === "number"
    ? av - bv
    : String(av).localeCompare(String(bv));
  return desc ? -result : result;
};

const renderProcesses = () => {
  const filter = $("processFilter").value.trim().toLowerCase();
  const rows = $("processRows");
  rows.replaceChildren();
  const list = state.processes
    .filter((proc) => {
      const haystack = `${proc.PID} ${proc.User || ""} ${proc.Command || ""} ${proc.Cmdline || ""}`.toLowerCase();
      return !filter || haystack.includes(filter);
    })
    .sort((a, b) => sortValues(a, b, state.processSort.key, state.processSort.desc));

  for (const proc of list) {
    const tr = document.createElement("tr");
    const actionCell = document.createElement("td");
    const button = node("button", "row-action", t("details"));
    button.type = "button";
    button.addEventListener("click", () => inspectPID(proc.PID));
    actionCell.appendChild(button);
    tr.append(
      cell(proc.PID, "mono"),
      cell(proc.User || ""),
      (() => {
        const td = cell("");
        td.appendChild(processNameCell(proc));
        return td;
      })(),
      cell(proc.CPUPercent ? `${proc.CPUPercent.toFixed(1)}%` : ""),
      cell(fmtBytes(proc.MemoryRSS)),
      cell(fmtDate(proc.StartedAt)),
      cell(proc.Cmdline || "", "mono"),
      actionCell,
    );
    tr.addEventListener("click", (event) => {
      if (event.target.tagName !== "BUTTON") inspectPID(proc.PID);
    });
    rows.appendChild(tr);
  }
};

const renderPorts = () => {
  const filter = $("portFilter").value.trim().toLowerCase();
  const showAll = $("showAllPorts").checked;
  const rows = $("portRows");
  rows.replaceChildren();
  const list = state.ports
    .filter((port) => {
      if (!showAll && port.State !== "LISTEN" && port.State !== "OPEN") return false;
      const haystack = `${port.Port} ${port.Protocol} ${port.Address} ${port.State} ${port.PID}`.toLowerCase();
      return !filter || haystack.includes(filter);
    })
    .sort((a, b) => sortValues(a, b, state.portSort.key, state.portSort.desc));

  for (const port of list) {
    const tr = document.createElement("tr");
    const actionCell = document.createElement("td");
    actionCell.className = "row-actions";
    const processButton = node("button", "row-action", t("process"));
    processButton.type = "button";
    processButton.disabled = !port.PID;
    processButton.addEventListener("click", () => inspectPID(port.PID));
    const portButton = node("button", "row-action", t("port"));
    portButton.type = "button";
    portButton.addEventListener("click", () => inspectPort(port.Port));
    actionCell.append(processButton, portButton);
    tr.append(
      cell(port.Port, "mono"),
      cell(port.Protocol),
      cell(port.Address),
      cell(port.State),
      cell(port.PID, "mono"),
      actionCell,
    );
    tr.addEventListener("click", (event) => {
      if (event.target.tagName !== "BUTTON") {
        if (port.PID) inspectPID(port.PID);
        else inspectPort(port.Port);
      }
    });
    rows.appendChild(tr);
  }
};

const runAction = async (action) => {
  if (!state.current?.result?.Process?.PID) return;
  const pid = state.current.result.Process.PID;
  const nice = Number($("niceValue").value || 0);
  const label = action === "renice" ? `renice PID ${pid} to ${nice}` : `${action} PID ${pid}`;
  if (!window.confirm(`${t("runConfirm")} ${label}?`)) return;
  try {
    const response = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ pid, action, nice }),
    });
    setMessage(response.message || "Action complete.");
    await loadProcesses().catch(() => {});
  } catch (error) {
    setMessage(error.message, true);
  }
};

const bindEvents = () => {
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => showTab(button.dataset.tab));
  });

  $("inspectForm").addEventListener("submit", (event) => {
    event.preventDefault();
    inspectTarget({
      type: $("targetType").value,
      value: $("targetValue").value,
      exact: $("exactMatch").checked,
      verbose: $("verboseMode").checked,
    });
  });

  $("refreshAll").addEventListener("click", () => Promise.allSettled([loadProcesses(), loadPorts()]));
  $("reloadProcesses").addEventListener("click", loadProcesses);
  $("reloadPorts").addEventListener("click", loadPorts);
  $("processFilter").addEventListener("input", renderProcesses);
  $("portFilter").addEventListener("input", renderPorts);
  $("showAllPorts").addEventListener("change", renderPorts);
  $("envFilter").addEventListener("input", () => {
    renderEnv(state.current?.result?.Process?.Env || []);
  });
  $("rawMode").addEventListener("change", renderRaw);
  $("copyRaw").addEventListener("click", async () => {
    await navigator.clipboard.writeText($("rawOutput").textContent || "");
    setMessage(t("copied"));
  });

  $("languageSelect").addEventListener("change", (event) => {
    state.lang = event.target.value;
    localStorage.setItem("witr-lang", state.lang);
    applyI18n();
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => runAction(button.dataset.action));
  });

  document.querySelectorAll("th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      state.processSort.desc = state.processSort.key === key ? !state.processSort.desc : false;
      state.processSort.key = key;
      renderProcesses();
    });
  });
  document.querySelectorAll("th[data-port-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.portSort;
      state.portSort.desc = state.portSort.key === key ? !state.portSort.desc : false;
      state.portSort.key = key;
      renderPorts();
    });
  });
};

const boot = async () => {
  bindEvents();
  applyI18n();
  await statusText();
  await Promise.allSettled([loadProcesses(), loadPorts()]);
};

boot();
