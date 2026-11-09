const pad = (value) => String(value).padStart(2, "0");
const initialDate = new Date();
const initialDateKey = (offset) => {
  const date = new Date(initialDate);
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const initialAppData = {
  schemaVersion: 3,
  user: {
    id: "usr_alan123",
    name: "林小安",
    handle: "anlin",
    bio: "每天進步一點點，讓好習慣成為生活的一部分。",
    goal: "探索者",
    color: "avatar-indigo",
    level: 0,
    xp: 0,
    xpToNextLevel: 1000,
    bestStreak: 0,
    currentStreak: 0
  },
  habits: [
    { id: "habit-yoga", name: "晨間瑜伽", time: "07:00", frequency: "每日", xp: 40, icon: "mint", done: false },
    { id: "habit-reading", name: "閱讀 30 分鐘", time: "12:30", frequency: "每日", xp: 30, icon: "blue", done: false },
    { id: "habit-water", name: "喝水 2000 ml", time: "全天", frequency: "8 杯", xp: 20, icon: "orange", done: false },
    { id: "habit-stretch", name: "晚間伸展", time: "21:30", frequency: "每日", xp: 25, icon: "purple", done: false }
  ],
  schedule: {},
  community: {
    posts: [],
    challenges: []
  },
  friends: [],
  settings: { notifications: true, sounds: true, theme: "light", weekStart: "星期一", language: "zh", private: false }
};
const supabaseConfig = window.HABITLY_SUPABASE_CONFIG || {};
const supabaseEnabled = Boolean(window.supabase && supabaseConfig.url && supabaseConfig.anonKey);
const supabaseClient = supabaseEnabled ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey) : null;
function readObject(key, fallback) {
  const clone = () => JSON.parse(JSON.stringify(fallback));
  const stored = localStorage.getItem(key);
  if (!stored) {
    localStorage.setItem(key, JSON.stringify(fallback));
    return clone();
  }
  try {
    return { ...fallback, ...JSON.parse(stored) };
  } catch {
    localStorage.setItem(key, JSON.stringify(fallback));
    return clone();
  }
}
const appData = readObject("habitly-app-data", initialAppData);
if (appData.schemaVersion !== initialAppData.schemaVersion) {
  const resetData = JSON.parse(JSON.stringify(initialAppData));
  Object.keys(appData).forEach((key) => delete appData[key]);
  Object.assign(appData, resetData);
  localStorage.removeItem("habitly-profile");
  localStorage.removeItem("habitly-schedule");
  localStorage.removeItem("habitly-schedule-times");
  localStorage.removeItem("habitly-settings");
}
appData.user = readObject("habitly-profile", { ...initialAppData.user, ...appData.user });
appData.settings = readObject("habitly-settings", initialAppData.settings);
if (!localStorage.getItem("habitly-schedule")) localStorage.setItem("habitly-schedule", "{}");
if (!localStorage.getItem("habitly-schedule-times")) localStorage.setItem("habitly-schedule-times", "{}");
localStorage.setItem("habitly-app-data", JSON.stringify(appData));

const authScreen = document.getElementById("auth-screen");
let authAccounts = {};
try {
  authAccounts = JSON.parse(localStorage.getItem("habitly-accounts") || "{}") || {};
} catch {
  localStorage.removeItem("habitly-accounts");
}
let sessionHandle = supabaseEnabled ? null : localStorage.getItem("habitly-session");
if (!supabaseEnabled && sessionHandle && authAccounts[sessionHandle]?.data) {
  if (appData.user?.handle === sessionHandle) {
    authAccounts[sessionHandle].data = JSON.parse(JSON.stringify(appData));
    localStorage.setItem("habitly-accounts", JSON.stringify(authAccounts));
  }
  Object.keys(appData).forEach((key) => delete appData[key]);
  Object.assign(appData, JSON.parse(JSON.stringify(authAccounts[sessionHandle].data)));
  if (appData.schemaVersion !== initialAppData.schemaVersion) {
    appData.schemaVersion = initialAppData.schemaVersion;
    appData.schedule = {};
    authAccounts[sessionHandle].data = appData;
    localStorage.setItem("habitly-accounts", JSON.stringify(authAccounts));
  }
  localStorage.setItem("habitly-profile", JSON.stringify(appData.user));
  localStorage.setItem("habitly-schedule", JSON.stringify(Object.fromEntries(Object.entries(appData.schedule).map(([key, items]) => [key, (Array.isArray(items) ? items : [items]).map((item) => item.title)]))));
  localStorage.setItem("habitly-schedule-times", JSON.stringify(Object.fromEntries(Object.entries(appData.schedule).map(([key, items]) => [key, (Array.isArray(items) ? items : [items]).map((item) => item.time)]))));
  localStorage.setItem("habitly-app-data", JSON.stringify(appData));
}
document.body.classList.toggle("authenticated", Boolean(sessionHandle && authAccounts[sessionHandle]));
function setAuthError(id, message) {
  document.getElementById(id).textContent = message;
}
document.getElementById("toggle-auth").addEventListener("click", () => {
  const login = document.getElementById("login-form");
  const register = document.getElementById("register-form");
  const registering = register.classList.toggle("hidden");
  login.classList.toggle("hidden", registering);
  document.getElementById("auth-title").textContent = registering ? "建立 Habitly 帳號" : "登入 Habitly";
  document.getElementById("auth-subtitle").textContent = registering ? "建立帳號後開始養成你的第一個習慣。" : "登入後繼續管理你的習慣與日程。";
  document.getElementById("toggle-auth").textContent = registering ? "已經有帳號？登入" : "還沒有帳號？註冊";
});
document.getElementById("register-handle").addEventListener("input", (event) => {
  event.target.value = event.target.value.replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9._-]/g, "");
});
document.getElementById("register-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const handle = document.getElementById("register-handle").value.trim();
  const password = document.getElementById("register-password").value;
  if (supabaseEnabled) {
    registerWithSupabase(handle, password, document.getElementById("register-name").value.trim());
    return;
  }
  if (authAccounts[handle]) {
    setAuthError("register-error", "這個使用者 ID 已經被使用。");
    return;
  }
  authAccounts[handle] = {
    handle,
    password,
    handleChanges: [],
    data: { ...JSON.parse(JSON.stringify(initialAppData)), user: { ...initialAppData.user, name: document.getElementById("register-name").value.trim(), handle } }
  };
  localStorage.setItem("habitly-accounts", JSON.stringify(authAccounts));
  localStorage.setItem("habitly-session", handle);
  window.location.reload();
});
document.getElementById("login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const handle = document.getElementById("login-handle").value.replace(/^@+/, "").trim().toLowerCase();
  if (supabaseEnabled) {
    signInWithSupabase(handle, document.getElementById("login-password").value);
    return;
  }
  const account = authAccounts[handle];
  if (!account || account.password !== document.getElementById("login-password").value) {
    setAuthError("login-error", "使用者 ID 或密碼錯誤。");
    return;
  }
  localStorage.setItem("habitly-session", handle);
  window.location.reload();
});

function persistCurrentData() {
  localStorage.setItem("habitly-profile", JSON.stringify(appData.user));
  localStorage.setItem("habitly-settings", JSON.stringify(appData.settings));
  localStorage.setItem("habitly-schedule", JSON.stringify(Object.fromEntries(Object.entries(appData.schedule).map(([key, items]) => [key, (Array.isArray(items) ? items : [items]).map((item) => item.title)]))));
  localStorage.setItem("habitly-schedule-times", JSON.stringify(Object.fromEntries(Object.entries(appData.schedule).map(([key, items]) => [key, (Array.isArray(items) ? items : [items]).map((item) => item.time)]))));
  localStorage.setItem("habitly-app-data", JSON.stringify(appData));
  if (sessionHandle && authAccounts[sessionHandle]) {
    authAccounts[sessionHandle].data = JSON.parse(JSON.stringify(appData));
    localStorage.setItem("habitly-accounts", JSON.stringify(authAccounts));
  }
  saveRemoteData();
}

function remoteEmail(handle) {
  return `${handle.replace(/[^a-z0-9._-]/g, "")}@habitly.app`;
}

async function saveRemoteData() {
  if (!supabaseEnabled || !supabaseUser) return;
  const { error } = await supabaseClient.from("habitly_profiles").upsert({
    user_id: supabaseUser.id,
    data: JSON.parse(JSON.stringify(appData)),
    updated_at: new Date().toISOString()
  });
  if (error) console.error("無法同步 Habitly 資料：", error.message);
}

async function loadRemoteData(user) {
  const { data, error } = await supabaseClient.from("habitly_profiles").select("data").eq("user_id", user.id).maybeSingle();
  if (error) throw new Error(`無法讀取帳號資料：${error.message}`);
  if (data?.data) {
    Object.keys(appData).forEach((key) => delete appData[key]);
    Object.assign(appData, data.data);
  } else {
    await saveRemoteData();
  }
  appData.user = { ...initialAppData.user, ...appData.user };
  appData.settings = { ...initialAppData.settings, ...appData.settings };
  localStorage.setItem("habitly-app-data", JSON.stringify(appData));
  localStorage.setItem("habitly-profile", JSON.stringify(appData.user));
}

function finishRemoteLogin(user) {
  supabaseUser = user;
  sessionHandle = appData.user.handle;
  Object.assign(profile, appData.user);
  Object.keys(events).forEach((key) => delete events[key]);
  Object.keys(scheduleTimes).forEach((key) => delete scheduleTimes[key]);
  Object.entries(appData.schedule || {}).forEach(([key, schedules]) => {
    const items = Array.isArray(schedules) ? schedules : [schedules];
    events[key] = items.map((schedule) => schedule.title);
    scheduleTimes[key] = items.map((schedule) => schedule.time);
  });
  document.body.classList.add("authenticated");
  renderHabitViews();
  renderCalendar();
  applyProfile();
  formatToday();
}

async function registerWithSupabase(handle, password, displayName) {
  if (!handle || !displayName || password.length < 6) {
    setAuthError("register-error", "請填寫暱稱、使用者 ID，並使用至少 6 個字元的密碼。");
    return;
  }
  const { data, error } = await supabaseClient.auth.signUp({ email: remoteEmail(handle), password });
  if (error) {
    setAuthError("register-error", error.message);
    return;
  }
  if (!data.user) {
    setAuthError("register-error", "註冊失敗，請稍後再試。");
    return;
  }
  appData.user = { ...initialAppData.user, name: displayName, handle, id: data.user.id };
  supabaseUser = data.user;
  await saveRemoteData();
  if (data.session) {
    finishRemoteLogin(data.user);
  } else {
    setAuthError("register-error", "註冊成功，請依郵件完成驗證後登入。");
  }
}

async function signInWithSupabase(handle, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email: remoteEmail(handle), password });
  if (error || !data.user) {
    setAuthError("login-error", error?.message || "使用者 ID 或密碼錯誤。");
    return;
  }
  try {
    await loadRemoteData(data.user);
    finishRemoteLogin(data.user);
  } catch (loadError) {
    setAuthError("login-error", loadError.message);
  }
}

let supabaseUser = null;
if (supabaseEnabled) {
  supabaseClient.auth.getSession().then(async ({ data, error }) => {
    if (error) {
      setAuthError("login-error", `無法取得登入狀態：${error.message}`);
      return;
    }
    if (!data.session) return;
    try {
      await loadRemoteData(data.session.user);
      finishRemoteLogin(data.session.user);
    } catch (loadError) {
      setAuthError("login-error", loadError.message);
    }
  });
}

const views = document.querySelectorAll(".view");
const navItems = document.querySelectorAll(".nav-item[data-view]");

function showView(viewId) {
  views.forEach((view) => view.classList.toggle("active", view.id === viewId));
  navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === viewId));
}

navItems.forEach((item) => item.addEventListener("click", () => showView(item.dataset.view)));
document.querySelectorAll("[data-view-link]").forEach((item) => item.addEventListener("click", () => showView(item.dataset.viewLink)));

const modal = document.getElementById("modal");
const openModalButtons = [document.getElementById("open-add")];
openModalButtons.forEach((button) => button?.addEventListener("click", () => modal.classList.add("open")));
document.getElementById("close-modal").addEventListener("click", () => modal.classList.remove("open"));

const reflectionModal = document.getElementById("reflection-modal");
let reflectionHabit = null;
let reflectionMedia = [];
function openReflection(habit, item, check) {
  reflectionHabit = { habit, item, check, date: dateKey(new Date()) };
  openRecordEditor(reflectionHabit);
}
function openRecordEditor(record) {
  reflectionHabit = record;
  const log = (record.habit.logs || []).find((item) => item.date === record.date);
  document.getElementById("reflection-title").textContent = `${record.habit.name} · ${record.date}`;
  document.getElementById("reflection-status").value = log?.status || (record.date === dateKey(new Date()) ? "in-progress" : "missed");
  document.getElementById("reflection-note").value = log?.note || "";
  document.getElementById("reflection-media").value = "";
  reflectionMedia = [...(log?.media || (log?.photo ? [{ type: "image", data: log.photo }] : []))];
  renderReflectionMedia();
  reflectionModal.classList.add("open");
}
function renderReflectionMedia() {
  const list = document.getElementById("reflection-media-list");
  list.innerHTML = "";
  reflectionMedia.forEach((item, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "reflection-media-wrapper";
    const preview = document.createElement(item.type === "video" ? "video" : "img");
    preview.src = item.data;
    preview.controls = item.type === "video";
    preview.className = "reflection-media-item";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-media";
    remove.textContent = "刪除";
    remove.addEventListener("click", () => {
      reflectionMedia.splice(index, 1);
      renderReflectionMedia();
    });
    wrapper.append(preview, remove);
    list.appendChild(wrapper);
  });
}
function isHabitCompletedOn(habit, key) {
  return Boolean(habit && (habit.logs || []).some((log) => log.date === key && (log.status || "completed") === "completed"));
}
function getHabitStatus(habit, key = dateKey(new Date())) {
  const log = (habit.logs || []).find((item) => item.date === key);
  if (log?.status) return log.status;
  if (isHabitCompletedOn(habit, key)) return "completed";
  return "in-progress";
}
function bindHabitCheck(check, habit) {
  const status = getHabitStatus(habit);
  check.textContent = status === "completed" ? "已完成" : status === "missed" ? "未完成" : "進行中";
  check.classList.toggle("completed-action", status === "completed");
  check.classList.toggle("in-progress-action", status === "in-progress");
  check.addEventListener("click", () => {
    if (status !== "completed") openReflection(habit, check.closest(".habit-item"), check);
  });
}
document.querySelectorAll(".check").forEach((check, index) => bindHabitCheck(check, appData.habits[index] || { name: check.closest(".habit-item").querySelector("strong").textContent, xp: 30, done: false }));
document.getElementById("close-reflection-modal").addEventListener("click", () => { reflectionHabit = null; reflectionModal.classList.remove("open"); });
document.getElementById("reflection-media").addEventListener("change", (event) => {
  const files = [...event.target.files];
  Promise.all(files.map((file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve({ type: file.type.startsWith("video/") ? "video" : "image", data: reader.result, name: file.name }));
    reader.readAsDataURL(file);
  }))).then((media) => {
    reflectionMedia.push(...media);
    renderReflectionMedia();
    event.target.value = "";
  });
});
document.getElementById("save-reflection").addEventListener("click", () => {
  if (!reflectionHabit) return;
  const { habit, item, check, date } = reflectionHabit;
  const note = document.getElementById("reflection-note").value.trim();
  const status = document.getElementById("reflection-status").value;
  const existingLog = (habit.logs || []).find((log) => log.date === date);
  const finishReflection = () => {
    const alreadyCompleted = existingLog?.status === "completed" || (!existingLog?.status && isHabitCompletedOn(habit, date));
    habit.logs = habit.logs || [];
    const log = { date, status, note, media: reflectionMedia };
    const logIndex = habit.logs.findIndex((entry) => entry.date === date);
    if (logIndex >= 0) habit.logs[logIndex] = { ...habit.logs[logIndex], ...log };
    else habit.logs.push(log);
    if (status === "completed" && !alreadyCompleted) {
      appData.user.xp = Number(appData.user.xp || 0) + Number(habit.xp || 0);
      if (appData.user.xp >= Number(appData.user.xpToNextLevel || 1000)) {
        appData.user.level = Number(appData.user.level || 0) + 1;
        appData.user.xpToNextLevel = Number(appData.user.xpToNextLevel || 1000) + 1000;
      }
    } else if (status !== "completed" && alreadyCompleted) {
      appData.user.xp = Math.max(0, Number(appData.user.xp || 0) - Number(habit.xp || 0));
    }
    if (item && check) {
      item.classList.remove("done", "in-progress", "missed", "completed");
      item.classList.add(status);
      check.textContent = status === "completed" ? "已完成" : status === "missed" ? "未完成" : "進行中";
      check.classList.toggle("completed-action", status === "completed");
    }
    Object.assign(profile, appData.user);
    localStorage.setItem("habitly-profile", JSON.stringify(appData.user));
    localStorage.setItem("habitly-app-data", JSON.stringify(appData));
    persistCurrentData();
    applyProfile();
    updateWeeklyCompletionRate();
    renderHabitViews();
    renderHabitDetails();
    reflectionHabit = null;
    reflectionModal.classList.remove("open");
  };
  finishReflection();
});
document.getElementById("complete-reflection").addEventListener("click", () => {
  document.getElementById("reflection-status").value = "completed";
  document.getElementById("save-reflection").click();
});

document.querySelectorAll(".like-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const count = button.querySelector("span");
    const liked = button.classList.toggle("liked");
    button.firstChild.textContent = liked ? "♥ " : "♡ ";
    count.textContent = Number(count.textContent) + (liked ? 1 : -1);
  });
});

document.querySelectorAll(".side-challenge button").forEach((button) => {
  button.addEventListener("click", () => {
    button.textContent = button.textContent === "加入" ? "已加入" : "加入";
    button.classList.toggle("joined");
  });
});

const habitFrequencyType = document.getElementById("habit-frequency-type");
const habitWeekdayOptions = document.getElementById("habit-weekday-options");
const habitCustomFrequencyField = document.getElementById("habit-custom-frequency-field");
const habitTimeType = document.getElementById("habit-time-type");
const habitTimeRange = document.getElementById("habit-time-range");
const habitStartTime = document.getElementById("habit-start-time");
const habitEndTime = document.getElementById("habit-end-time");
const habitXpPreview = document.getElementById("habit-xp-preview");
function calculateHabitXp(timeType, startTime, endTime) {
  if (timeType === "all-day") return 100;
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const duration = (endHour * 60 + endMinute - (startHour * 60 + startMinute)) / 60;
  return duration > 0 ? Math.round(duration * 30) : 0;
}
function updateHabitTimeFields() {
  const allDay = habitTimeType.value === "all-day";
  habitTimeRange.classList.toggle("hidden", allDay);
  const xp = calculateHabitXp(habitTimeType.value, habitStartTime.value, habitEndTime.value);
  habitXpPreview.textContent = xp > 0 ? `預計獎勵：${xp} XP` : "結束時間必須晚於開始時間";
}
habitFrequencyType.addEventListener("change", () => {
  const weekly = habitFrequencyType.value === "weekly";
  const custom = habitFrequencyType.value === "custom";
  habitWeekdayOptions.classList.toggle("hidden", !weekly);
  habitCustomFrequencyField.classList.toggle("hidden", !custom);
});
habitTimeType.addEventListener("change", updateHabitTimeFields);
habitStartTime.addEventListener("input", updateHabitTimeFields);
habitEndTime.addEventListener("input", updateHabitTimeFields);
updateHabitTimeFields();

document.getElementById("create-habit").addEventListener("click", () => {
  const name = document.getElementById("habit-name").value.trim();
  if (!name) {
    document.getElementById("habit-name").focus();
    return;
  }
  const frequencyType = habitFrequencyType.value;
  const weekdays = [...habitWeekdayOptions.querySelectorAll("input:checked")].map((input) => Number(input.value));
  if (frequencyType === "weekly" && weekdays.length === 0) {
    window.alert("請至少選擇一個星期。");
    return;
  }
  const customFrequency = document.getElementById("habit-custom-frequency").value.trim();
  if (frequencyType === "custom" && !customFrequency) {
    document.getElementById("habit-custom-frequency").focus();
    return;
  }
  const timeType = habitTimeType.value;
  const startTime = habitStartTime.value;
  const endTime = habitEndTime.value;
  const xp = calculateHabitXp(timeType, startTime, endTime);
  if (timeType === "range" && xp <= 0) {
    window.alert("結束時間必須晚於開始時間。");
    habitEndTime.focus();
    return;
  }
  const habit = {
    id: `habit-${Date.now()}`,
    name,
    time: timeType === "all-day" ? "整天" : `${startTime}-${endTime}`,
    timeType,
    startTime: timeType === "all-day" ? null : startTime,
    endTime: timeType === "all-day" ? null : endTime,
    frequency: frequencyType === "daily" ? "每日" : frequencyType === "weekly" ? `每週${weekdays.map((day) => ["日", "一", "二", "三", "四", "五", "六"][day]).join("、")}` : customFrequency,
    frequencyType,
    weekdays,
    customFrequency,
    xp,
    icon: "purple",
    done: false
  };
  appData.habits.push(habit);
  if (frequencyType !== "custom") createAutomaticSchedules(habit);
  localStorage.setItem("habitly-app-data", JSON.stringify(appData));
  persistCurrentData();
  renderHabitViews();
  renderCalendar();
  modal.classList.remove("open");
  document.getElementById("habit-name").value = "";
  document.getElementById("habit-custom-frequency").value = "";
  document.getElementById("habit-frequency-type").value = "daily";
  habitFrequencyType.dispatchEvent(new Event("change"));
  habitTimeType.value = "range";
  habitStartTime.value = "08:00";
  habitEndTime.value = "09:00";
  updateHabitTimeFields();
  habitWeekdayOptions.querySelectorAll("input").forEach((input) => { input.checked = false; });
});

const calendarGrid = document.getElementById("calendar-grid");
const storedEvents = JSON.parse(localStorage.getItem("habitly-schedule") || "{}");
const scheduleTimes = JSON.parse(localStorage.getItem("habitly-schedule-times") || "{}");
const events = Object.keys(storedEvents).some((key) => key.length === 2)
  ? Object.fromEntries(Object.entries(storedEvents).map(([day, title]) => [`2024-10-${day.padStart(2, "0")}`, title]))
  : storedEvents;
Object.keys(appData.schedule).forEach((key) => {
  appData.schedule[key] = (Array.isArray(appData.schedule[key]) ? appData.schedule[key] : [appData.schedule[key]]).map((schedule, index) => ({
    ...schedule,
    id: schedule.id || `schedule-${key}-${index}`
  }));
});
Object.keys(events).forEach((key) => {
  events[key] = Array.isArray(events[key]) ? events[key] : [events[key]];
});
Object.keys(scheduleTimes).forEach((key) => {
  scheduleTimes[key] = Array.isArray(scheduleTimes[key]) ? scheduleTimes[key] : [scheduleTimes[key]];
});
Object.entries(appData.schedule).forEach(([key, schedules]) => {
  events[key] = schedules.map((schedule) => schedule.title);
  scheduleTimes[key] = schedules.map((schedule) => schedule.time);
});
let calendarDate = new Date();
calendarDate.setDate(1);
let selectedScheduleDate = null;
let editingScheduleDate = null;
let editingScheduleId = null;
const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
function createAutomaticSchedules(habit) {
  const start = new Date();
  const isDaily = habit.frequencyType === "daily" || habit.frequency === "每日" || habit.frequency === "每天";
  const isWeekly = habit.frequencyType === "weekly";
  for (let offset = 0; offset < 90; offset += 1) {
    const date = new Date(start);
    date.setHours(0, 0, 0, 0);
    date.setDate(start.getDate() + offset);
    const matches = isDaily || (isWeekly && (habit.weekdays || []).includes(date.getDay()));
    if (!matches) continue;
    const key = dateKey(date);
    if (!Array.isArray(appData.schedule[key])) appData.schedule[key] = [];
    if (appData.schedule[key].some((schedule) => schedule.habitId === habit.id)) continue;
    events[key] = events[key] || [];
    scheduleTimes[key] = scheduleTimes[key] || [];
    events[key].push(habit.name);
    scheduleTimes[key].push(habit.time);
    appData.schedule[key].push({
      id: `schedule-${habit.id}-${key}`,
      habitId: habit.id,
      title: habit.name,
      time: habit.time,
      note: ""
    });
  }
}
appData.habits.filter((habit) => habit.frequencyType === "daily" || habit.frequencyType === "weekly" || habit.frequency === "每日" || habit.frequency === "每天")
  .forEach((habit) => createAutomaticSchedules(habit));
persistCurrentData();
function markMissedSchedules() {
  const today = dateKey(new Date());
  let changed = false;
  Object.entries(appData.schedule).forEach(([key, schedules]) => {
    schedules.forEach((schedule) => {
      if (key >= today || schedule.status === "completed" || isHabitCompletedOn(appData.habits.find((habit) => habit.id === schedule.habitId), key)) return;
      if (schedule.status !== "missed") {
        schedule.status = "missed";
        changed = true;
      }
    });
  });
  if (changed) persistCurrentData();
}
function renderCalendar() {
  calendarGrid.innerHTML = "";
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  document.getElementById("calendar-title").textContent = `${year} 年 ${month + 1} 月`;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPreviousMonth = new Date(year, month, 0).getDate();
  const todayKey = dateKey(new Date());
  for (let index = 0; index < 42; index += 1) {
    const cell = document.createElement("div");
    const dayNumber = index - firstDay + 1;
    let cellDate;
    if (dayNumber < 1) {
      cellDate = new Date(year, month - 1, daysInPreviousMonth + dayNumber);
      cell.className = "calendar-cell muted";
    } else if (dayNumber > daysInMonth) {
      cellDate = new Date(year, month + 1, dayNumber - daysInMonth);
      cell.className = "calendar-cell muted";
    } else {
      cellDate = new Date(year, month, dayNumber);
      cell.className = "calendar-cell";
    }
    const key = dateKey(cellDate);
    cell.dataset.date = key;
    cell.textContent = cellDate.getDate();
    if (key === todayKey) cell.classList.add("today");
    if (!cell.classList.contains("muted")) {
      if (events[key]?.length) {
        const event = document.createElement("div");
        event.className = "calendar-event";
        event.textContent = `${events[key].length} 個習慣`;
        cell.appendChild(event);
      }
      cell.addEventListener("click", () => openDayScheduleModal(key));
    }
    calendarGrid.appendChild(cell);
  }
}
const dayScheduleModal = document.getElementById("day-schedule-modal");
let selectedDayScheduleDate = null;
function updateScheduleTimeOptions(habit, selectedTime = "") {
  const timeSelect = document.getElementById("schedule-time");
  timeSelect.innerHTML = "";
  if (!habit) {
    timeSelect.add(new Option("請先選擇習慣", ""));
    return;
  }
  const options = [];
  if (habit.timeType === "all-day" || habit.time === "整天" || habit.time === "全天") {
    options.push({ value: "整天", label: "整天" });
  } else if (habit.startTime && habit.endTime) {
    options.push({ value: `${habit.startTime}-${habit.endTime}`, label: `${habit.startTime} - ${habit.endTime}` });
  } else if (habit.time) {
    options.push({ value: habit.time, label: habit.time });
  }
  if (selectedTime && !options.some((option) => option.value === selectedTime)) {
    options.push({ value: selectedTime, label: `${selectedTime}（目前日程）` });
  }
  options.forEach((option) => timeSelect.add(new Option(option.label, option.value)));
  if (selectedTime) timeSelect.value = selectedTime;
}
function removeSchedule(key) {
  delete events[key];
  delete scheduleTimes[key];
  delete appData.schedule[key];
  persistCurrentData();
  renderCalendar();
  renderHabitViews();
}
function removeScheduleItem(key, scheduleId) {
  const schedules = (appData.schedule[key] || []).filter((schedule) => schedule.id !== scheduleId);
  if (schedules.length) {
    appData.schedule[key] = schedules;
    events[key] = schedules.map((schedule) => schedule.title);
    scheduleTimes[key] = schedules.map((schedule) => schedule.time);
  } else {
    delete appData.schedule[key];
    delete events[key];
    delete scheduleTimes[key];
  }
  persistCurrentData();
  renderCalendar();
  renderHabitViews();
}
function openDayScheduleModal(key) {
  selectedDayScheduleDate = key;
  const date = new Date(`${key}T00:00:00`);
  document.getElementById("day-schedule-title").textContent = `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  const list = document.getElementById("day-schedule-list");
  list.innerHTML = "";
  const schedules = appData.schedule[key] || [];
  if (!schedules.length) {
    list.innerHTML = "<p class=\"modal-help\">這天目前沒有安排。</p>";
  } else {
    schedules.forEach((schedule) => {
      const item = document.createElement("div");
      item.className = "day-schedule-item";
      const status = isHabitCompletedOn(appData.habits.find((habit) => habit.id === schedule.habitId), key)
        ? "completed"
        : schedule.status || "in-progress";
      item.innerHTML = `<div><strong></strong><span></span><em></em></div><div class="day-schedule-actions"><button class="text-btn edit-schedule-item" type="button">編輯</button><button class="text-btn delete-schedule-item" type="button">刪除</button></div>`;
      item.querySelector("strong").textContent = schedule.title;
      item.querySelector("span").textContent = schedule.time || "整天";
      item.querySelector("em").textContent = status === "completed" ? "已完成" : status === "missed" ? "未完成" : "進行中";
      item.querySelector(".edit-schedule-item").addEventListener("click", () => {
        dayScheduleModal.classList.remove("open");
        openScheduleModal(key, schedule.id);
      });
      item.querySelector(".delete-schedule-item").addEventListener("click", () => {
        removeScheduleItem(key, schedule.id);
        openDayScheduleModal(key);
      });
      list.appendChild(item);
    });
  }
  dayScheduleModal.classList.add("open");
}
function openScheduleModal(key, scheduleId = null) {
  selectedScheduleDate = key;
  editingScheduleDate = key;
  editingScheduleId = scheduleId;
  const dateInput = document.getElementById("schedule-date");
  const habitSelect = document.getElementById("schedule-habit");
  habitSelect.innerHTML = '<option value="">請選擇習慣</option>';
  appData.habits.forEach((habit) => {
    const option = document.createElement("option");
    option.value = habit.id;
    option.textContent = habit.name;
    habitSelect.appendChild(option);
  });
  const date = key ? new Date(`${key}T00:00:00`) : null;
  document.getElementById("schedule-date-title").textContent = date ? `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日` : "新增日程";
  dateInput.value = key || "";
  const existing = (appData.schedule[key] || []).find((schedule) => schedule.id === scheduleId);
  habitSelect.value = existing?.habitId || "";
  updateScheduleTimeOptions(appData.habits.find((habit) => habit.id === habitSelect.value), existing?.time || "");
  document.getElementById("schedule-note").value = existing?.note || "";
  scheduleModal.classList.add("open");
}
document.getElementById("calendar-prev").addEventListener("click", () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); });
document.getElementById("calendar-next").addEventListener("click", () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); });
document.getElementById("calendar-today").addEventListener("click", () => { calendarDate = new Date(); calendarDate.setDate(1); renderCalendar(); });
document.getElementById("open-add-calendar").addEventListener("click", () => openScheduleModal(null));
const scheduleModal = document.getElementById("schedule-modal");
document.getElementById("close-day-schedule-modal").addEventListener("click", () => dayScheduleModal.classList.remove("open"));
document.getElementById("close-day-schedule").addEventListener("click", () => dayScheduleModal.classList.remove("open"));
document.getElementById("add-day-schedule").addEventListener("click", () => {
  dayScheduleModal.classList.remove("open");
  openScheduleModal(selectedDayScheduleDate);
});
document.getElementById("close-schedule-modal").addEventListener("click", () => scheduleModal.classList.remove("open"));
document.getElementById("schedule-habit").addEventListener("change", (event) => {
  updateScheduleTimeOptions(appData.habits.find((habit) => habit.id === event.target.value));
});
document.getElementById("save-schedule").addEventListener("click", () => {
  const dateValue = document.getElementById("schedule-date").value;
  const habitId = document.getElementById("schedule-habit").value;
  const habit = appData.habits.find((item) => item.id === habitId);
  if (!dateValue || !habit) return;
  selectedScheduleDate = dateValue;
  const title = habit.name;
  const time = document.getElementById("schedule-time").value;
  const existingSchedule = editingScheduleId
    ? (appData.schedule[editingScheduleDate] || []).find((item) => item.id === editingScheduleId)
    : null;
  if (editingScheduleId && editingScheduleDate !== dateValue) {
    const previousSchedules = (appData.schedule[editingScheduleDate] || []).filter((item) => item.id !== editingScheduleId);
    if (previousSchedules.length) {
      appData.schedule[editingScheduleDate] = previousSchedules;
      events[editingScheduleDate] = previousSchedules.map((item) => item.title);
      scheduleTimes[editingScheduleDate] = previousSchedules.map((item) => item.time);
    } else {
      delete appData.schedule[editingScheduleDate];
      delete events[editingScheduleDate];
      delete scheduleTimes[editingScheduleDate];
    }
  }
  const schedules = appData.schedule[selectedScheduleDate] || [];
  if (schedules.some((schedule) => schedule.habitId === habitId && schedule.id !== editingScheduleId)) {
    window.alert("這個習慣已經安排在當天。");
    return;
  }
  const schedule = {
    ...existingSchedule,
    id: editingScheduleId || `schedule-${Date.now()}`,
    habitId,
    title,
    time,
    note: document.getElementById("schedule-note").value.trim()
  };
  if (editingScheduleId) {
    const index = schedules.findIndex((item) => item.id === editingScheduleId);
    if (index >= 0) schedules[index] = schedule;
    else schedules.push(schedule);
  } else {
    schedules.push(schedule);
  }
  appData.schedule[selectedScheduleDate] = schedules;
  events[selectedScheduleDate] = schedules.map((item) => item.title);
  scheduleTimes[selectedScheduleDate] = schedules.map((item) => item.time);
  localStorage.setItem("habitly-schedule", JSON.stringify(events));
  localStorage.setItem("habitly-schedule-times", JSON.stringify(scheduleTimes));
  localStorage.setItem("habitly-app-data", JSON.stringify(appData));
  persistCurrentData();
  renderCalendar();
  renderHabitViews();
  scheduleModal.classList.remove("open");
});
document.getElementById("delete-schedule").addEventListener("click", () => {
  if (selectedScheduleDate === null) return;
  removeSchedule(selectedScheduleDate);
  scheduleModal.classList.remove("open");
});
renderCalendar();

const profileModal = document.getElementById("profile-modal");
const profileDefaults = { ...initialAppData.user, ...appData.user };
const savedProfile = localStorage.getItem("habitly-profile");
const profile = savedProfile ? { ...profileDefaults, ...JSON.parse(savedProfile) } : { ...profileDefaults };
profile.handle = profile.handle.replace(/^@+/, "");
const profileNameInput = document.getElementById("profile-name-input");
const profileHandleInput = document.getElementById("profile-handle-input");
const profileBioInput = document.getElementById("profile-bio-input");
const profileGoalInput = document.getElementById("profile-goal-input");
const currentPasswordInput = document.getElementById("current-password-input");
const newPasswordInput = document.getElementById("new-password-input");
const confirmPasswordInput = document.getElementById("confirm-password-input");
profileHandleInput.addEventListener("input", () => {
  profileHandleInput.value = profileHandleInput.value.replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9._-]/g, "");
});

function recentHandleChanges(account) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  account.handleChanges = (account.handleChanges || []).filter((timestamp) => Number(timestamp) > cutoff);
  return account.handleChanges;
}

function updateHandleChangeHint() {
  const account = authAccounts[sessionHandle];
  if (!account) return;
  const changes = recentHandleChanges(account);
  const remaining = Math.max(2 - changes.length, 0);
  document.getElementById("handle-change-hint").textContent = `30 天內最多可更改 2 次，目前剩餘 ${remaining} 次`;
}

function applyProfile() {
  document.querySelectorAll(".profile-name").forEach((element) => { element.textContent = profile.name; });
  document.querySelectorAll(".profile-handle").forEach((element) => { element.textContent = `@${profile.handle}`; });
  document.querySelectorAll(".profile-avatar").forEach((element) => {
    element.textContent = profile.name.slice(0, 1);
    element.classList.remove("avatar-indigo", "avatar-coral", "avatar-green", "avatar-purple");
    element.classList.add(profile.color);
  });
  document.querySelector(".profile-card span:not(.more-btn)").textContent = `Level ${profile.level || 1} · ${profile.goal}`;
  const xp = Number(profile.xp || 0);
  const level = Number(profile.level || 1);
  const nextLevelXp = Number(profile.xpToNextLevel || xp + 1);
  document.getElementById("user-xp").firstChild.textContent = xp.toLocaleString();
  document.getElementById("user-level").textContent = `Lv.${level}`;
  document.getElementById("user-xp-next").textContent = `${Math.max(nextLevelXp - xp, 0).toLocaleString()} XP to Lv.${level + 1}`;
  document.getElementById("user-xp-progress").style.width = `${Math.min((xp / nextLevelXp) * 100, 100)}%`;
  document.getElementById("user-best-streak").firstChild.textContent = Number(profile.bestStreak || 0);
}

function openProfileModal() {
  profileNameInput.value = profile.name;
  profileHandleInput.value = profile.handle;
  profileBioInput.value = profile.bio;
  profileGoalInput.value = profile.goal;
  currentPasswordInput.value = "";
  newPasswordInput.value = "";
  confirmPasswordInput.value = "";
  updateHandleChangeHint();
  document.querySelectorAll(".color-choice").forEach((choice) => choice.classList.toggle("selected", choice.dataset.color === profile.color));
  profileModal.classList.add("open");
}

document.getElementById("edit-profile").addEventListener("click", openProfileModal);
document.getElementById("top-profile").addEventListener("click", openProfileModal);
document.getElementById("close-profile-modal").addEventListener("click", () => profileModal.classList.remove("open"));
document.querySelectorAll(".color-choice").forEach((choice) => {
  choice.addEventListener("click", () => {
    profile.color = choice.dataset.color;
    document.querySelectorAll(".color-choice").forEach((item) => item.classList.toggle("selected", item === choice));
  });
});
document.getElementById("save-profile").addEventListener("click", () => {
  const name = profileNameInput.value.trim();
  if (!name) {
    profileNameInput.focus();
    return;
  }
  const nextHandle = profileHandleInput.value.replace(/^@+/, "").trim().toLowerCase();
  const account = authAccounts[sessionHandle];
  if (!account && !supabaseEnabled) return;
  const handleChanged = nextHandle !== profile.handle;
  if (!/^[a-z0-9._-]{1,30}$/.test(nextHandle)) {
    window.alert("使用者 ID 只能使用英文字母、數字、句點、底線或連字號。");
    profileHandleInput.focus();
    return;
  }
  if (handleChanged) {
    if (account) {
      const changes = recentHandleChanges(account);
      if (changes.length >= 2) {
        window.alert("使用者 ID 在 30 天內最多只能更改 2 次。");
        profileHandleInput.focus();
        return;
      }
      if (authAccounts[nextHandle] && nextHandle !== sessionHandle) {
        window.alert("這個使用者 ID 已經被使用。");
        profileHandleInput.focus();
        return;
      }
    }
  }
  const wantsPasswordChange = currentPasswordInput.value || newPasswordInput.value || confirmPasswordInput.value;
  if (wantsPasswordChange) {
    if (supabaseEnabled) {
      if (!newPasswordInput.value || newPasswordInput.value.length < 6 || newPasswordInput.value !== confirmPasswordInput.value) {
        window.alert("新密碼至少需要 6 個字元，且兩次輸入必須相同。");
        newPasswordInput.focus();
        return;
      }
      supabaseClient.auth.updateUser({ password: newPasswordInput.value }).then(({ error }) => {
        if (error) window.alert(`密碼更新失敗：${error.message}`);
      });
    } else if (currentPasswordInput.value !== account.password) {
      window.alert("目前密碼不正確。");
      currentPasswordInput.focus();
      return;
    } else if (newPasswordInput.value.length < 6 || newPasswordInput.value !== confirmPasswordInput.value) {
      window.alert("新密碼至少需要 6 個字元，且兩次輸入必須相同。");
      newPasswordInput.focus();
      return;
    } else {
      account.password = newPasswordInput.value;
    }
  }
  profile.name = name;
  profile.handle = nextHandle || profileDefaults.handle;
  profile.bio = profileBioInput.value.trim();
  profile.goal = profileGoalInput.value;
  appData.user = { ...appData.user, ...profile };
  if (handleChanged && account) {
    const changes = recentHandleChanges(account);
    changes.push(Date.now());
    delete authAccounts[sessionHandle];
    authAccounts[nextHandle] = account;
    account.handle = nextHandle;
    sessionHandle = nextHandle;
    localStorage.setItem("habitly-session", sessionHandle);
  }
  localStorage.setItem("habitly-profile", JSON.stringify(profile));
  localStorage.setItem("habitly-app-data", JSON.stringify(appData));
  persistCurrentData();
  applyProfile();
  profileModal.classList.remove("open");
});
applyProfile();

function formatToday() {
  const date = new Date();
  const weekday = date.toLocaleDateString("zh-TW", { weekday: "long" });
  document.getElementById("today-label").textContent = `${weekday}，${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  document.getElementById("welcome-name").textContent = appData.user.name;
}
function createHabitItem(habit, index) {
  const item = document.createElement("article");
  const status = getHabitStatus(habit);
  item.className = `habit-item ${status}`;
  item.innerHTML = `<button class="check" aria-label="習慣狀態"></button><div class="habit-icon ${habit.icon || "purple"}">✦</div><div class="habit-main"><strong></strong><span></span></div><div class="habit-xp">+${habit.xp} XP</div>`;
  item.querySelector("strong").textContent = habit.name;
  item.querySelector("span").textContent = `${habit.time} · ${habit.frequency}`;
  bindHabitCheck(item.querySelector(".check"), habit);
  item.dataset.habitIndex = index;
  return item;
}
const habitDetailsModal = document.getElementById("habit-details-modal");
const habitDetailsMonth = document.getElementById("habit-details-month");
let selectedDetailsHabit = null;
function monthValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}
function renderHabitDetails() {
  if (!selectedDetailsHabit) return;
  const [year, month] = habitDetailsMonth.value.split("-").map(Number);
  const list = document.getElementById("habit-details-list");
  list.innerHTML = "";
  const daysInMonth = new Date(year, month, 0).getDate();
  document.getElementById("habit-details-title").textContent = `${selectedDetailsHabit.name} · 詳細紀錄`;
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${pad(month)}-${pad(day)}`;
    const schedule = (appData.schedule[key] || []).find((item) => item.habitId === selectedDetailsHabit.id);
    const log = (selectedDetailsHabit.logs || []).find((item) => item.date === key);
    const row = document.createElement("article");
    row.className = `habit-detail-day ${log?.status === "completed" || (log && !log.status) ? "completed" : log ? "in-progress" : schedule ? "not-completed" : "not-scheduled"}`;
    const status = log?.status === "completed" ? "已完成" : log?.status === "missed" ? "未完成" : log?.status === "in-progress" ? "進行中" : schedule ? "未完成" : "未安排";
    row.innerHTML = `<div class="habit-detail-date"><strong></strong><span></span></div><div class="habit-detail-content"><p></p><div class="habit-detail-photo"></div><div class="habit-detail-actions"><button class="text-btn edit-record" type="button">編輯紀錄</button><button class="text-btn share-record" type="button">分享給好友</button></div></div>`;
    row.querySelector(".habit-detail-date strong").textContent = `${month}/${day}`;
    row.querySelector(".habit-detail-date span").textContent = status;
    row.querySelector(".habit-detail-content p").textContent = log?.note ? `筆記：${log.note}` : "沒有筆記";
    const media = log?.media || (log?.photo ? [{ type: "image", data: log.photo }] : []);
    if (media.length) {
      media.forEach((mediaItem) => {
        const element = document.createElement(mediaItem.type === "video" ? "video" : "img");
        element.src = mediaItem.data;
        element.controls = mediaItem.type === "video";
        element.alt = `${key} 的習慣媒體`;
        row.querySelector(".habit-detail-photo").appendChild(element);
      });
    } else {
      row.querySelector(".habit-detail-photo").textContent = "沒有照片或影片";
    }
    row.querySelector(".edit-record").addEventListener("click", () => {
      openRecordEditor({ habit: selectedDetailsHabit, date: key });
    });
    row.querySelector(".share-record").addEventListener("click", () => {
      shareHabitRecord(selectedDetailsHabit, key, log, status);
    });
    list.appendChild(row);
  }
}
async function shareHabitRecord(habit, date, log, status) {
  const text = `${habit.name} · ${date}\n狀態：${status}${log?.note ? `\n筆記：${log.note}` : ""}`;
  try {
    const media = log?.media || (log?.photo ? [{ type: "image", data: log.photo }] : []);
    const files = [];
    for (const item of media) {
      if (!item.data || !item.data.startsWith("data:")) continue;
      const response = await fetch(item.data);
      const blob = await response.blob();
      files.push(new File([blob], item.name || `${habit.name}-${date}.${item.type === "video" ? "mp4" : "jpg"}`, { type: blob.type }));
    }
    if (navigator.share) {
      const shareData = files.length ? { title: habit.name, text, files } : { title: habit.name, text };
      if (!navigator.canShare || navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return;
      }
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      window.alert("分享內容已複製，可貼給好友。");
    } else {
      window.alert(text);
    }
  } catch (error) {
    if (error?.name !== "AbortError") window.alert("分享失敗，請稍後再試。");
  }
}
function openHabitDetails(habit) {
  selectedDetailsHabit = habit;
  habitDetailsMonth.value = monthValue(new Date());
  renderHabitDetails();
  habitDetailsModal.classList.add("open");
}
const habitSettingsModal = document.getElementById("habit-settings-modal");
const settingsHabitTimeType = document.getElementById("settings-habit-time-type");
const settingsHabitTimeRange = document.getElementById("settings-habit-time-range");
function openHabitSettings() {
  if (!selectedDetailsHabit) return;
  document.getElementById("settings-habit-name").value = selectedDetailsHabit.name;
  settingsHabitTimeType.value = selectedDetailsHabit.timeType || "range";
  document.getElementById("settings-habit-start").value = selectedDetailsHabit.startTime || "08:00";
  document.getElementById("settings-habit-end").value = selectedDetailsHabit.endTime || "09:00";
  document.getElementById("settings-habit-icon").value = selectedDetailsHabit.icon || "purple";
  settingsHabitTimeRange.classList.toggle("hidden", settingsHabitTimeType.value === "all-day");
  document.getElementById("settings-habit-xp").textContent = `目前獎勵：${selectedDetailsHabit.xp || 0} XP`;
  habitSettingsModal.classList.add("open");
}
document.getElementById("open-habit-settings").addEventListener("click", openHabitSettings);
document.getElementById("close-habit-settings").addEventListener("click", () => habitSettingsModal.classList.remove("open"));
settingsHabitTimeType.addEventListener("change", () => {
  settingsHabitTimeRange.classList.toggle("hidden", settingsHabitTimeType.value === "all-day");
});
document.getElementById("save-habit-settings").addEventListener("click", () => {
  if (!selectedDetailsHabit) return;
  const name = document.getElementById("settings-habit-name").value.trim();
  const timeType = settingsHabitTimeType.value;
  const startTime = document.getElementById("settings-habit-start").value;
  const endTime = document.getElementById("settings-habit-end").value;
  if (!name) return window.alert("請輸入習慣名稱。");
  const xp = calculateHabitXp(timeType, startTime, endTime);
  if (timeType === "range" && xp <= 0) return window.alert("結束時間必須晚於開始時間。");
  selectedDetailsHabit.name = name;
  selectedDetailsHabit.timeType = timeType;
  selectedDetailsHabit.startTime = timeType === "all-day" ? null : startTime;
  selectedDetailsHabit.endTime = timeType === "all-day" ? null : endTime;
  selectedDetailsHabit.time = timeType === "all-day" ? "整天" : `${startTime}-${endTime}`;
  selectedDetailsHabit.xp = xp;
  selectedDetailsHabit.icon = document.getElementById("settings-habit-icon").value;
  Object.values(appData.schedule).forEach((schedules) => schedules.forEach((schedule) => {
    if (schedule.habitId === selectedDetailsHabit.id) {
      schedule.title = name;
      schedule.time = selectedDetailsHabit.time;
    }
  }));
  Object.entries(appData.schedule).forEach(([key, schedules]) => {
    events[key] = schedules.map((schedule) => schedule.title);
    scheduleTimes[key] = schedules.map((schedule) => schedule.time);
  });
  localStorage.setItem("habitly-app-data", JSON.stringify(appData));
  localStorage.setItem("habitly-schedule", JSON.stringify(events));
  localStorage.setItem("habitly-schedule-times", JSON.stringify(scheduleTimes));
  persistCurrentData();
  renderHabitViews();
  renderCalendar();
  renderHabitDetails();
  habitSettingsModal.classList.remove("open");
});
document.getElementById("close-habit-details-modal").addEventListener("click", () => {
  selectedDetailsHabit = null;
  habitDetailsModal.classList.remove("open");
});
habitDetailsMonth.addEventListener("change", renderHabitDetails);
function getWeekStart(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}
function renderWeeklyProgress() {
  const bars = document.getElementById("weekly-progress-bars");
  if (!bars) return;
  const weekStart = getWeekStart(new Date());
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  bars.innerHTML = "";
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + offset);
    const key = dateKey(date);
    const schedules = appData.schedule[key] || [];
    const completed = schedules.filter((schedule) => {
      const habit = appData.habits.find((item) => item.id === schedule.habitId || item.name === schedule.title);
      return habit && isHabitCompletedOn(habit, key);
    }).length;
    const percentage = schedules.length ? Math.round((completed / schedules.length) * 100) : 0;
    const day = document.createElement("div");
    const bar = document.createElement("b");
    const label = document.createElement("span");
    bar.style.height = `${percentage}%`;
    bar.classList.toggle("today", key === dateKey(new Date()));
    bar.title = `${completed} / ${schedules.length} 個習慣已完成`;
    label.textContent = weekdays[date.getDay()];
    day.append(bar, label);
    bars.appendChild(day);
  }
}
function updateWeeklyCompletionRate() {
  const start = getWeekStart(new Date());
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  let total = 0;
  let completed = 0;
  Object.entries(appData.schedule).forEach(([key, schedules]) => {
    const date = new Date(`${key}T00:00:00`);
    if (date < start || date >= end) return;
    schedules.forEach((schedule) => {
      total += 1;
      const habit = appData.habits.find((item) => item.id === schedule.habitId || item.name === schedule.title);
      if (habit && isHabitCompletedOn(habit, key)) completed += 1;
    });
  });
  const rate = total ? Math.round((completed / total) * 100) : 0;
  document.getElementById("weekly-completion-rate").firstChild.textContent = rate;
  const progress = document.getElementById("weekly-completion-progress");
  progress.style.width = `${rate}%`;
  progress.setAttribute("aria-valuenow", String(rate));
  document.getElementById("weekly-completion-foot").textContent = total ? `${completed} / ${total} 個習慣已完成` : "本週還沒有安排習慣";
  renderWeeklyProgress();
}
function renderHabitViews() {
  const todayList = document.querySelector(".habit-list");
  const library = document.getElementById("habit-library");
  todayList.innerHTML = "";
  library.innerHTML = "";
  const todayKey = dateKey(new Date());
  const todayHabitIds = new Set((appData.schedule[todayKey] || [])
    .map((schedule) => schedule.habitId)
    .filter(Boolean));
  appData.habits.forEach((habit, index) => {
    const isToday = todayHabitIds.has(habit.id)
      || (events[todayKey] || []).includes(habit.name);
    if (isToday) todayList.appendChild(createHabitItem(habit, index));
    const row = createHabitItem(habit, index);
    row.classList.add("habit-details-trigger");
    row.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      openHabitDetails(habit);
    });
    const deleteButton = document.createElement("button");
    deleteButton.className = "text-btn";
    deleteButton.textContent = "刪除";
    row.appendChild(deleteButton);
    deleteButton.addEventListener("click", () => {
      if (!window.confirm(`確定要刪除「${habit.name}」嗎？`)) return;
      appData.habits = appData.habits.filter((item) => item.id !== habit.id);
      Object.entries(appData.schedule).forEach(([key, schedules]) => {
        const remaining = schedules.filter((schedule) => schedule.habitId !== habit.id);
        if (remaining.length === schedules.length) return;
        if (remaining.length) {
          appData.schedule[key] = remaining;
          events[key] = remaining.map((schedule) => schedule.title);
          scheduleTimes[key] = remaining.map((schedule) => schedule.time);
        } else {
          delete appData.schedule[key];
          delete events[key];
          delete scheduleTimes[key];
        }
      });
      localStorage.setItem("habitly-app-data", JSON.stringify(appData));
      persistCurrentData();
      renderHabitViews();
    });
    library.appendChild(row);
  });
  document.getElementById("today-habit-count").textContent = todayList.children.length;
  updateWeeklyCompletionRate();
}
markMissedSchedules();
formatToday();
renderHabitViews();

function renderSoloState() {
  if (appData.community.posts.length === 0) {
    const feed = document.querySelector(".feed");
    feed.innerHTML = '<div class="feed-tabs"><button class="selected">推薦</button><button>追蹤中</button><button>挑戰</button></div><div class="empty-state"><strong>目前還沒有社群動態</strong><span>完成第一個習慣後，分享你的進步吧。</span></div>';
  }
  if (appData.community.challenges.length === 0) {
    document.querySelector(".community-side").innerHTML = '<h2>熱門挑戰</h2><p>目前還沒有可加入的挑戰。</p><div class="empty-state compact"><span>你可以建立自己的挑戰，邀請好友一起參加。</span></div>';
  }
  document.querySelector(".podium-person.second")?.remove();
  document.querySelector(".podium-person.third")?.remove();
  const firstPlace = document.querySelector(".podium-person.first");
  if (firstPlace) {
    firstPlace.querySelector("strong").textContent = `你 · ${appData.user.name}`;
    firstPlace.querySelector("small").textContent = `${Number(appData.user.xp || 0).toLocaleString()} XP`;
    firstPlace.querySelector(".avatar").textContent = appData.user.name.slice(0, 1);
    firstPlace.querySelector(".avatar").className = `avatar profile-avatar ${appData.user.color || "avatar-indigo"}`;
  }
  const rankingList = document.querySelector(".ranking-list");
  if (rankingList) rankingList.innerHTML = '<div class="empty-state compact"><span>目前只有你在排行榜上。</span></div>';
}
renderSoloState();

const settingsModal = document.getElementById("settings-modal");
const settingsDefaults = { ...initialAppData.settings, ...appData.settings };
const settings = { ...settingsDefaults, ...(JSON.parse(localStorage.getItem("habitly-settings") || "{}")) };
if (settings.language === "繁體中文") settings.language = "zh";
if (settings.language === "English") settings.language = "en";
function applyTheme() {
  document.body.classList.toggle("dark-theme", settings.theme === "dark");
}
function applyLanguage() {
  const english = settings.language === "en";
  document.documentElement.lang = english ? "en" : "zh-Hant";
  const labels = {
    ".nav-item[data-view='overview']": ["總覽", "Overview"],
    ".nav-item[data-view='habits']": ["我的習慣", "My habits"],
    ".nav-item[data-view='calendar']": ["日程表", "Calendar"],
    ".nav-item[data-view='community']": ["社群", "Community"],
    ".nav-item[data-view='leaderboard']": ["排行榜", "Leaderboard"],
    "#open-settings": ["設定", "Settings"],
    "#open-add": ["＋ 新增習慣", "＋ Add habit"],
    "#open-add-calendar": ["＋ 新增日程", "＋ Add schedule"],
    "#share-post": ["✦ 分享進度", "✦ Share progress"],
    "#open-friend": ["＋ 加入好友", "＋ Add friend"],
    "#logout": ["登出", "Log out"],
    ".today-btn": ["回到今天", "Today"],
    "#save-profile": ["儲存變更", "Save changes"],
    "#save-schedule": ["儲存行程", "Save schedule"],
    "#delete-schedule": ["刪除行程", "Delete schedule"],
    "#save-settings": ["儲存設定", "Save settings"],
    "#send-friend-request": ["送出好友邀請", "Send request"]
  };
  Object.entries(labels).forEach(([selector, values]) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = english ? values[1] : values[0];
  });
  document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
    const value = labels[`.nav-item[data-view='${item.dataset.view}']`];
    if (value) item.lastChild.textContent = english ? value[1] : value[0];
  });
}
function openSettings() {
  document.getElementById("setting-notifications").checked = settings.notifications;
  document.getElementById("setting-sounds").checked = settings.sounds;
  document.getElementById("setting-theme").value = settings.theme;
  document.getElementById("setting-week-start").value = settings.weekStart;
  document.getElementById("setting-language").value = settings.language;
  document.getElementById("setting-private").checked = settings.private;
  settingsModal.classList.add("open");
}
document.getElementById("open-settings").addEventListener("click", openSettings);
document.getElementById("close-settings-modal").addEventListener("click", () => settingsModal.classList.remove("open"));
document.getElementById("save-settings").addEventListener("click", () => {
  settings.notifications = document.getElementById("setting-notifications").checked;
  settings.sounds = document.getElementById("setting-sounds").checked;
  settings.theme = document.getElementById("setting-theme").value;
  settings.weekStart = document.getElementById("setting-week-start").value;
  settings.language = document.getElementById("setting-language").value;
  settings.private = document.getElementById("setting-private").checked;
  appData.settings = { ...appData.settings, ...settings };
  localStorage.setItem("habitly-settings", JSON.stringify(settings));
  localStorage.setItem("habitly-app-data", JSON.stringify(appData));
  persistCurrentData();
  applyTheme();
  applyLanguage();
  settingsModal.classList.remove("open");
});
document.getElementById("reset-account").addEventListener("click", () => {
  if (!window.confirm("確定要清除所有習慣、日程與等級資料嗎？好友不會被刪除。")) return;
  appData.habits = [];
  appData.schedule = {};
  appData.user.level = 0;
  appData.user.xp = 0;
  appData.user.xpToNextLevel = 1000;
  appData.user.bestStreak = 0;
  appData.user.currentStreak = 0;
  Object.keys(events).forEach((key) => delete events[key]);
  Object.keys(scheduleTimes).forEach((key) => delete scheduleTimes[key]);
  localStorage.setItem("habitly-schedule", "{}");
  localStorage.setItem("habitly-schedule-times", "{}");
  localStorage.setItem("habitly-profile", JSON.stringify(appData.user));
  localStorage.setItem("habitly-app-data", JSON.stringify(appData));
  persistCurrentData();
  Object.assign(profile, appData.user);
  renderHabitViews();
  renderCalendar();
  applyProfile();
  settingsModal.classList.remove("open");
});

const friendModal = document.getElementById("friend-modal");
const friendIdInput = document.getElementById("friend-id-input");
friendIdInput.addEventListener("input", () => {
  friendIdInput.value = friendIdInput.value.replace(/^@+/, "");
});
document.getElementById("open-friend").addEventListener("click", () => friendModal.classList.add("open"));
document.getElementById("close-friend-modal").addEventListener("click", () => friendModal.classList.remove("open"));
document.getElementById("send-friend-request").addEventListener("click", () => {
  const friendId = friendIdInput.value.trim();
  if (!friendId) {
    friendIdInput.focus();
    return;
  }
  if (!appData.friends.some((friend) => friend.handle === friendId)) {
    appData.friends.push({ id: `request-${Date.now()}`, name: friendId, handle: friendId, status: "pending" });
    localStorage.setItem("habitly-app-data", JSON.stringify(appData));
    persistCurrentData();
  }
  friendIdInput.value = "";
  friendModal.classList.remove("open");
});

document.getElementById("logout").addEventListener("click", () => {
  if (supabaseEnabled) {
    supabaseClient.auth.signOut().then(({ error }) => {
      if (error) {
        window.alert(`登出失敗：${error.message}`);
        return;
      }
      localStorage.removeItem("habitly-session");
      window.location.reload();
    });
    return;
  }
  const currentHandle = localStorage.getItem("habitly-session");
  if (currentHandle && authAccounts[currentHandle]) {
    authAccounts[currentHandle].data = JSON.parse(JSON.stringify(appData));
    localStorage.setItem("habitly-accounts", JSON.stringify(authAccounts));
  }
  localStorage.removeItem("habitly-session");
  window.location.reload();
});
applyTheme();
applyLanguage();
