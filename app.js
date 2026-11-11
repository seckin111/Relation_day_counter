/* ==========================================================================
   Aşk Sayacı & Kilit Ekranı Widget | JavaScript Core Logic
   ========================================================================== */

// --- STATE & INITIAL CONFIG ---
const DEFAULT_STATE = {
  partner1: "Seçkin",
  partner2: "Tuğçe",
  startDate: "2024-02-14T14:00",
  avatar1: null,
  avatar2: null
};

let appState = { ...DEFAULT_STATE };
let memories = []; 
let futurePlans = [];
let userNotes = [];
let notifications = [];

// Current Calendar Navigation State
let currentCalDate = new Date();
let currentFutureCalDate = new Date();

window.changeCalendarMonth = function(delta) {
  if (!(currentCalDate instanceof Date) || isNaN(currentCalDate.getTime())) {
    currentCalDate = new Date();
  }
  currentCalDate = new Date(currentCalDate.getFullYear(), currentCalDate.getMonth() + delta, 1);
  renderCalendar(currentCalDate);
};

window.changeFutureCalendarMonth = function(delta) {
  if (!(currentFutureCalDate instanceof Date) || isNaN(currentFutureCalDate.getTime())) {
    currentFutureCalDate = new Date();
  }
  currentFutureCalDate = new Date(currentFutureCalDate.getFullYear(), currentFutureCalDate.getMonth() + delta, 1);
  renderFutureCalendar(currentFutureCalDate);
};
let selectedMemoryPhotos = [];
let lastUpdatedMinute = -1;
let activeNoteFilter = "all";
let persistentLockscreenActive = localStorage.getItem("love_persistent_lockscreen") === "true";

let sentNotificationIds = new Set(JSON.parse(localStorage.getItem("love_sent_notif_ids") || "[]"));

// IndexedDB Storage Initialization (Version 4 for user_notes)
const DB_NAME = "LoveCounterAppDB";
const DB_VERSION = 4;
let db = null;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (e) => {
      const dbInstance = e.target.result;
      if (!dbInstance.objectStoreNames.contains("memories")) {
        dbInstance.createObjectStore("memories", { keyPath: "id" });
      }
      if (!dbInstance.objectStoreNames.contains("future_plans")) {
        dbInstance.createObjectStore("future_plans", { keyPath: "id" });
      }
      if (!dbInstance.objectStoreNames.contains("user_notes")) {
        dbInstance.createObjectStore("user_notes", { keyPath: "id" });
      }
      if (!dbInstance.objectStoreNames.contains("notifications")) {
        dbInstance.createObjectStore("notifications", { keyPath: "id" });
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = (e) => {
      console.warn("IndexedDB fallback to localStorage", e);
      resolve(null);
    };
  });
}

// --- APP INITIALIZATION ---
document.addEventListener("DOMContentLoaded", async () => {
  await initDB();
  await loadAppState();
  await loadMemories();
  await loadFuturePlans();
  await loadUserNotes();
  await loadNotifications();

  initFloatingHearts();
  startCounterTimer();
  renderCouplesHeader();
  renderCalendar(currentCalDate);
  renderFutureCalendar(currentFutureCalDate);
  renderTimeline();
  renderPhotoLibrary();
  renderFuturePlans();
  renderUserNotes();
  renderNotifications();
  setupEventListeners();
  setupPwaInstaller();
  updateAmbientLockscreen();

  checkAndTriggerPlanNotifications();
  checkAndTriggerNoteNotifications();
  checkAndTriggerWaterReminder();

  if (persistentLockscreenActive) {
    updatePersistentLockscreenNotification();
  }
});

// --- LOAD / SAVE STATE ---
async function loadAppState() {
  const saved = localStorage.getItem("love_counter_state");
  if (saved) {
    try {
      appState = { ...DEFAULT_STATE, ...JSON.parse(saved) };
    } catch (e) {
      console.error(e);
    }
  } else {
    const defaultDate = new Date();
    defaultDate.setFullYear(defaultDate.getFullYear() - 1);
    appState.startDate = defaultDate.toISOString().slice(0, 16);
    saveAppState();
  }
}

function saveAppState() {
  localStorage.setItem("love_counter_state", JSON.stringify(appState));
}

// Memory Operations
async function loadMemories() {
  if (db && db.objectStoreNames.contains("memories")) {
    return new Promise((resolve) => {
      const tx = db.transaction("memories", "readonly");
      const store = tx.objectStore("memories");
      const req = store.getAll();
      req.onsuccess = () => {
        memories = req.result || [];
        resolve(memories);
      };
      req.onerror = () => {
        loadMemoriesFromLS();
        resolve(memories);
      };
    });
  } else {
    loadMemoriesFromLS();
  }
}

function loadMemoriesFromLS() {
  const data = localStorage.getItem("love_counter_memories");
  memories = data ? JSON.parse(data) : [];
}

async function saveMemory(memoryObj) {
  const existingIdx = memories.findIndex(m => m.id === memoryObj.id);
  if (existingIdx >= 0) {
    memories[existingIdx] = memoryObj;
  } else {
    memories.push(memoryObj);
  }

  if (db && db.objectStoreNames.contains("memories")) {
    const tx = db.transaction("memories", "readwrite");
    const store = tx.objectStore("memories");
    store.put(memoryObj);
  }
  localStorage.setItem("love_counter_memories", JSON.stringify(memories));
}

async function deleteMemory(id) {
  memories = memories.filter(m => m.id !== id);
  if (db && db.objectStoreNames.contains("memories")) {
    const tx = db.transaction("memories", "readwrite");
    const store = tx.objectStore("memories");
    store.delete(id);
  }
  localStorage.setItem("love_counter_memories", JSON.stringify(memories));
}

// Future Plans Operations
async function loadFuturePlans() {
  if (db && db.objectStoreNames.contains("future_plans")) {
    return new Promise((resolve) => {
      const tx = db.transaction("future_plans", "readonly");
      const store = tx.objectStore("future_plans");
      const req = store.getAll();
      req.onsuccess = () => {
        futurePlans = req.result || [];
        resolve(futurePlans);
      };
      req.onerror = () => {
        loadFuturePlansFromLS();
        resolve(futurePlans);
      };
    });
  } else {
    loadFuturePlansFromLS();
  }
}

function loadFuturePlansFromLS() {
  const data = localStorage.getItem("love_counter_future_plans");
  futurePlans = data ? JSON.parse(data) : [];
}

async function saveFuturePlan(planObj) {
  const existingIdx = futurePlans.findIndex(p => p.id === planObj.id);
  if (existingIdx >= 0) {
    futurePlans[existingIdx] = planObj;
  } else {
    futurePlans.push(planObj);
  }

  if (db && db.objectStoreNames.contains("future_plans")) {
    const tx = db.transaction("future_plans", "readwrite");
    const store = tx.objectStore("future_plans");
    store.put(planObj);
  }
  localStorage.setItem("love_counter_future_plans", JSON.stringify(futurePlans));

  checkAndTriggerPlanNotifications();
}

async function deleteFuturePlan(id) {
  futurePlans = futurePlans.filter(p => p.id !== id);
  if (db && db.objectStoreNames.contains("future_plans")) {
    const tx = db.transaction("future_plans", "readwrite");
    const store = tx.objectStore("future_plans");
    store.delete(id);
  }
  localStorage.setItem("love_counter_future_plans", JSON.stringify(futurePlans));
}

// User Notes & Reminders Operations
async function loadUserNotes() {
  if (db && db.objectStoreNames.contains("user_notes")) {
    return new Promise((resolve) => {
      const tx = db.transaction("user_notes", "readonly");
      const store = tx.objectStore("user_notes");
      const req = store.getAll();
      req.onsuccess = () => {
        userNotes = req.result || [];
        resolve(userNotes);
      };
      req.onerror = () => {
        loadUserNotesFromLS();
        resolve(userNotes);
      };
    });
  } else {
    loadUserNotesFromLS();
  }
}

function loadUserNotesFromLS() {
  const data = localStorage.getItem("love_counter_notes");
  userNotes = data ? JSON.parse(data) : [];
}

async function saveUserNote(noteObj) {
  const existingIdx = userNotes.findIndex(n => n.id === noteObj.id);
  if (existingIdx >= 0) {
    userNotes[existingIdx] = noteObj;
  } else {
    userNotes.push(noteObj);
  }

  if (db && db.objectStoreNames.contains("user_notes")) {
    const tx = db.transaction("user_notes", "readwrite");
    const store = tx.objectStore("user_notes");
    store.put(noteObj);
  }
  localStorage.setItem("love_counter_notes", JSON.stringify(userNotes));

  checkAndTriggerNoteNotifications();
}

async function deleteUserNote(id) {
  userNotes = userNotes.filter(n => n.id !== id);
  if (db && db.objectStoreNames.contains("user_notes")) {
    const tx = db.transaction("user_notes", "readwrite");
    const store = tx.objectStore("user_notes");
    store.delete(id);
  }
  localStorage.setItem("love_counter_notes", JSON.stringify(userNotes));
}

// Notifications Store Operations
async function loadNotifications() {
  if (db && db.objectStoreNames.contains("notifications")) {
    return new Promise((resolve) => {
      const tx = db.transaction("notifications", "readonly");
      const store = tx.objectStore("notifications");
      const req = store.getAll();
      req.onsuccess = () => {
        notifications = req.result || [];
        resolve(notifications);
      };
      req.onerror = () => {
        loadNotifsFromLS();
        resolve(notifications);
      };
    });
  } else {
    loadNotifsFromLS();
  }
}

function loadNotifsFromLS() {
  const data = localStorage.getItem("love_counter_notifs");
  notifications = data ? JSON.parse(data) : [];
}

async function addNotificationItem(notifObj) {
  notifications.unshift(notifObj);
  if (db && db.objectStoreNames.contains("notifications")) {
    const tx = db.transaction("notifications", "readwrite");
    const store = tx.objectStore("notifications");
    store.put(notifObj);
  }
  localStorage.setItem("love_counter_notifs", JSON.stringify(notifications));
  renderNotifications();
}

async function deleteNotificationItem(id) {
  notifications = notifications.filter(n => n.id !== id);
  if (db && db.objectStoreNames.contains("notifications")) {
    const tx = db.transaction("notifications", "readwrite");
    const store = tx.objectStore("notifications");
    store.delete(id);
  }
  localStorage.setItem("love_counter_notifs", JSON.stringify(notifications));
  renderNotifications();
}

async function clearAllNotifications() {
  notifications = [];
  if (db && db.objectStoreNames.contains("notifications")) {
    const tx = db.transaction("notifications", "readwrite");
    const store = tx.objectStore("notifications");
    store.clear();
  }
  localStorage.setItem("love_counter_notifs", JSON.stringify(notifications));
  renderNotifications();
}

// --- FLOATING HEARTS PARTICLES ---
function initFloatingHearts() {
  const container = document.getElementById("heartParticles");
  if (!container) return;

  setInterval(() => {
    if (container.children.length > 25) return;
    const heart = document.createElement("div");
    heart.className = "floating-heart-particle";
    heart.style.left = Math.random() * 100 + "vw";
    heart.style.animationDuration = (8 + Math.random() * 8) + "s";
    heart.style.fontSize = (14 + Math.random() * 20) + "px";
    heart.innerHTML = ["❤️", "💖", "💕", "💗", "🌸", "✨"][Math.floor(Math.random() * 6)];
    container.appendChild(heart);

    setTimeout(() => {
      heart.remove();
    }, 15000);
  }, 1200);
}

// --- RELATIONSHIP TIMER & REAL-TIME COUNTER CALCULATIONS ---
function startCounterTimer() {
  updateCounterDisplay();
  
  // Real-time live update loop (Runs every 1000ms / 1 second)
  setInterval(() => {
    updateCounterDisplay();
    updateAmbientClock();
    updateFutureCountdowns();

    // If Widget Canvas Generator is active, update canvas real-time too
    const genView = document.getElementById("generatorModeView");
    if (genView && genView.classList.contains("active")) {
      renderWidgetCanvas();
    }

    if (persistentLockscreenActive) {
      updatePersistentLockscreenNotification();
    }
  }, 1000);

  // Check plan, note & hourly water notifications every 5 seconds
  setInterval(() => {
    checkAndTriggerPlanNotifications();
    checkAndTriggerNoteNotifications();
    checkAndTriggerWaterReminder();
  }, 5000);
}

function updateCounterDisplay() {
  if (!appState.startDate) return;

  const start = new Date(appState.startDate);
  const now = new Date();

  if (isNaN(start.getTime())) return;

  let diffMs = now - start;

  if (diffMs < 0) {
    document.getElementById("counterYears").innerText = "0";
    document.getElementById("counterMonths").innerText = "0";
    document.getElementById("counterDays").innerText = "0";
    document.getElementById("counterHours").innerText = "00";
    document.getElementById("counterMinutes").innerText = "00";
    document.getElementById("counterSeconds").innerText = "00";
    document.getElementById("totalDaysVal").innerText = "0";

    document.getElementById("ambYears").innerText = "0";
    document.getElementById("ambMonths").innerText = "0";
    document.getElementById("ambDays").innerText = "0";
    document.getElementById("ambHours").innerText = "00";
    document.getElementById("ambMins").innerText = "00";
    return;
  }

  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  let hours = now.getHours() - start.getHours();
  let minutes = now.getMinutes() - start.getMinutes();
  let seconds = now.getSeconds() - start.getSeconds();

  if (seconds < 0) {
    minutes--;
    seconds += 60;
  }
  if (minutes < 0) {
    hours--;
    minutes += 60;
  }
  if (hours < 0) {
    days--;
    hours += 24;
  }

  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // 1. Update Main Screen Live Heart Counters
  document.getElementById("counterYears").innerText = years;
  document.getElementById("counterMonths").innerText = months;
  document.getElementById("counterDays").innerText = days;
  document.getElementById("counterHours").innerText = String(hours).padStart(2, '0');
  document.getElementById("counterMinutes").innerText = String(minutes).padStart(2, '0');
  document.getElementById("counterSeconds").innerText = String(seconds).padStart(2, '0');
  document.getElementById("totalDaysVal").innerText = totalDays.toLocaleString("tr-TR");

  // 2. REAL-TIME UPDATE for Lockscreen Widget Individual Heart Counters
  document.getElementById("ambYears").innerText = years;
  document.getElementById("ambMonths").innerText = months;
  document.getElementById("ambDays").innerText = days;
  document.getElementById("ambHours").innerText = String(hours).padStart(2, '0');
  document.getElementById("ambMins").innerText = String(minutes).padStart(2, '0');

  // 3. REAL-TIME LIVE UPDATE for Notification & AppWidget Every Minute!
  if (minutes !== lastUpdatedMinute) {
    lastUpdatedMinute = minutes;
    updatePersistentLockscreenNotification();
  }
}

// --- RENDER COUPLES HEADER ---
function renderCouplesHeader() {
  const namesText = `${appState.partner1 || 'Seçkin'} & ${appState.partner2 || 'Tuğçe'}`;
  document.getElementById("couplesNames").innerText = namesText;
  document.getElementById("ambientCouplesName").innerText = namesText;

  if (appState.avatar1) {
    document.getElementById("avatar1Img").src = appState.avatar1;
  }
  if (appState.avatar2) {
    document.getElementById("avatar2Img").src = appState.avatar2;
  }

  if (appState.startDate) {
    const d = new Date(appState.startDate);
    const dateFormatted = d.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
    document.getElementById("startDateDisplay").innerText = `Birliktelik Başlangıcı: ${dateFormatted}`;
  }
}

// --- PERSISTENT LOCKSCREEN NOTIFICATION CARD GENERATOR (GÖRSEL KALPLİ KİLİT EKRANI BİLDİRİMİ) ---


function generateNotificationWidgetCardImage() {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 220;
  const ctx = canvas.getContext("2d");

  // Dark Purple Background (#1d082c) (Spotify Tarzı Koyu Mor Zemin)
  ctx.fillStyle = '#1d082c';
  roundRect(ctx, 0, 0, 800, 220, 32, true, false);

  // Top Line: Couple Names in Bright Light Pink (#ff7597)
  const names = `${appState.partner1 || 'Seçkin'} & ${appState.partner2 || 'Tuğçe'}`;
  ctx.fillStyle = '#ff7597';
  ctx.font = 'bold 36px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255, 117, 151, 0.7)';
  ctx.shadowBlur = 10;
  ctx.fillText('❤️ ' + names, 400, 70);
  ctx.shadowBlur = 0;

  // Bottom Line: Live Counter Text in Bright White (#ffffff)
  const yVal = document.getElementById("counterYears")?.innerText || "0";
  const mVal = document.getElementById("counterMonths")?.innerText || "0";
  const dVal = document.getElementById("counterDays")?.innerText || "0";
  const hVal = document.getElementById("counterHours")?.innerText || "00";
  const minVal = document.getElementById("counterMinutes")?.innerText || "00";

  const counterText = `${yVal} Yıl  •  ${mVal} Ay  •  ${dVal} Gün  •  ${hVal} Saat  •  ${minVal} Dk`;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(counterText, 400, 150);

  return canvas.toDataURL("image/jpeg", 0.95);
}



function forceShowNotification(title, options) {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    try {
      new Notification(title, options);
    } catch (e) {
      console.warn("Direct Notification fallback", e);
    }

    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title: title,
        options: options
      });
    }

    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, options).catch(err => console.warn(err));
      });
    }
  }
}

function enablePersistentLockscreenNotification() {
  persistentLockscreenActive = true;
  localStorage.setItem("love_persistent_lockscreen", "true");

  if (window.AndroidBridge && typeof window.AndroidBridge.clearOldNotifications === "function") {
    window.AndroidBridge.clearOldNotifications();
  }

  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      updatePersistentLockscreenNotification();
      alert("📌 6 Kalpli Canlı Widget Kilit Ekranınıza Sabitlendi! Eski bildirimler temizlendi. ❤️");
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          updatePersistentLockscreenNotification();
          alert("📌 6 Kalpli Canlı Widget Kilit Ekranınıza Sabitlendi! ❤️");
        } else {
          openLockscreenModal();
        }
      });
    } else {
      updatePersistentLockscreenNotification();
      openLockscreenModal();
    }
  } else {
    updatePersistentLockscreenNotification();
    openLockscreenModal();
  }
}


function checkAnniversaryNotifications() {
  const startDateStr = appState.startDate || "2024-02-24T00:00:00";
  const startDate = new Date(startDateStr);
  const today = new Date();

  const currentDay = today.getDate();
  const startDay = startDate.getDate();
  const names = `${appState.partner1 || 'Seçkin'} & ${appState.partner2 || 'Tuğçe'}`;

  // Monthiversary Check (Ay Dönümü)
  if (currentDay === startDay) {
    const monthsDiff = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth());
    if (monthsDiff > 0) {
      const notifKey = `monthiversary_${today.getFullYear()}_${today.getMonth()}`;
      if (!localStorage.getItem(notifKey)) {
        localStorage.setItem(notifKey, "true");
        const title = `💖 Kutlu Olsun! (${names})`;
        const msg = `Bugün ${names} çifti olarak ${monthsDiff}. Ay Dönümünüz! Birlikte nice mutlu aylara ❤️✨`;
        if (window.AndroidBridge && typeof window.AndroidBridge.sendEventNotification === "function") {
          window.AndroidBridge.sendEventNotification(title, msg);
        } else {
          forceShowNotification(title, { body: msg });
        }
      }
    }
  }

  // Anniversary Check (Yıl Dönümü)
  if (today.getMonth() === startDate.getMonth() && today.getDate() === startDate.getDate()) {
    const yearsDiff = today.getFullYear() - startDate.getFullYear();
    if (yearsDiff > 0) {
      const notifKey = `anniversary_${today.getFullYear()}`;
      if (!localStorage.getItem(notifKey)) {
        localStorage.setItem(notifKey, "true");
        const title = `💍 Mutlu Yıl Dönümü! (${names})`;
        const msg = `Tebrikler! Bugün ${names} olarak ${yearsDiff}. Yıl Dönümünüz! Birlikte geçen her yılınız daha da güzel olsun 💖🎉`;
        if (window.AndroidBridge && typeof window.AndroidBridge.sendEventNotification === "function") {
          window.AndroidBridge.sendEventNotification(title, msg);
        } else {
          forceShowNotification(title, { body: msg });
        }
      }
    }
  }
}

function generateHeartThumbnailImage() {
  const canvas = document.createElement("canvas");
  canvas.width = 120;
  canvas.height = 120;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, 120, 120);
  drawWidgetHeartShape(ctx, 60, 45, 80, '#940f3f', '#ff2a6d');

  return canvas.toDataURL("image/png");
}

let notificationEnabled = true;

function toggleNotificationState(e) {
  if (e && typeof e.target.checked !== "undefined") {
    notificationEnabled = e.target.checked;
  } else {
    notificationEnabled = !notificationEnabled;
  }
  localStorage.setItem("love_notification_enabled", notificationEnabled ? "true" : "false");

  const switchInput = document.getElementById("btnToggleNotificationSwitch");
  if (switchInput) switchInput.checked = notificationEnabled;

  if (notificationEnabled) {
    updatePersistentLockscreenNotification();
  } else {
    if (window.AndroidBridge && typeof window.AndroidBridge.clearOldNotifications === "function") {
      window.AndroidBridge.clearOldNotifications();
    }
  }
}

function generate5HeartWidgetImage() {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 260;
  const ctx = canvas.getContext("2d");

  // Premium Dark Rounded Container Background (#150821)
  ctx.fillStyle = '#150821';
  roundRect(ctx, 0, 0, 800, 260, 32, true, false);

  // Top Center: Couple Names in Bold Bright Pink
  const names = `${appState.partner1 || 'Seçkin'} & ${appState.partner2 || 'Tuğçe'}`;
  ctx.fillStyle = '#ff7597';
  ctx.font = 'bold 36px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255, 42, 109, 0.8)';
  ctx.shadowBlur = 10;
  ctx.fillText('❤️ ' + names, 400, 50);
  ctx.shadowBlur = 0;

  // 5 Units values (YIL, AY, GÜN, SAAT, DK)
  const yVal = document.getElementById("counterYears")?.innerText || "0";
  const mVal = document.getElementById("counterMonths")?.innerText || "0";
  const dVal = document.getElementById("counterDays")?.innerText || "0";
  const hVal = document.getElementById("counterHours")?.innerText || "00";
  const minVal = document.getElementById("counterMinutes")?.innerText || "00";

  const units = [
    { label: 'YIL', val: yVal },
    { label: 'AY', val: mVal },
    { label: 'GÜN', val: dVal },
    { label: 'SAAT', val: hVal },
    { label: 'DK', val: minVal }
  ];

  const colW = 760 / 5;
  const startX = 20;
  units.forEach((u, i) => {
    const cx = startX + colW * i + colW / 2;
    const cy = 105;
    const heartSize = 85;

    // Draw 3D Pink Heart Shape with Glow
    drawWidgetHeartShape(ctx, cx, cy, heartSize, '#940f3f', '#ff2a6d');

    // Bold White Number Inside Heart - Centered & Big
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(u.val, cx, cy + 42);

    // Golden Label Below Heart - Centered
    ctx.fillStyle = '#ffb703';
    ctx.font = 'bold 14px "Outfit", sans-serif';
    ctx.fillText(u.label, cx, cy + 96);
  });

  return canvas.toDataURL("image/png");
}

function generateSpotifyNotificationCardImage() {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 220;
  const ctx = canvas.getContext("2d");

  // Dark Purple Background (#1d082c) (Spotify Tarzı Koyu Mor Zemin)
  ctx.fillStyle = '#1d082c';
  roundRect(ctx, 0, 0, 800, 220, 32, true, false);

  // Top Line: Couple Names in Bright Light Pink (#ff7597)
  const names = `${appState.partner1 || 'Seçkin'} & ${appState.partner2 || 'Tuğçe'}`;
  ctx.fillStyle = '#ff7597';
  ctx.font = 'bold 36px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255, 117, 151, 0.7)';
  ctx.shadowBlur = 10;
  ctx.fillText('❤️ ' + names, 400, 70);
  ctx.shadowBlur = 0;

  // Bottom Line: Live Counter Text in Bright White (#ffffff)
  const yVal = document.getElementById("counterYears")?.innerText || "0";
  const mVal = document.getElementById("counterMonths")?.innerText || "0";
  const dVal = document.getElementById("counterDays")?.innerText || "0";
  const hVal = document.getElementById("counterHours")?.innerText || "00";
  const minVal = document.getElementById("counterMinutes")?.innerText || "00";

  const counterText = `${yVal} Yıl  •  ${mVal} Ay  •  ${dVal} Gün  •  ${hVal} Saat  •  ${minVal} Dk`;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(counterText, 400, 150);

  return canvas.toDataURL("image/jpeg", 0.95);
}

function updatePersistentLockscreenNotification() {
  if (!notificationEnabled) return;

  const names = `${appState.partner1 || 'Seçkin'} & ${appState.partner2 || 'Tuğçe'}`;
  const title = `❤️ ${names}`;

  const yVal = document.getElementById("counterYears")?.innerText || "0";
  const mVal = document.getElementById("counterMonths")?.innerText || "0";
  const dVal = document.getElementById("counterDays")?.innerText || "0";
  const hVal = document.getElementById("counterHours")?.innerText || "00";
  const minVal = document.getElementById("counterMinutes")?.innerText || "00";

  const body = `${yVal} Yıl • ${mVal} Ay • ${dVal} Gün • ${hVal} Saat • ${minVal} Dk`;
  const spotifyPurpleCardImg = generateSpotifyNotificationCardImage();

  if (window.AndroidBridge && typeof window.AndroidBridge.showLockscreenNotification === "function") {
    window.AndroidBridge.showLockscreenNotification(title, body, spotifyPurpleCardImg);
  }

  checkAnniversaryNotifications();
}





// --- CALENDARS LOGIC ---
const MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];

function renderCalendar(dateObj) {
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();

  document.getElementById("calendarMonthYearText").innerText = `${MONTH_NAMES[month]} ${year}`;

  const grid = document.getElementById("calendarDaysGrid");
  grid.innerHTML = "";

  const firstDayIndex = new Date(year, month, 1).getDay();
  const startDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

  const today = new Date();
  const startDateObj = appState.startDate ? new Date(appState.startDate) : null;

  for (let i = startDay - 1; i >= 0; i--) {
    const dayNum = totalDaysInPrevMonth - i;
    grid.appendChild(createCalendarCell(dayNum, true));
  }

  for (let day = 1; day <= totalDaysInMonth; day++) {
    const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cell = createCalendarCell(day, false, cellDateStr);

    if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === day) {
      cell.classList.add("today");
    }

    if (startDateObj && startDateObj.getFullYear() === year && startDateObj.getMonth() === month && startDateObj.getDate() === day) {
      cell.classList.add("anniversary");
    }

    const hasMemories = memories.some(m => m.date === cellDateStr);
    if (hasMemories) {
      const memoryObj = memories.find(m => m.date === cellDateStr);
      const indicator = document.createElement("span");
      indicator.className = "memory-indicator";
      indicator.innerText = memoryObj.category || "❤️";
      cell.appendChild(indicator);
    }

    cell.addEventListener("click", () => openMemoryModalForDate(cellDateStr));
    grid.appendChild(cell);
  }
}

function renderFutureCalendar(dateObj) {
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();

  document.getElementById("futureCalendarMonthYearText").innerText = `${MONTH_NAMES[month]} ${year}`;

  const grid = document.getElementById("futureCalendarDaysGrid");
  grid.innerHTML = "";

  const firstDayIndex = new Date(year, month, 1).getDay();
  const startDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

  const today = new Date();

  for (let i = startDay - 1; i >= 0; i--) {
    const dayNum = totalDaysInPrevMonth - i;
    grid.appendChild(createCalendarCell(dayNum, true));
  }

  for (let day = 1; day <= totalDaysInMonth; day++) {
    const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cell = createCalendarCell(day, false, cellDateStr);

    if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === day) {
      cell.classList.add("today");
    }

    const plansForDate = futurePlans.filter(p => p.targetDate.startsWith(cellDateStr));
    if (plansForDate.length > 0) {
      const isAllCompleted = plansForDate.every(p => p.status === "completed");
      const indicator = document.createElement("span");
      indicator.className = "memory-indicator";
      indicator.innerText = plansForDate[0].category || (isAllCompleted ? "🎉" : "✨");
      cell.appendChild(indicator);
      cell.style.borderColor = isAllCompleted ? "#2ec4b6" : "#05d9e8";
    }

    cell.addEventListener("click", () => openFutureModalForDate(cellDateStr));
    grid.appendChild(cell);
  }
}

function createCalendarCell(dayNum, isOtherMonth = false, dateStr = "") {
  const cell = document.createElement("div");
  cell.className = `calendar-day-cell ${isOtherMonth ? 'other-month' : ''}`;
  cell.innerText = dayNum;
  if (dateStr) cell.dataset.date = dateStr;
  return cell;
}

// --- TIMELINE LOGIC ---
function renderTimeline() {
  const container = document.getElementById("timelineContainer");
  if (!container) return;

  if (memories.length === 0) {
    container.innerHTML = `
      <div class="glass-card" style="padding: 30px; text-align: center; color: var(--text-muted);">
        <p>Henüz eklenmiş bir anı bulunmuyor ❤️</p>
        <p style="font-size:0.85rem; margin-top: 6px;">Takvim üzerinden bir güne tıklayarak ilk güzel anınızı kaydedin.</p>
      </div>
    `;
    return;
  }

  const sorted = [...memories].sort((a, b) => new Date(b.date) - new Date(a.date));

  container.innerHTML = sorted.map(m => {
    let formattedDate = m.date || "";
    try {
      if (m.date && typeof m.date === "string" && m.date.includes("-")) {
        const parts = m.date.split("T")[0].split("-").map(Number);
        if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
          const dt = new Date(parts[0], parts[1] - 1, parts[2]);
          formattedDate = dt.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });
        }
      }
    } catch (err) {
      console.error(err);
    }

    const photosHtml = m.photos && m.photos.length > 0 ? `
      <div class="memory-photos-row">
        ${m.photos.map(p => `<img src="${p}" class="memory-photo-thumb" onclick="openPhotoViewer('${p}', '${m.title}')">`).join('')}
      </div>
    ` : '';

    return `
      <div class="memory-card glass-card">
        <div class="memory-card-header">
          <div class="memory-title-wrap">
            <span class="memory-emoji">${m.category || '❤️'}</span>
            <div>
              <h4>${escapeHtml(m.title)}</h4>
              <span class="memory-date-tag">${formattedDate}</span>
            </div>
          </div>
          <button class="btn-icon" onclick="openMemoryModalForDate('${m.date}')" title="Düzenle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>
        ${m.notes ? `<p class="memory-notes-text">${escapeHtml(m.notes)}</p>` : ''}
        ${photosHtml}
      </div>
    `;
  }).join('');
}

// --- FUTURE PLANS LIST & COUNTDOWNS ---
function renderFuturePlans() {
  const container = document.getElementById("futurePlansList");
  if (!container) return;

  if (futurePlans.length === 0) {
    container.innerHTML = `
      <div class="glass-card" style="padding: 24px; text-align: center; color: var(--text-muted); grid-column: 1 / -1;">
        <p>Henüz planlanmış bir gelecek planı yok ✨</p>
        <p style="font-size:0.85rem; margin-top: 4px;">"Yeni Plan Ekle" butonuna tıklayarak seyahat, tatil veya sürpriz planlarınızı ekleyin.</p>
      </div>
    `;
    return;
  }

  const sorted = [...futurePlans].sort((a, b) => {
    if (a.status === b.status) {
      return new Date(a.targetDate) - new Date(b.targetDate);
    }
    return a.status === "completed" ? 1 : -1;
  });

  container.innerHTML = sorted.map(p => {
    const isCompleted = p.status === "completed";
    const targetDateObj = new Date(p.targetDate);
    const formattedDate = targetDateObj.toLocaleDateString("tr-TR", {
      day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
    });

    const countdownText = calculateFutureCountdown(targetDateObj, isCompleted);

    return `
      <div class="future-plan-card ${isCompleted ? 'completed' : ''}">
        <div class="plan-card-top">
          <div class="plan-title-wrap">
            <span class="plan-category-icon">${p.category || '✨'}</span>
            <h5>${escapeHtml(p.title)}</h5>
          </div>
          <span class="countdown-badge ${isCompleted ? 'completed-badge' : ''}">${countdownText}</span>
        </div>
        <div class="plan-date-text">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${formattedDate}
        </div>
        ${p.notes ? `<p class="plan-notes">${escapeHtml(p.notes)}</p>` : ''}
        <div class="plan-actions-row">
          <button class="toggle-complete-btn ${isCompleted ? 'done' : ''}" onclick="toggleFuturePlanComplete('${p.id}')">
            ${isCompleted ? '✓ Tamamlandı' : 'Tamamlandı İşaretle'}
          </button>
          <button class="btn-icon" onclick="openFutureModalForEdit('${p.id}')" title="Düzenle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function calculateFutureCountdown(targetDateObj, isCompleted) {
  if (isCompleted) return "🎉 Tamamlandı";

  const now = new Date();
  const diffMs = targetDateObj - now;

  if (diffMs <= 0) return "Günü Geldi! 🥳";

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (diffDays === 0) {
    return `${diffHours} Saat Kaldı ⏳`;
  }
  return `${diffDays} Gün ${diffHours} S. Kaldı`;
}

function updateFutureCountdowns() {
  if (document.getElementById("futureSection").classList.contains("active")) {
    renderFuturePlans();
  }
}

async function toggleFuturePlanComplete(id) {
  const plan = futurePlans.find(p => p.id === id);
  if (plan) {
    plan.status = plan.status === "completed" ? "planned" : "completed";
    await saveFuturePlan(plan);
    renderFuturePlans();
    renderFutureCalendar(currentFutureCalDate);
  }
}

// --- USER NOTES & REMINDERS LOGIC ---
function renderUserNotes() {
  const container = document.getElementById("userNotesGrid");
  if (!container) return;

  let filtered = [...userNotes];
  if (activeNoteFilter === "reminder") {
    filtered = filtered.filter(n => n.reminderEnabled);
  } else if (activeNoteFilter === "love") {
    filtered = filtered.filter(n => n.category === "💖");
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="glass-card" style="padding: 24px; text-align: center; color: var(--text-muted); grid-column: 1 / -1;">
        <p>Henüz kaydedilmiş özel bir not yok 📝</p>
        <p style="font-size:0.85rem; margin-top: 4px;">"Yeni Not & Alarm Ekle" butonuna tıklayarak sevgilinize notlar veya hatırlatıcılar kurun.</p>
      </div>
    `;
    return;
  }

  const sorted = filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  container.innerHTML = sorted.map(n => {
    let reminderText = "";
    if (n.reminderEnabled && n.reminderDateTime) {
      const remDate = new Date(n.reminderDateTime);
      const now = new Date();
      const diffMs = remDate - now;

      if (diffMs <= 0) {
        reminderText = "🔔 Zamanı Geldi!";
      } else {
        const diffMins = Math.round(diffMs / 60000);
        if (diffMins < 60) {
          reminderText = `⏰ ${diffMins} Dk Sonra`;
        } else {
          const diffHours = Math.round(diffMins / 60);
          reminderText = `⏰ ${diffHours} Saat Sonra`;
        }
      }
    }

    return `
      <div class="future-plan-card">
        <div class="plan-card-top">
          <div class="plan-title-wrap">
            <span class="plan-category-icon">${n.category || '📝'}</span>
            <h5>${escapeHtml(n.title)}</h5>
          </div>
          ${n.reminderEnabled ? `<span class="countdown-badge reminder-active">${reminderText}</span>` : ''}
        </div>
        ${n.body ? `<p class="plan-notes">${escapeHtml(n.body)}</p>` : ''}
        <div class="plan-actions-row">
          <span style="font-size:0.75rem; color:var(--text-sub);">
            ${n.reminderDateTime ? '⏰ ' + new Date(n.reminderDateTime).toLocaleString('tr-TR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : ''}
          </span>
          <button class="btn-icon" onclick="openNoteModalForEdit('${n.id}')" title="Düzenle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 1-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function checkAndTriggerNoteNotifications() {
  const now = new Date();

  userNotes.forEach(note => {
    if (!note.reminderEnabled || !note.reminderDateTime) return;

    const remDate = new Date(note.reminderDateTime);
    const diffMs = remDate - now;

    if (diffMs <= 30000 && !sentNotificationIds.has(note.id + "_rem")) {
      sentNotificationIds.add(note.id + "_rem");
      localStorage.setItem("love_sent_notif_ids", JSON.stringify(Array.from(sentNotificationIds)));

      const notifObj = {
        id: "notif_note_" + Date.now(),
        noteId: note.id,
        title: `📝 Not Hatırlatıcı: ${note.title}`,
        body: `${note.body || 'Hatırlatıcı zamanı geldi! ❤️'}`,
        date: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }),
        read: false
      };

      addNotificationItem(notifObj);
      sendNativeLockscreenNotification(notifObj.title, notifObj.body, note.id);
    }
  });
}

// --- NOTIFICATION & REMINDER SYSTEM ---
function checkAndTriggerPlanNotifications() {
  const now = new Date();

  futurePlans.forEach(plan => {
    if (plan.status === "completed") return;

    const targetDateObj = new Date(plan.targetDate);
    const diffMs = targetDateObj - now;

    if (diffMs <= 300000 && !sentNotificationIds.has(plan.id + "_due")) {
      sentNotificationIds.add(plan.id + "_due");
      localStorage.setItem("love_sent_notif_ids", JSON.stringify(Array.from(sentNotificationIds)));

      const notifObj = {
        id: "notif_" + Date.now(),
        planId: plan.id,
        title: `${plan.category || '✨'} Günü Geldi: ${plan.title}`,
        body: `Bugün beklediğiniz plan zamanı geldi! 🎉 ${plan.notes || ''}`,
        date: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }),
        read: false
      };

      addNotificationItem(notifObj);
      sendNativeLockscreenNotification(notifObj.title, notifObj.body, plan.id);
    }
    else if (diffMs > 0 && diffMs <= 86400000 && !sentNotificationIds.has(plan.id + "_1day")) {
      sentNotificationIds.add(plan.id + "_1day");
      localStorage.setItem("love_sent_notif_ids", JSON.stringify(Array.from(sentNotificationIds)));

      const notifObj = {
        id: "notif_" + Date.now(),
        planId: plan.id,
        title: `⏳ Yarın Planınız Var: ${plan.title}`,
        body: `Hatırlatma: Yarın ${plan.title} planınız gerçekleşecek! ${plan.category || ''}`,
        date: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }),
        read: false
      };

      addNotificationItem(notifObj);
      sendNativeLockscreenNotification(notifObj.title, notifObj.body, plan.id);
    }
  });
}

// 💧 Hourly / Custom Water Reminder (Configurable start/end hours & frequency)
let lastWaterReminderHourKey = localStorage.getItem("love_water_last_notif_hour") || "";

function checkAndTriggerWaterReminder() {
  if (!waterSettings || !waterSettings.reminder) return;

  const now = new Date();
  const currentHour = now.getHours(); // 0..23
  const currentMin  = now.getMinutes(); // 0..59

  const start = waterSettings.startHour || 10;
  const end   = waterSettings.endHour   || 24;
  const freq  = waterSettings.frequencyMins || 60;

  // Quiet Hours Check
  if (end === 24) {
    if (currentHour < start) return; // e.g. 00:00 - 10:00 quiet
  } else if (start < end) {
    if (currentHour < start || currentHour >= end) return;
  } else {
    if (currentHour < start && currentHour >= end) return;
  }

  // Key calculation depending on frequency
  const dateStr = now.toISOString().split("T")[0];
  let slotKey = "";

  if (freq === 30) {
    const minSlot = currentMin >= 30 ? 30 : 0;
    slotKey = `${dateStr}_H${currentHour}_M${minSlot}`;
  } else {
    const intervalHours = Math.max(1, Math.round(freq / 60));
    const hoursFromStart = currentHour - start;
    if (hoursFromStart < 0 || (hoursFromStart % intervalHours !== 0)) return;
    slotKey = `${dateStr}_H${currentHour}`;
  }

  if (lastWaterReminderHourKey !== slotKey) {
    lastWaterReminderHourKey = slotKey;
    localStorage.setItem("love_water_last_notif_hour", slotKey);

    playWaterDropSound();

    const notifObj = {
      id: "notif_water_" + Date.now(),
      title: "💧 Su İçme Vakti!",
      body: "Su içmeyi unutma! Sağlığın ve enerjin için 1 bardak taze su içme zamanı 🥛",
      date: now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
      read: false
    };

    addNotificationItem(notifObj);
    sendNativeLockscreenNotification(notifObj.title, notifObj.body, "water_reminder");
  }
}

window.openWaterReminderSettingsModal = function() {
  const modal = document.getElementById("waterReminderSettingsModal");
  const selFreq  = document.getElementById("selectWaterFreqMins");
  const selStart = document.getElementById("selectWaterStartHour");
  const selEnd   = document.getElementById("selectWaterEndHour");

  if (selFreq)  selFreq.value  = waterSettings.frequencyMins || 60;
  if (selStart) selStart.value = waterSettings.startHour     || 10;
  if (selEnd)   selEnd.value   = waterSettings.endHour       || 24;

  if (modal) modal.classList.add("active");
};

window.closeWaterReminderSettingsModal = function() {
  document.getElementById("waterReminderSettingsModal")?.classList.remove("active");
};

window.saveWaterReminderSettings = function() {
  const freq  = parseInt(document.getElementById("selectWaterFreqMins")?.value, 10)  || 60;
  const start = parseInt(document.getElementById("selectWaterStartHour")?.value, 10) || 10;
  const end   = parseInt(document.getElementById("selectWaterEndHour")?.value, 10)   || 24;

  waterSettings.frequencyMins = freq;
  waterSettings.startHour     = start;
  waterSettings.endHour       = end;
  waterSettings.reminder      = true;

  saveWaterSettingsData();
  closeWaterReminderSettingsModal();

  renderDietWater();
  const freqLabel = freq === 30 ? "30 dakikada bir" : (freq === 60 ? "saat başı" : `${freq/60} saatte bir`);
  showInfoModal("Ayarlandı 💧", `Su hatırlatıcısı saat ${start}:00 ile ${end === 24 ? '00:00' : end + ':00'} arasında her ${freqLabel} çalışacak şekilde kaydedildi.`);
};

function sendNativeLockscreenNotification(title, body, tag) {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    triggerShowNotification(title, body, tag);
  }
}

function triggerShowNotification(title, body, tag) {
  const options = {
    body: body,
    icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="100" fill="%23ff2a6d"/><path d="M256 448l-30.8-28.08C115.2 320 48 259.2 48 184 48 122.4 96.4 74 158 74c34.8 0 68.2 16.2 90 41.8C270.8 90.2 304.2 74 339 74c61.6 0 110 48.4 110 110 0 75.2-67.2 136-177.2 236.08L256 448z" fill="white"/></svg>',
    badge: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="200" fill="%23ff2a6d"/></svg>',
    vibrate: [200, 100, 200],
    tag: tag || 'love-counter-plan',
    renotify: true,
    requireInteraction: false
  };

  if (navigator.serviceWorker && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, options);
    });
  } else {
    new Notification(title, options);
  }
}

function renderNotifications() {
  const badge = document.getElementById("notifBadge");
  const list = document.getElementById("notificationsList");
  const permBanner = document.getElementById("notifPermBanner");

  if (permBanner) {
    permBanner.style.display = ("Notification" in window && Notification.permission !== "granted") ? "block" : "none";
  }

  const unreadCount = notifications.filter(n => !n.read).length;
  if (badge) {
    badge.innerText = unreadCount;
    badge.style.display = unreadCount > 0 ? "flex" : "none";
  }

  if (!list) return;

  if (notifications.length === 0) {
    list.innerHTML = `
      <div style="text-align:center; padding: 24px; color: var(--text-muted);">
        <p>Henüz bildiriminiz yok 🔔</p>
        <p style="font-size:0.8rem; margin-top:4px;">Gelecek planlarınız ve özel not hatırlatıcılarınız günü geldiğinde kilit ekranınızda haber verilecektir.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = notifications.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}">
      <div class="notif-item-left">
        <span class="notif-icon">${n.category || '🔔'}</span>
        <div>
          <div class="notif-title">${escapeHtml(n.title)}</div>
          <div class="notif-body">${escapeHtml(n.body)}</div>
          <div class="notif-time">${n.date}</div>
        </div>
      </div>
      <button class="btn-delete-notif" onclick="deleteNotificationItem('${n.id}')" title="Bildirimi Sil">&times;</button>
    </div>
  `).join('');
}

// --- CANVAS WIDGET GENERATOR ---
function renderWidgetCanvas() {
  const canvas = document.getElementById("widgetCanvas");
  const ctx = canvas.getContext("2d");

  const width = canvas.width;  // 1080
  const height = canvas.height; // 1920

  // Background Gradient
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#0f0c20');
  grad.addColorStop(0.5, '#2b0826');
  grad.addColorStop(1, '#0b0410');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Decorative Background Floating Hearts
  drawGlowingHeart(ctx, width * 0.15, height * 0.15, 140, 'rgba(255, 42, 109, 0.15)');
  drawGlowingHeart(ctx, width * 0.85, height * 0.85, 160, 'rgba(255, 42, 109, 0.12)');

  // Title / Couples Names
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 68px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  const names = `${appState.partner1 || 'Seçkin'} & ${appState.partner2 || 'Tuğçe'}`;
  ctx.fillText(names, width / 2, height * 0.30);

  ctx.fillStyle = '#ff85a2';
  ctx.font = '36px "Outfit", sans-serif';
  ctx.fillText('Birlikte Geçen Her An ❤️', width / 2, height * 0.35);

  // Widget Container Backdrop
  const boxW = 960;
  const boxH = 460;
  const boxX = (width - boxW) / 2;
  const boxY = height * 0.40;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 4;
  roundRect(ctx, boxX, boxY, boxW, boxH, 40, true, true);

  // Current counter values
  const yVal = document.getElementById("counterYears").innerText;
  const mVal = document.getElementById("counterMonths").innerText;
  const dVal = document.getElementById("counterDays").innerText;
  const hVal = document.getElementById("counterHours").innerText;
  const minVal = document.getElementById("counterMinutes").innerText;

  const units = [
    { label: 'YIL', val: yVal },
    { label: 'AY', val: mVal },
    { label: 'GÜN', val: dVal },
    { label: 'SAAT', val: hVal },
    { label: 'DK', val: minVal }
  ];

  const colWidth = boxW / 5;
  units.forEach((u, i) => {
    const cx = boxX + colWidth * i + colWidth / 2;
    const cy = boxY + boxH / 2 - 35;
    const heartSize = 165;

    // Draw Individual Heart Shape for this specific number!
    drawWidgetHeartShape(ctx, cx, cy, heartSize, 'rgba(255, 42, 109, 0.35)', '#ff2a6d');

    // Render Number Inside Center of Heart
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(u.val, cx, cy + 50);

    // Render Unit Label Inside/Below Heart
    ctx.fillStyle = '#ffb703';
    ctx.font = 'bold 24px "Outfit", sans-serif';
    ctx.fillText(u.label, cx, cy + 96);
  });

  // Footer Quote
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = 'italic 34px "Outfit", sans-serif';
  ctx.fillText('"Seni Sevmek En Güzel Zamanı Yaşamaktır"', width / 2, height * 0.78);
}

function drawWidgetHeartShape(ctx, cx, cy, size, fillColor, strokeColor) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  const topCurveHeight = size * 0.3;
  ctx.moveTo(0, topCurveHeight);
  ctx.bezierCurveTo(0, 0, -size / 2, 0, -size / 2, topCurveHeight);
  ctx.bezierCurveTo(-size / 2, (size + topCurveHeight) / 2, 0, size, 0, size);
  ctx.bezierCurveTo(0, size, size / 2, (size + topCurveHeight) / 2, size / 2, topCurveHeight);
  ctx.bezierCurveTo(size / 2, 0, 0, 0, 0, topCurveHeight);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  ctx.restore();
}

function drawGlowingHeart(ctx, cx, cy, size, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  const topCurveHeight = size * 0.3;
  ctx.moveTo(0, topCurveHeight);
  ctx.bezierCurveTo(0, 0, -size / 2, 0, -size / 2, topCurveHeight);
  ctx.bezierCurveTo(-size / 2, (size + topCurveHeight) / 2, 0, size, 0, size);
  ctx.bezierCurveTo(0, size, size / 2, (size + topCurveHeight) / 2, size / 2, topCurveHeight);
  ctx.bezierCurveTo(size / 2, 0, 0, 0, 0, topCurveHeight);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function downloadWidgetImage() {
  const canvas = document.getElementById("widgetCanvas");
  const link = document.createElement("a");
  link.download = `Ask_Sayaci_Kilit_Ekrani_Widget_${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// --- PWA INSTALL PROMPT LOGIC ---
let deferredPrompt = null;
function setupPwaInstaller() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = document.getElementById("pwaInstallBanner");
    if (banner) banner.style.display = "flex";
  });

  document.getElementById("btnPwaInstall")?.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('PWA Uygulama olarak yüklendi');
      }
      deferredPrompt = null;
      document.getElementById("pwaInstallBanner").style.display = "none";
    } else {
      alert("Safari / iOS kullanıyorsanız: Alt kısımdaki Paylaş butonuna basıp 'Ana Ekrana Ekle' seçeneğine dokunun ❤️");
    }
  });

  document.getElementById("closePwaBanner")?.addEventListener("click", () => {
    const banner = document.getElementById("pwaInstallBanner");
    if (banner) banner.style.display = "none";
  });
}

// --- NOTE MODAL & REMINDER LOGIC ---
window.openNoteModalForNew = function() {
  document.getElementById("noteId").value = "";
  document.getElementById("noteTitle").value = "";
  document.getElementById("noteCategory").value = "💖";
  document.getElementById("noteBody").value = "";
  document.getElementById("noteReminderEnabled").checked = false;
  document.getElementById("reminderTimeControls").style.display = "none";
  
  const defaultRem = new Date(Date.now() + 3600000).toISOString().slice(0, 16);
  document.getElementById("noteReminderDateTime").value = defaultRem;

  document.getElementById("btnDeleteNote").style.display = "none";
  document.getElementById("noteModalTitle").innerText = "Özel Not & Hatırlatıcı Ekle 📝";
  document.getElementById("noteModal").classList.add("active");
};

function openNoteModalForEdit(id) {
  const note = userNotes.find(n => n.id === id);
  if (!note) return;

  document.getElementById("noteId").value = note.id;
  document.getElementById("noteTitle").value = note.title || "";
  document.getElementById("noteCategory").value = note.category || "💖";
  document.getElementById("noteBody").value = note.body || "";
  document.getElementById("noteReminderEnabled").checked = !!note.reminderEnabled;
  document.getElementById("reminderTimeControls").style.display = note.reminderEnabled ? "block" : "none";
  document.getElementById("noteReminderDateTime").value = note.reminderDateTime || new Date(Date.now() + 3600000).toISOString().slice(0, 16);

  document.getElementById("btnDeleteNote").style.display = "inline-block";
  document.getElementById("noteModalTitle").innerText = "Notu & Hatırlatıcıyı Düzenle 📝";
  document.getElementById("noteModal").classList.add("active");
}

function closeNoteModal() {
  document.getElementById("noteModal").classList.remove("active");
}

async function handleNoteFormSubmit(e) {
  e.preventDefault();
  const existingId = document.getElementById("noteId").value;
  const id = existingId || "note_" + Date.now();

  const noteObj = {
    id,
    title: document.getElementById("noteTitle").value.trim(),
    category: document.getElementById("noteCategory").value,
    body: document.getElementById("noteBody").value.trim(),
    reminderEnabled: document.getElementById("noteReminderEnabled").checked,
    reminderDateTime: document.getElementById("noteReminderDateTime").value,
    createdAt: new Date().toISOString()
  };

  await saveUserNote(noteObj);
  renderUserNotes();
  closeNoteModal();
}

async function handleNoteDelete() {
  const id = document.getElementById("noteId").value;
  if (!id) return;
  showCustomConfirmModal("Notu Sil 📝", "Bu özel notu silmek istediğinizden emin misiniz?", async () => {
    await deleteUserNote(id);
    renderUserNotes();
    closeNoteModal();
  });
}

// --- FUTURE PLAN MODAL LOGIC ---
function openFutureModalForDate(dateStr) {
  document.getElementById("futurePlanId").value = "";
  document.getElementById("futureTitle").value = "";
  document.getElementById("futureCategory").value = "✈️";
  document.getElementById("futureNotes").value = "";
  document.getElementById("futureStatus").value = "planned";
  document.getElementById("futureTargetDate").value = `${dateStr}T12:00`;
  document.getElementById("btnDeleteFuturePlan").style.display = "none";
  document.getElementById("futureModalTitle").innerText = "Gelecek Planı Ekle ✨";
  document.getElementById("futureModal").classList.add("active");
}

function openFutureModalForEdit(id) {
  const plan = futurePlans.find(p => p.id === id);
  if (!plan) return;

  document.getElementById("futurePlanId").value = plan.id;
  document.getElementById("futureTitle").value = plan.title || "";
  document.getElementById("futureCategory").value = plan.category || "✈️";
  document.getElementById("futureNotes").value = plan.notes || "";
  document.getElementById("futureStatus").value = plan.status || "planned";
  document.getElementById("futureTargetDate").value = plan.targetDate || "";
  document.getElementById("btnDeleteFuturePlan").style.display = "inline-block";
  document.getElementById("futureModalTitle").innerText = "Gelecek Planını Düzenle ✨";
  document.getElementById("futureModal").classList.add("active");
}

function closeFutureModal() {
  document.getElementById("futureModal").classList.remove("active");
}

async function handleFutureFormSubmit(e) {
  e.preventDefault();
  const existingId = document.getElementById("futurePlanId").value;
  const id = existingId || "plan_" + Date.now();

  const planObj = {
    id,
    title: document.getElementById("futureTitle").value.trim(),
    targetDate: document.getElementById("futureTargetDate").value,
    category: document.getElementById("futureCategory").value,
    notes: document.getElementById("futureNotes").value.trim(),
    status: document.getElementById("futureStatus").value
  };

  await saveFuturePlan(planObj);
  renderFuturePlans();
  renderFutureCalendar(currentFutureCalDate);
  closeFutureModal();
}

async function handleFuturePlanDelete() {
  const id = document.getElementById("futurePlanId").value;
  if (!id) return;
  showCustomConfirmModal("Planı Sil ✨", "Bu gelecek planını silmek istediğinizden emin misiniz?", async () => {
    await deleteFuturePlan(id);
    renderFuturePlans();
    renderFutureCalendar(currentFutureCalDate);
    closeFutureModal();
  });
}

// --- SETUP ALL EVENT LISTENERS ---
function setupEventListeners() {
  const addTabClick = (id, tabName) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", () => switchTab(tabName));
  };

  addTabClick("tabCalendar", "calendar");
  addTabClick("tabTimeline", "timeline");
  addTabClick("tabGallery", "gallery");
  addTabClick("tabFuture", "future");
  addTabClick("tabNotes", "notes");

  addTabClick("bnavCalendar", "calendar");
  addTabClick("bnavTimeline", "timeline");
  addTabClick("bnavGallery", "gallery");
  addTabClick("bnavFuture", "future");
  addTabClick("bnavNotes", "notes");

  document.getElementById("btnPinLockscreenNotif")?.addEventListener("click", enablePersistentLockscreenNotification);
  document.getElementById("btnPinLockscreenModalBtn")?.addEventListener("click", enablePersistentLockscreenNotification);

  setupCropperDragListeners();

  document.getElementById("btnNotifications")?.addEventListener("click", () => {
    notifications.forEach(n => n.read = true);
    localStorage.setItem("love_counter_notifs", JSON.stringify(notifications));
    renderNotifications();
    document.getElementById("notificationsModal")?.classList.add("active");
  });
  document.getElementById("closeNotificationsModal")?.addEventListener("click", () => {
    document.getElementById("notificationsModal")?.classList.remove("active");
  });
  document.getElementById("btnClearAllNotifs")?.addEventListener("click", clearAllNotifications);
  document.getElementById("btnRequestNotifPerm")?.addEventListener("click", () => {
    if ("Notification" in window) {
      Notification.requestPermission().then(permission => {
        renderNotifications();
        if (permission === "granted") {
          sendNativeLockscreenNotification("Bildirimler Etkinleştirildi ❤️", "Kilit ekranınızda gelecek planlarınız ve özel not hatırlatıcılarınız günü geldiğinde bildirilecektir.");
        }
      });
    }
  });

  window.changeCalendarMonth = function(delta) {
    currentCalDate = new Date(currentCalDate.getFullYear(), currentCalDate.getMonth() + delta, 1);
    renderCalendar(currentCalDate);
  };

  window.changeFutureCalendarMonth = function(delta) {
    currentFutureCalDate = new Date(currentFutureCalDate.getFullYear(), currentFutureCalDate.getMonth() + delta, 1);
    renderFutureCalendar(currentFutureCalDate);
  };

  document.getElementById("prevMonthBtn")?.addEventListener("click", () => changeCalendarMonth(-1));
  document.getElementById("nextMonthBtn")?.addEventListener("click", () => changeCalendarMonth(1));
  document.getElementById("prevFutureMonthBtn")?.addEventListener("click", () => changeFutureCalendarMonth(-1));
  document.getElementById("nextFutureMonthBtn")?.addEventListener("click", () => changeFutureCalendarMonth(1));

  document.getElementById("btnToggleNotificationSwitch")?.addEventListener("change", toggleNotificationState);
  document.getElementById("btnNotifications")?.addEventListener("click", openNotificationsModal);
  document.getElementById("btnSettings")?.addEventListener("click", openSettingsModal);
  document.getElementById("closeSettingsModal")?.addEventListener("click", closeSettingsModal);
  document.getElementById("settingsForm")?.addEventListener("submit", handleSettingsSubmit);

  document.getElementById("closeMemoryModal")?.addEventListener("click", closeMemoryModal);
  document.getElementById("memoryForm")?.addEventListener("submit", handleMemorySubmit);
  document.getElementById("btnDeleteMemory")?.addEventListener("click", handleMemoryDelete);
  window.openAddNewMemoryDirect = function() {
    const todayStr = new Date().toISOString().slice(0, 10);
    openMemoryModalForDate(todayStr);
  };

  window.openAddNewFuturePlanDirect = function() {
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    openFutureModalForDate(tomorrowStr);
  };

  document.getElementById("btnAddNewMemoryDirect")?.addEventListener("click", window.openAddNewMemoryDirect);
  document.getElementById("btnAddNewFuturePlan")?.addEventListener("click", window.openAddNewFuturePlanDirect);
  document.getElementById("closeFutureModal")?.addEventListener("click", closeFutureModal);
  document.getElementById("futureForm")?.addEventListener("submit", handleFutureFormSubmit);
  document.getElementById("btnDeleteFuturePlan")?.addEventListener("click", handleFuturePlanDelete);

  // Note Modal Event Listeners
  document.getElementById("btnAddNewNote")?.addEventListener("click", openNoteModalForNew);
  document.getElementById("closeNoteModal")?.addEventListener("click", closeNoteModal);
  document.getElementById("noteForm")?.addEventListener("submit", handleNoteFormSubmit);
  document.getElementById("btnDeleteNote")?.addEventListener("click", handleNoteDelete);

  document.getElementById("noteReminderEnabled")?.addEventListener("change", (e) => {
    const timeCtrl = document.getElementById("reminderTimeControls");
    if (timeCtrl) timeCtrl.style.display = e.target.checked ? "block" : "none";
  });

  // Quick Time Preset Buttons
  document.querySelectorAll(".btn-quick-time").forEach(btn => {
    btn.addEventListener("click", () => {
      const minutes = parseInt(btn.dataset.minutes, 10);
      if (!isNaN(minutes)) {
        const target = new Date(Date.now() + minutes * 60000);
        const dtInput = document.getElementById("noteReminderDateTime");
        if (dtInput) dtInput.value = target.toISOString().slice(0, 16);
      }
    });
  });

  // Note Filter Buttons
  document.querySelectorAll(".note-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".note-filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeNoteFilter = btn.dataset.filter;
      renderUserNotes();
    });
  });

  document.getElementById("btnLockscreenWidget")?.addEventListener("click", openLockscreenModal);
  document.getElementById("closeLockscreenModal")?.addEventListener("click", closeLockscreenModal);
  document.getElementById("subtabAmbient")?.addEventListener("click", () => switchSubtab("ambient"));
  document.getElementById("subtabGenerator")?.addEventListener("click", () => switchSubtab("generator"));
  document.getElementById("btnGenerateWidget")?.addEventListener("click", renderWidgetCanvas);
  document.getElementById("btnDownloadWidget")?.addEventListener("click", downloadWidgetImage);
  document.getElementById("btnToggleFullscreenAmbient")?.addEventListener("click", toggleFullscreenAmbient);

  document.getElementById("closePhotoViewer")?.addEventListener("click", closePhotoViewer);

  document.getElementById("btnExportData")?.addEventListener("click", exportDataJSON);
  document.getElementById("importFile")?.addEventListener("change", importDataJSON);

  // Love Quote Modal Event Listeners
  document.getElementById("btnLoveQuoteTrigger")?.addEventListener("click", openLoveQuoteModal);
  document.getElementById("closeLoveQuoteModal")?.addEventListener("click", closeLoveQuoteModal);
  document.getElementById("btnCloseLoveQuoteModalBtn")?.addEventListener("click", closeLoveQuoteModal);
  document.getElementById("btnNewLoveQuote")?.addEventListener("click", showNextLoveQuote);
  document.getElementById("btnNextInlineQuote")?.addEventListener("click", showNextLoveQuote);
}

window.switchMainPage = function(pageName) {
  const homeView    = document.getElementById("mainHomeView");
  const galleryView = document.getElementById("mainGalleryView");
  const profileView = document.getElementById("mainProfileView");
  const dietView    = document.getElementById("mainDietView");

  const bHome    = document.getElementById("bnavHome");
  const bGallery = document.getElementById("bnavGallery");
  const bProfile = document.getElementById("bnavProfile");
  const bDiet    = document.getElementById("bnavDiet");

  if (homeView)    homeView.style.display    = (pageName === "home")    ? "block" : "none";
  if (galleryView) galleryView.style.display = (pageName === "gallery") ? "block" : "none";
  if (profileView) profileView.style.display = (pageName === "profile") ? "block" : "none";
  if (dietView)    dietView.style.display    = (pageName === "diet")    ? "block" : "none";

  if (bHome)    bHome.classList.toggle("active",    pageName === "home");
  if (bGallery) bGallery.classList.toggle("active", pageName === "gallery");
  if (bProfile) bProfile.classList.toggle("active", pageName === "profile");
  if (bDiet)    bDiet.classList.toggle("active",    pageName === "diet");

  if (pageName === "gallery") {
    renderPhotoLibrary();
  } else if (pageName === "profile") {
    renderProfilePage();
  } else if (pageName === "home") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (pageName === "diet") {
    renderDietPage();
  }
};


function switchTab(tabName) {
  const tabs = [
    { name: "calendar", top: "tabCalendar", bnav: "bnavCalendar", sec: "calendarSection" },
    { name: "timeline", top: "tabTimeline", bnav: "bnavTimeline", sec: "timelineSection" },
    { name: "gallery",  top: "tabGallery",  bnav: "bnavGallery",  sec: "gallerySection" },
    { name: "future",   top: "tabFuture",   bnav: "bnavFuture",   sec: "futureSection" },
    { name: "notes",    top: "tabNotes",    bnav: "bnavNotes",    sec: "notesSection" }
  ];

  tabs.forEach(item => {
    const isTarget = (item.name === tabName);

    const topBtn = document.getElementById(item.top);
    if (topBtn) topBtn.classList.toggle("active", isTarget);

    const section = document.getElementById(item.sec);
    if (section) {
      if (isTarget) {
        section.classList.add("active");
        section.style.display = "block";
      } else {
        section.classList.remove("active");
        section.style.display = "none";
      }
    }
  });

  if (tabName === "timeline") {
    renderTimeline();
  } else if (tabName === "gallery") {
    renderPhotoLibrary();
  } else if (tabName === "future") {
    renderFuturePlans();
    renderFutureCalendar(currentFutureCalDate);
  } else if (tabName === "notes") {
    renderUserNotes();
  }

  // Smooth scroll down so the active section animates right into view
  const activeSec = document.querySelector(".view-section.active");
  if (activeSec) {
    setTimeout(() => {
      activeSec.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }
}


// ==========================================================================
// 🎨 DYNAMIC APP COLOR THEME ENGINE
// ==========================================================================
let currentAppTheme = localStorage.getItem("love_app_theme") || "neon";

window.applyAppTheme = function(themeKey) {
  currentAppTheme = themeKey;
  document.documentElement.setAttribute("data-theme", themeKey);
  localStorage.setItem("love_app_theme", themeKey);

  document.querySelectorAll(".theme-card-option").forEach(card => {
    card.classList.remove("active");
  });

  const activeCard = document.getElementById(`themeCard_${themeKey}`);
  if (activeCard) activeCard.classList.add("active");
};

// Immediately apply theme on startup
(function initTheme() {
  document.documentElement.setAttribute("data-theme", currentAppTheme);
})();

// Settings Modal Handler & Subtab Switching
window.switchSettingsSubtab = function(tabName) {
  const tabNotif = document.getElementById("tabSetNotif");
  const tabTheme = document.getElementById("tabSetTheme");
  const tabDate = document.getElementById("tabSetDate");
  const tabBackup = document.getElementById("tabSetBackup");

  const secNotif = document.getElementById("setSecNotif");
  const secTheme = document.getElementById("setSecTheme");
  const secDate = document.getElementById("setSecDate");
  const secBackup = document.getElementById("setSecBackup");

  if (tabNotif) tabNotif.classList.toggle("active", tabName === "notif");
  if (tabTheme) tabTheme.classList.toggle("active", tabName === "theme");
  if (tabDate) tabDate.classList.toggle("active", tabName === "date");
  if (tabBackup) tabBackup.classList.toggle("active", tabName === "backup");

  if (secNotif) secNotif.style.display = tabName === "notif" ? "block" : "none";
  if (secTheme) secTheme.style.display = tabName === "theme" ? "block" : "none";
  if (secDate) secDate.style.display = tabName === "date" ? "block" : "none";
  if (secBackup) secBackup.style.display = tabName === "backup" ? "block" : "none";

  if (tabName === "theme") {
    applyAppTheme(currentAppTheme);
  }
};

window.openSettingsModal = function() {
  try {
    const p1 = document.getElementById("inputPartner1");
    const p2 = document.getElementById("inputPartner2");
    const dt = document.getElementById("inputStartDate");
    const modal = document.getElementById("settingsModal");

    if (p1) p1.value = appState.partner1 || "Seçkin";
    if (p2) p2.value = appState.partner2 || "Tuğçe";
    if (dt && appState.startDate) dt.value = appState.startDate;

    switchSettingsSubtab("notif");
    if (modal) modal.classList.add("active");
  } catch (err) {
    console.error("openSettingsModal error:", err);
  }
};

window.openDateEditModal = function() {
  try {
    const p1 = document.getElementById("inputPartner1");
    const p2 = document.getElementById("inputPartner2");
    const dt = document.getElementById("inputStartDate");
    const modal = document.getElementById("settingsModal");

    if (p1) p1.value = appState.partner1 || "Seçkin";
    if (p2) p2.value = appState.partner2 || "Tuğçe";
    if (dt && appState.startDate) dt.value = appState.startDate;

    switchSettingsSubtab("date");
    if (modal) modal.classList.add("active");
  } catch (err) {
    console.error("openDateEditModal error:", err);
  }
};

window.closeSettingsModal = function() {
  try {
    const modal = document.getElementById("settingsModal");
    if (modal) modal.classList.remove("active");
  } catch (err) {
    console.error("closeSettingsModal error:", err);
  }
};

async function handleSettingsSubmit(e) {
  e.preventDefault();
  appState.partner1 = document.getElementById("inputPartner1").value.trim();
  appState.partner2 = document.getElementById("inputPartner2").value.trim();
  appState.startDate = document.getElementById("inputStartDate").value;

  const file1 = document.getElementById("inputAvatar1").files[0];
  const file2 = document.getElementById("inputAvatar2").files[0];

  if (file1) appState.avatar1 = await readFileAsBase64(file1);
  if (file2) appState.avatar2 = await readFileAsBase64(file2);

  saveAppState();
  renderCouplesHeader();
  updateCounterDisplay();
  renderCalendar(currentCalDate);
  closeSettingsModal();
}

// Memory Modal Handler
function openMemoryModalForDate(dateStr) {
  if (!dateStr) dateStr = new Date().toISOString().slice(0, 10);
  selectedMemoryPhotos = [];
  document.getElementById("memoryDate").value = dateStr;

  let formattedDate = dateStr;
  try {
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      formattedDate = d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
    }
  } catch (err) {
    console.error(err);
  }

  document.getElementById("memorySelectedDateText").innerText = `📅 Seçilen Tarih: ${formattedDate}`;

  const existing = memories.find(m => m.date === dateStr);
  if (existing) {
    document.getElementById("memoryId").value = existing.id;
    document.getElementById("memoryTitle").value = existing.title || "";
    document.getElementById("memoryCategory").value = existing.category || "❤️";
    document.getElementById("memoryNotes").value = existing.notes || "";
    document.getElementById("btnDeleteMemory").style.display = "inline-block";
    selectedMemoryPhotos = existing.photos ? [...existing.photos] : [];
    document.getElementById("memoryModalTitle").innerText = "Anıyı Düzenle";
  } else {
    document.getElementById("memoryId").value = "";
    document.getElementById("memoryTitle").value = "";
    document.getElementById("memoryCategory").value = "❤️";
    document.getElementById("memoryNotes").value = "";
    document.getElementById("btnDeleteMemory").style.display = "none";
    document.getElementById("memoryModalTitle").innerText = "Tarih İçin Anı / Not Ekle";
  }

  renderPhotoPreviews();
  document.getElementById("memoryModal").classList.add("active");
}

function closeMemoryModal() {
  document.getElementById("memoryModal").classList.remove("active");
}

async function handlePhotoSelect(e) {
  const files = Array.from(e.target.files);
  for (const file of files) {
    const base64 = await readFileAsBase64(file);
    selectedMemoryPhotos.push(base64);
  }
  renderPhotoPreviews();
}

function renderPhotoPreviews() {
  const container = document.getElementById("photoPreviewContainer");
  container.innerHTML = selectedMemoryPhotos.map((p, idx) => `
    <div style="position:relative">
      <img src="${p}" class="photo-preview-item">
      <button type="button" onclick="removePreviewPhoto(${idx})" style="position:absolute;top:-6px;right:-6px;background:#ff0055;color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:12px">&times;</button>
    </div>
  `).join('');
}

function removePreviewPhoto(idx) {
  showCustomConfirmModal("Fotoğrafı Kaldır 📸", "Bu fotoğrafı anıdan kaldırmak istediğinizden emin misiniz?", () => {
    selectedMemoryPhotos.splice(idx, 1);
    renderPhotoPreviews();
  });
}

window.renderGallery = function() {
  if (typeof renderPhotoLibrary === "function") renderPhotoLibrary();
};

async function handleMemorySubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  const date = document.getElementById("memoryDate")?.value || new Date().toISOString().slice(0, 10);
  const existingId = document.getElementById("memoryId")?.value;
  const id = existingId || "mem_" + Date.now();

  const titleVal = document.getElementById("memoryTitle")?.value.trim() || "Özel Anı";
  const notesVal = document.getElementById("memoryNotes")?.value.trim() || "";

  const memoryObj = {
    id,
    date,
    title: titleVal,
    category: document.getElementById("memoryCategory")?.value || "❤️",
    notes: notesVal,
    photos: Array.isArray(selectedMemoryPhotos) ? [...selectedMemoryPhotos] : []
  };

  await saveMemory(memoryObj);
  renderCalendar(currentCalDate);
  renderTimeline();
  renderPhotoLibrary();
  closeMemoryModal();
  showInfoModal("Anı Kaydedildi 💖", "Özel anınız başarıyla takvime ve galeriye eklendi!");
}

async function handleMemoryDelete() {
  const id = document.getElementById("memoryId")?.value;
  if (!id) return;
  showCustomConfirmModal("Anıyı Sil ❤️", "Bu anıyı silmek istediğinizden emin misiniz?", async () => {
    await deleteMemory(id);
    renderCalendar(currentCalDate);
    renderTimeline();
    renderPhotoLibrary();
    closeMemoryModal();
    showInfoModal("Silindi 🗑️", "Anı başarıyla silindi.");
  });
}

// Lockscreen Modal Logic
function openLockscreenModal() {
  updateAmbientClock();
  document.getElementById("lockscreenWidgetModal").classList.add("active");
  switchSubtab("ambient");
}

function closeLockscreenModal() {
  document.getElementById("lockscreenWidgetModal").classList.remove("active");
}

function switchSubtab(tab) {
  document.getElementById("subtabAmbient").classList.toggle("active", tab === "ambient");
  document.getElementById("subtabGenerator").classList.toggle("active", tab === "generator");
  document.getElementById("ambientModeView").classList.toggle("active", tab === "ambient");
  document.getElementById("generatorModeView").classList.toggle("active", tab === "generator");

  if (tab === "generator") {
    renderWidgetCanvas();
  }
}

function updateAmbientClock() {
  const now = new Date();
  const clockText = now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const dateText = now.toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" });

  const ambClock = document.getElementById("ambientClock");
  const ambDate = document.getElementById("ambientDate");
  if (ambClock) ambClock.innerText = clockText;
  if (ambDate) ambDate.innerText = dateText;
}

function updateAmbientLockscreen() {
  updateAmbientClock();
}

function toggleFullscreenAmbient() {
  const frame = document.querySelector(".ambient-phone-frame");
  if (frame.requestFullscreen) {
    frame.requestFullscreen();
  } else if (frame.webkitRequestFullscreen) {
    frame.webkitRequestFullscreen();
  }
}

// Photo Viewer
function openPhotoViewer(src, caption) {
  document.getElementById("fullPhotoImg").src = src;
  document.getElementById("fullPhotoCaption").innerText = caption || "";
  document.getElementById("photoViewerModal").classList.add("active");
}

// Backup & Restore
function exportDataJSON() {
  const exportData = {
    appState,
    memories,
    futurePlans,
    userNotes,
    notifications,
    version: 4,
    exportedAt: new Date().toISOString()
  };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
  const link = document.createElement("a");
  link.setAttribute("href", dataStr);
  link.setAttribute("download", `Ask_Sayaci_Yedek_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function importDataJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (data.appState) {
        appState = { ...DEFAULT_STATE, ...data.appState };
        saveAppState();
      }
      if (data.memories && Array.isArray(data.memories)) {
        memories = data.memories;
        for (const m of memories) {
          await saveMemory(m);
        }
      }
      if (data.futurePlans && Array.isArray(data.futurePlans)) {
        futurePlans = data.futurePlans;
        for (const p of futurePlans) {
          await saveFuturePlan(p);
        }
      }
      if (data.userNotes && Array.isArray(data.userNotes)) {
        userNotes = data.userNotes;
        for (const n of userNotes) {
          await saveUserNote(n);
        }
      }
      if (data.notifications && Array.isArray(data.notifications)) {
        notifications = data.notifications;
        for (const n of notifications) {
          await addNotificationItem(n);
        }
      }
      alert("Yedek başarıyla yüklendi! ❤️");
      location.reload();
    } catch (err) {
      alert("Hata: Geçersiz yedek dosyası!");
      console.error(err);
    }
  };
  reader.readAsText(file);
}

// Helpers
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Reg Error:', err));
  });
}

// ROMANTIC LOVE QUOTES LOGIC
const ROMANTIC_QUOTES = [
  "\"Hayatımın anlamı, aldığım her nefeste ve birlikte geçen her saniyemizde seni ilk günkü aşkla seviyorum... İyi ki hayatımdasın bir tanem ❤️✨\"",
  "\"Seninle geçen her anım, ömrümün en güzel şiiri. Zaman seninle akıp giderken kalbimde büyüyen tek şey sana olan sonsuz sevgim... 🌹💖\"",
  "\"Gözlerine her baktığımda ilk günkü aşkla atıyor kalbim. Sen benim dünümdün, bugünüm ve tüm geleceğimsin sevgili yarim... 💕🌸\"",
  "\"Dünyanın en güzel yeri senin yanında olduğum an. Birlikte geçen her saniyemiz ömrümün en kıymetli hazinesi... 💎✨\"",
  "\"Sen benim kalbimin en tatlı ritmi, hayatımın en güzel hediyesisin. Seni her şeyden çok seviyorum bitanem... 💘🥰\""
];
let currentQuoteIndex = 0;

window.openLoveQuoteModal = function() {
  const names = `${appState.partner1 || 'Seçkin'} & ${appState.partner2 || 'Tuğçe'}`;
  const modalAuthor = document.getElementById("loveQuoteSubtext");
  const modalText = document.getElementById("loveQuoteText");

  if (modalAuthor) modalAuthor.innerText = names;
  if (modalText) modalText.innerText = ROMANTIC_QUOTES[currentQuoteIndex];

  const modal = document.getElementById("loveQuoteModal");
  if (modal) {
    modal.classList.add("active");
  }
};

window.closeLoveQuoteModal = function() {
  const modal = document.getElementById("loveQuoteModal");
  if (modal) {
    modal.classList.remove("active");
  }
};

window.showNextLoveQuote = function() {
  currentQuoteIndex = (currentQuoteIndex + 1) % ROMANTIC_QUOTES.length;
  const names = `${appState.partner1 || 'Seçkin'} & ${appState.partner2 || 'Tuğçe'}`;

  const modalText = document.getElementById("loveQuoteText");
  const modalAuthor = document.getElementById("loveQuoteSubtext");
  if (modalText) {
    modalText.style.opacity = "0";
    setTimeout(() => {
      modalText.innerText = ROMANTIC_QUOTES[currentQuoteIndex];
      modalText.style.opacity = "1";
    }, 150);
  }
  if (modalAuthor) modalAuthor.innerText = names;
};

window.pinWidgetToHomeScreen = function() {
  if (window.AndroidBridge && typeof window.AndroidBridge.requestPinWidget === "function") {
    window.AndroidBridge.requestPinWidget();
  } else {
    alert("Widget'ı eklemek için telefonunuzun Ana Ekranında boş bir yere basılı tutup 'Widget'lar' seçeneğinden Aşk Sayacı'nı seçebilirsiniz. ❤️");
  }
};

// ═══════════════════════════════════════════════════════════════
// 💕 LOCKET TARZI ÇİFT WİDGET YÖNETİMİ
// ═══════════════════════════════════════════════════════════════

let locketWidgetMode = "count_up";
let locketWidgetTheme = "pink";
let locketPreviewInterval = null;
// 23 Şubat 2026, 20:11 (UTC+3) → epoch millis
const LOCKET_DEFAULT_START = 1771866660000;

const WIDGET_THEMES = {
  pink: {
    bg: "linear-gradient(180deg, #120c1f, #181028)",
    border: "#ff2a6d",
    heart: "#ff2a6d"
  },
  blue: {
    bg: "linear-gradient(180deg, #0a192f, #112240)",
    border: "#64ffda",
    heart: "#64ffda"
  },
  gold: {
    bg: "linear-gradient(180deg, #0d0d0d, #1e1e1e)",
    border: "#ffd700",
    heart: "#ffd700"
  },
  emerald: {
    bg: "linear-gradient(180deg, #0a1f1c, #12332e)",
    border: "#00f5d4",
    heart: "#00f5d4"
  },
  rose: {
    bg: "linear-gradient(180deg, #1f0a10, #33121c)",
    border: "#ff4d6d",
    heart: "#ff4d6d"
  }
};

/**
 * Widget modunu değiştirir (count_up / countdown)
 */
window.setWidgetMode = function(mode) {
  locketWidgetMode = mode;
  const btnUp = document.getElementById("modeCountUp");
  const btnDown = document.getElementById("modeCountdown");
  const targetSection = document.getElementById("countdownTargetSection");

  if (mode === "count_up") {
    if (btnUp) btnUp.style.opacity = "1";
    if (btnDown) btnDown.style.opacity = "0.5";
    if (targetSection) targetSection.style.display = "none";
  } else {
    if (btnUp) btnUp.style.opacity = "0.5";
    if (btnDown) btnDown.style.opacity = "1";
    if (targetSection) targetSection.style.display = "block";
  }
  updateLocketPreview();
};

/**
 * Widget renk temasını değiştirir
 */
window.setWidgetTheme = function(themeName) {
  if (!WIDGET_THEMES[themeName]) return;
  locketWidgetTheme = themeName;
  const themes = ["pink", "blue", "gold", "emerald", "rose"];
  themes.forEach(t => {
    const btn = document.getElementById(`wTheme_${t}`);
    if (btn) {
      btn.style.border = (t === themeName) ? `2px solid ${WIDGET_THEMES[t].border}` : "1px solid rgba(255,255,255,0.2)";
    }
  });
  updateLocketPreview();
};

/**
 * Widget toggle (aktif/deaktif)
 */
window.toggleLocketWidgetState = function(e) {
  const isActive = e.target.checked;
  if (window.AndroidBridge) {
    if (isActive) {
      saveLocketWidgetSettings();
      window.AndroidBridge.activateWidget();
    } else {
      window.AndroidBridge.deactivateWidget();
    }
  }
  if (isActive) {
    startLocketPreviewTimer();
  } else {
    stopLocketPreviewTimer();
  }
};

let widgetAvatar1Base64 = null;
let widgetAvatar2Base64 = null;

/**
 * Widget için avatar fotoğrafı seçme tetiği
 */
window.selectWidgetAvatar = function(num) {
  const fileInput = document.getElementById(`widgetAvatarFile${num}`);
  if (fileInput) fileInput.click();
};

/**
 * Seçilen avatar dosyasını Base64'e dönüştürüp kaydeder
 */
window.handleWidgetAvatarFile = function(num, event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result;
    if (num === 1) {
      widgetAvatar1Base64 = base64;
      const btnRemove = document.getElementById("btnRemoveWidgetAvatar1");
      if (btnRemove) btnRemove.style.display = "inline-block";
    } else {
      widgetAvatar2Base64 = base64;
      const btnRemove = document.getElementById("btnRemoveWidgetAvatar2");
      if (btnRemove) btnRemove.style.display = "inline-block";
    }
    updateLocketPreview();
    showToast(`📷 Partner ${num} fotoğrafı yüklendi!`);
  };
  reader.readAsDataURL(file);
};

/**
 * Widget avatar fotoğrafını kaldırır (baş harfe döner)
 */
window.removeWidgetAvatar = function(num) {
  if (num === 1) {
    widgetAvatar1Base64 = null;
    const btnRemove = document.getElementById("btnRemoveWidgetAvatar1");
    if (btnRemove) btnRemove.style.display = "none";
    const fileInput = document.getElementById("widgetAvatarFile1");
    if (fileInput) fileInput.value = "";
  } else {
    widgetAvatar2Base64 = null;
    const btnRemove = document.getElementById("btnRemoveWidgetAvatar2");
    if (btnRemove) btnRemove.style.display = "none";
    const fileInput = document.getElementById("widgetAvatarFile2");
    if (fileInput) fileInput.value = "";
  }
  updateLocketPreview();
  showToast(`Partner ${num} fotoğrafı kaldırıldı, harf moduna geçildi.`);
};

/**
 * Widget ayarlarını kaydeder ve Android'e gönderir
 */
window.saveLocketWidgetSettings = function() {
  const name1 = document.getElementById("widgetName1")?.value || "Tuğçe";
  const name2 = document.getElementById("widgetName2")?.value || "Seçkin";
  const status = document.getElementById("widgetStatusMsg")?.value || "Birlikte 💕";
  const countdownLabel = document.getElementById("widgetCountdownLabel")?.value || "Tekrar Görüşmeye:";
  const targetDateInput = document.getElementById("widgetTargetDate")?.value;

  let targetDate = 0;
  if (targetDateInput) {
    targetDate = new Date(targetDateInput).getTime();
  }

  const settings = {
    name1: name1,
    name2: name2,
    avatar1: widgetAvatar1Base64 || "",
    avatar2: widgetAvatar2Base64 || "",
    status: status,
    mode: locketWidgetMode,
    theme: locketWidgetTheme,
    start_date: LOCKET_DEFAULT_START,
    target_date: targetDate,
    countdown_label: countdownLabel
  };

  // localStorage'a kaydet
  localStorage.setItem("locketWidgetSettings", JSON.stringify(settings));

  // Android Bridge'e gönder
  if (window.AndroidBridge && typeof window.AndroidBridge.saveWidgetSettings === "function") {
    window.AndroidBridge.saveWidgetSettings(JSON.stringify(settings));
    window.AndroidBridge.activateWidget();
  }

  // Toggle'ı aktif yap
  const toggle = document.getElementById("toggleLocketWidget");
  if (toggle) toggle.checked = true;

  // Önizlemeyi güncelle
  updateLocketPreview();
  startLocketPreviewTimer();

  // Başarı bildirimi göster
  showToast("💕 Widget ayarları kaydedildi ve güncellendi!");
};

/**
 * Widget'ı ana ekrana pin'le
 */
window.pinLocketWidget = function() {
  saveLocketWidgetSettings();
  if (window.AndroidBridge && typeof window.AndroidBridge.requestPinWidget === "function") {
    window.AndroidBridge.requestPinWidget();
    showToast("📌 Widget ana ekrana ekleniyor...");
  } else {
    showToast("Widget'ı eklemek için ana ekranda boş yere basılı tutup Widget'lar menüsünden S❤T'yi seçin.");
  }
};

/**
 * Canlı önizlemeyi günceller (Fotoğraflı, Harfli ve Tema Destekli)
 */
function updateLocketPreview() {
  const name1 = document.getElementById("widgetName1")?.value || "Tuğçe";
  const name2 = document.getElementById("widgetName2")?.value || "Seçkin";
  const status = document.getElementById("widgetStatusMsg")?.value || "Birlikte 💕";

  const themeConfig = WIDGET_THEMES[locketWidgetTheme] || WIDGET_THEMES.pink;

  // Önizleme Kartı Tema Renkleri
  const previewCard = document.getElementById("locketWidgetPreview");
  if (previewCard) {
    previewCard.style.background = themeConfig.bg;
    previewCard.style.border = `1px solid ${themeConfig.border}60`;
  }

  // Cam Kutucuklar Teması
  document.querySelectorAll(".preview-glass-tile").forEach(tile => {
    tile.style.borderColor = themeConfig.border;
  });

  // Avatarlar
  const a1 = document.getElementById("previewAvatar1");
  const a2 = document.getElementById("previewAvatar2");
  
  if (a1) {
    a1.style.borderColor = themeConfig.border;
    if (widgetAvatar1Base64) {
      a1.style.backgroundImage = `url('${widgetAvatar1Base64}')`;
      a1.style.backgroundSize = "cover";
      a1.style.backgroundPosition = "center";
      a1.textContent = "";
    } else {
      a1.style.backgroundImage = "none";
      a1.textContent = name1.charAt(0).toUpperCase();
    }
  }

  if (a2) {
    a2.style.borderColor = themeConfig.border;
    if (widgetAvatar2Base64) {
      a2.style.backgroundImage = `url('${widgetAvatar2Base64}')`;
      a2.style.backgroundSize = "cover";
      a2.style.backgroundPosition = "center";
      a2.textContent = "";
    } else {
      a2.style.backgroundImage = "none";
      a2.textContent = name2.charAt(0).toUpperCase();
    }
  }

  // İsimler
  const n1 = document.getElementById("previewName1");
  const n2 = document.getElementById("previewName2");
  if (n1) n1.textContent = name1;
  if (n2) n2.textContent = name2;

  // Durum
  const st = document.getElementById("previewStatus");
  if (st) st.textContent = status;

  // Sayaç güncelle
  updateLocketPreviewTimer();
}

/**
 * Canlı önizleme sayacını günceller (Ay, Gün, Saat, Dakika)
 */
function updateLocketPreviewTimer() {
  const labelEl = document.getElementById("previewLabel");
  const monthsEl = document.getElementById("previewMonths");
  const daysEl = document.getElementById("previewDays");
  const hoursEl = document.getElementById("previewHours");
  const minsEl = document.getElementById("previewMins");

  if (!daysEl || !hoursEl || !minsEl) return;

  let startDate, endDate;
  if (locketWidgetMode === "countdown") {
    const targetInput = document.getElementById("widgetTargetDate")?.value;
    startDate = new Date();
    endDate = targetInput ? new Date(targetInput) : new Date();
    const lbl = document.getElementById("widgetCountdownLabel")?.value || "Tekrar Görüşmeye:";
    if (labelEl) labelEl.textContent = lbl;
  } else {
    startDate = new Date(LOCKET_DEFAULT_START);
    endDate = new Date();
    if (labelEl) labelEl.textContent = "Birlikte:";
  }

  if (endDate > startDate) {
    let temp = new Date(startDate.getTime());
    let months = 0;
    while (true) {
      temp.setMonth(temp.getMonth() + 1);
      if (temp > endDate) {
        temp.setMonth(temp.getMonth() - 1);
        break;
      }
      months++;
    }
    const remSecs = Math.floor((endDate.getTime() - temp.getTime()) / 1000);
    const days = Math.floor(remSecs / 86400);
    const hours = Math.floor((remSecs % 86400) / 3600);
    const mins = Math.floor((remSecs % 3600) / 60);

    if (monthsEl) monthsEl.textContent = months;
    daysEl.textContent = days;
    hoursEl.textContent = String(hours).padStart(2, "0");
    minsEl.textContent = String(mins).padStart(2, "0");
  } else {
    if (monthsEl) monthsEl.textContent = "0";
    daysEl.textContent = "0";
    hoursEl.textContent = "00";
    minsEl.textContent = "00";
  }
}

/**
 * Canlı önizleme zamanlayıcısını başlatır
 */
function startLocketPreviewTimer() {
  stopLocketPreviewTimer();
  updateLocketPreview();
  locketPreviewInterval = setInterval(updateLocketPreviewTimer, 1000);
}

/**
 * Canlı önizleme zamanlayıcısını durdurur
 */
function stopLocketPreviewTimer() {
  if (locketPreviewInterval) {
    clearInterval(locketPreviewInterval);
    locketPreviewInterval = null;
  }
}

/**
 * Toast mesajı göster (basit)
 */
function showToast(message) {
  // Mevcut showCustomConfirmModal varsa onu kullan, yoksa basit toast
  let toast = document.getElementById("locketToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "locketToast";
    toast.style.cssText = "position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.85); color:#fff; padding:12px 24px; border-radius:12px; font-size:0.85rem; z-index:99999; transition:opacity 0.3s; pointer-events:none; text-align:center; max-width:85%;";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = "1";
  setTimeout(() => { toast.style.opacity = "0"; }, 2500);
}

/**
 * Sayfa yüklendiğinde widget ayarlarını yükle
 */
function loadLocketWidgetSettings() {
  try {
    let settings = null;

    // Önce AndroidBridge'den yükle
    if (window.AndroidBridge && typeof window.AndroidBridge.getWidgetSettings === "function") {
      const raw = window.AndroidBridge.getWidgetSettings();
      if (raw && raw !== "{}") {
        settings = JSON.parse(raw);
      }
    }

    // Yoksa localStorage'dan
    if (!settings) {
      const local = localStorage.getItem("locketWidgetSettings");
      if (local) settings = JSON.parse(local);
    }

    if (settings) {
      if (settings.name1) document.getElementById("widgetName1").value = settings.name1;
      if (settings.name2) document.getElementById("widgetName2").value = settings.name2;
      if (settings.avatar1) {
        widgetAvatar1Base64 = settings.avatar1;
        const btn1 = document.getElementById("btnRemoveWidgetAvatar1");
        if (btn1) btn1.style.display = "inline-block";
      }
      if (settings.avatar2) {
        widgetAvatar2Base64 = settings.avatar2;
        const btn2 = document.getElementById("btnRemoveWidgetAvatar2");
        if (btn2) btn2.style.display = "inline-block";
      }
      if (settings.status) document.getElementById("widgetStatusMsg").value = settings.status;
      if (settings.countdown_label) document.getElementById("widgetCountdownLabel").value = settings.countdown_label;
      if (settings.mode) {
        locketWidgetMode = settings.mode;
        setWidgetMode(settings.mode);
      }
      if (settings.theme) {
        locketWidgetTheme = settings.theme;
        setWidgetTheme(settings.theme);
      }
      if (settings.target_date && settings.target_date > 0) {
        const d = new Date(settings.target_date);
        const iso = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + 'T' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
        document.getElementById("widgetTargetDate").value = iso;
      }

      // Toggle durumu
      const toggle = document.getElementById("toggleLocketWidget");
      if (toggle && settings.widget_active) {
        toggle.checked = true;
        startLocketPreviewTimer();
      }
    }

    // Her durumda önizlemeyi başlat
    updateLocketPreview();
    startLocketPreviewTimer();
  } catch (e) {
    console.error("Locket widget ayarları yüklenemedi:", e);
  }
}

// Input değişikliklerinde canlı önizleme güncelle
document.addEventListener("input", function(e) {
  const widgetInputIds = ["widgetName1", "widgetName2", "widgetStatusMsg", "widgetTargetDate", "widgetCountdownLabel"];
  if (widgetInputIds.includes(e.target.id)) {
    updateLocketPreview();
  }
});

// Sayfa hazır olduğunda widget ayarlarını yükle
setTimeout(loadLocketWidgetSettings, 500);


window.openNotificationsModal = function() {
  const modal = document.getElementById("notificationsModal");
  if (modal) {
    modal.classList.add("active");
  }
};

window.closeNotificationsModal = function() {
  const modal = document.getElementById("notificationsModal");
  if (modal) {
    modal.classList.remove("active");
  }
};

// ==========================================================================
// 📸 DEDICATED PHOTO LIBRARY, VERTICAL ALBUMS & PHOTO NOTES/EMOJIS
// ==========================================================================
let customAlbums = JSON.parse(localStorage.getItem("love_custom_albums") || "[]");
let standalonePhotos = JSON.parse(localStorage.getItem("love_standalone_photos") || "[]");
let activeSubScreenAlbumId = "all";
let currentViewingPhoto = null;
let currentSelectedEmoji = "";

function saveCustomAlbums() {
  localStorage.setItem("love_custom_albums", JSON.stringify(customAlbums));
}

function saveStandalonePhotos() {
  localStorage.setItem("love_standalone_photos", JSON.stringify(standalonePhotos));
}

window.renderPhotoLibrary = function() {
  closeAlbumDetailSubScreen();
  renderVerticalAlbums();
};

window.renderVerticalAlbums = function() {
  const container = document.getElementById("verticalAlbumsContainer");
  if (!container) return;

  let allPhotos = [];

  // 1. Collect photos from Date Memories
  if (Array.isArray(memories)) {
    memories.forEach(mem => {
      if (mem.photos && Array.isArray(mem.photos)) {
        mem.photos.forEach((src, idx) => {
          allPhotos.push({
            id: `mem_${mem.id}_${idx}`,
            src: src,
            type: "memory",
            albumId: "date_memories",
            caption: mem.title || "Tarihli Anı",
            emoji: mem.category || "❤️",
            note: mem.notes || "",
            date: mem.date || ""
          });
        });
      }
    });
  }

  // 2. Collect standalone uploaded photos
  standalonePhotos.forEach(p => {
    allPhotos.push({
      id: p.id,
      src: p.src,
      type: "standalone",
      albumId: p.albumId || "",
      caption: p.caption || "Galeriden Yüklenen",
      emoji: p.emoji || "",
      note: p.note || "",
      date: p.date || ""
    });
  });

  let cardsHtml = "";

  // Card 1: All Uploaded Photos Library
  const totalCount = allPhotos.length;
  const firstThumb = allPhotos.length > 0 ? `<img src="${allPhotos[0].src}" alt="Tüm Fotoğraflar">` : "🖼️";

  // --- Library Search Filtering ---
  const q = (typeof librarySearchQuery !== "undefined") ? librarySearchQuery : "";

  // Helper: does an album (by title or its photos' notes/captions) match the query?
  const albumTitleMatches = (title) => !q || title.toLowerCase().includes(q);
  const albumPhotosMatchQuery = (albumPhotos) => !q || albumPhotos.some(p =>
    (p.note || "").toLowerCase().includes(q) ||
    (p.caption || "").toLowerCase().includes(q)
  );

  // Card 1: All Photos - only hide if query doesn't match any photos' notes/captions
  const allPhotosMatch = !q || albumPhotosMatchQuery(allPhotos) || "tüm fotoğraflar kütüphanesi".includes(q);
  if (allPhotosMatch) {
    cardsHtml += `
      <div class="vertical-album-card" onclick="openAlbumDetailSubScreen('all')">
        <div class="vertical-album-left">
          <div class="vertical-album-thumb">${firstThumb}</div>
          <div class="vertical-album-info">
            <h4>🖼️ Tüm Fotoğraflar Kütüphanesi</h4>
            <p>${totalCount} Fotoğraf  •  Tüm Yüklenen Görseller</p>
          </div>
        </div>
        <div class="album-arrow">›</div>
      </div>
    `;
  }

  // Card 2: Date Memories Photos Album (if exists)
  const dateMemPhotos = allPhotos.filter(p => p.albumId === "date_memories");
  const dateMemMatch = !q || albumPhotosMatchQuery(dateMemPhotos) || "takvim tarihli anı fotoğrafları".includes(q);
  if (dateMemPhotos.length > 0 && dateMemMatch) {
    const memThumb = `<img src="${dateMemPhotos[0].src}" alt="Tarihli Anılar">`;
    cardsHtml += `
      <div class="vertical-album-card" onclick="openAlbumDetailSubScreen('date_memories')">
        <div class="vertical-album-left">
          <div class="vertical-album-thumb">${memThumb}</div>
          <div class="vertical-album-info">
            <h4>📅 Takvim Tarihli Anı Fotoğrafları</h4>
            <p>${dateMemPhotos.length} Fotoğraf  •  Özel Gün Anıları</p>
          </div>
        </div>
        <div class="album-arrow">›</div>
      </div>
    `;
  }

  // Custom Created Albums List (Alt Alta Listelenmiş Klasörler)
  if (customAlbums.length > 0) {
    customAlbums.forEach(album => {
      const albumPhotos = allPhotos.filter(p => p.albumId === album.id);
      const titleMatch = albumTitleMatches(album.title);
      const photoMatch = albumPhotosMatchQuery(albumPhotos);
      if (!q || titleMatch || photoMatch) {
        const thumb = albumPhotos.length > 0 ? `<img src="${albumPhotos[0].src}" alt="${escapeHtml(album.title)}">` : "📁";
        // Highlight matching photos count if search active
        const matchCount = q ? albumPhotos.filter(p =>
          (p.note || "").toLowerCase().includes(q) || (p.caption || "").toLowerCase().includes(q)
        ).length : 0;
        const matchLabel = q && matchCount > 0 ? ` • 🔍 ${matchCount} eşleşme` : "";

        cardsHtml += `
          <div class="vertical-album-card" onclick="openAlbumDetailSubScreen('${album.id}')">
            <div class="vertical-album-left">
              <div class="vertical-album-thumb">${thumb}</div>
              <div class="vertical-album-info">
                <h4>📁 ${escapeHtml(album.title)}</h4>
                <p>${albumPhotos.length} Fotoğraf${matchLabel}</p>
              </div>
            </div>
            <div class="album-arrow">›</div>
          </div>
        `;
      }
    });
  }

  // If search returned nothing
  if (q && cardsHtml === "") {
    cardsHtml = `
      <div style="text-align: center; padding: 32px 16px; color: var(--text-sub); background: rgba(255,255,255,0.03); border-radius: 18px; border: 1px dashed rgba(255,255,255,0.15);">
        <div style="font-size: 2.2rem; margin-bottom: 6px;">🔍</div>
        <p style="margin: 0; font-weight: bold; color: #ffffff;">"${escapeHtml(q)}" aramanıza uygun klasör veya fotoğraf bulunamadı.</p>
      </div>
    `;
  }

  container.innerHTML = cardsHtml;
  window.currentAllGalleryPhotos = allPhotos;

  renderQuickMainGalleryGrid(allPhotos);
};

function renderQuickMainGalleryGrid(allPhotos) {
  const gridEl = document.getElementById("quickMainGalleryGrid");
  const countEl = document.getElementById("quickGalleryCount");
  if (!gridEl) return;

  if (countEl) countEl.innerText = `${allPhotos.length} Fotoğraf`;

  if (allPhotos.length === 0) {
    gridEl.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 32px 16px; color: var(--text-sub); background: rgba(255,255,255,0.03); border-radius: 18px; border: 1px dashed rgba(255,255,255,0.15);">
        <div style="font-size: 2.2rem; margin-bottom: 6px;">📸</div>
        <p style="margin: 0; font-weight: bold; color: #ffffff;">Kütüphanede henüz fotoğraf yok.</p>
        <p style="font-size: 0.8rem; opacity: 0.8; margin-top: 4px;">Yukarıdaki "📸 Fotoğraf Yükle" butonuna basarak ilk anılarınızı ekleyebilirsiniz!</p>
      </div>
    `;
    return;
  }

  let gridHtml = "";
  allPhotos.slice(0, 12).forEach(p => {
    const emojiBadge = p.emoji ? `<span style="position:absolute; top:6px; right:6px; font-size:1.3rem; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8));">${p.emoji}</span>` : "";
    const noteBadge = p.note ? `<div class="gallery-photo-badge" style="color:#ffb703;">📝 ${escapeHtml(p.note)}</div>` : `<div class="gallery-photo-badge">📸 İncele</div>`;

    gridHtml += `
      <div class="gallery-photo-card" onclick="openPhotoViewerModal('${p.id}')">
        <img src="${p.src}" alt="${escapeHtml(p.caption)}" loading="lazy">
        ${emojiBadge}
        ${noteBadge}
      </div>
    `;
  });

  gridEl.innerHTML = gridHtml;
}

window.toggleAlbumOptionsMenu = function(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById("albumOptionsMenuDropdown");
  if (dropdown) {
    dropdown.style.display = (dropdown.style.display === "none" || !dropdown.style.display) ? "block" : "none";
  }
};

window.handleCurrentAlbumDelete = function() {
  const dropdown = document.getElementById("albumOptionsMenuDropdown");
  if (dropdown) dropdown.style.display = "none";

  if (!activeSubScreenAlbumId || activeSubScreenAlbumId === "all" || activeSubScreenAlbumId === "date_memories") return;
  const alb = customAlbums.find(a => a.id === activeSubScreenAlbumId);
  const title = alb ? alb.title : "Bu klasörü";

  showCustomConfirmModal("Klasörü Sil 📁", `"${title}" klasörünü silmek istediğinize emin misiniz? (Klasördeki fotoğraflar silinmez)`, () => {
    customAlbums = customAlbums.filter(a => a.id !== activeSubScreenAlbumId);
    saveCustomAlbums();
    closeAlbumDetailSubScreen();
    renderVerticalAlbums();
  });
};

window.openAlbumDetailSubScreen = function(albumId) {
  activeSubScreenAlbumId = albumId;
  const mainView = document.getElementById("photoLibraryMainView");
  const subScreen = document.getElementById("albumDetailSubScreen");

  if (mainView) mainView.style.display = "none";
  if (subScreen) subScreen.style.display = "block";

  const titleEl = document.getElementById("detailAlbumTitle");
  const countEl = document.getElementById("detailAlbumCount");
  const gridEl = document.getElementById("albumDetailGridContainer");
  const optionsBtn = document.getElementById("btnAlbumOptionsMenu");
  const optionsDropdown = document.getElementById("albumOptionsMenuDropdown");

  if (optionsDropdown) optionsDropdown.style.display = "none";
  const isCustom = (albumId !== "all" && albumId !== "date_memories");
  if (optionsBtn) optionsBtn.style.display = isCustom ? "inline-flex" : "none";

  let photos = [];
  if (albumId === "all") {
    if (titleEl) titleEl.innerText = "🖼️ Tüm Fotoğraflar Kütüphanesi";
    photos = window.currentAllGalleryPhotos || [];
  } else if (albumId === "date_memories") {
    if (titleEl) titleEl.innerText = "📅 Takvim Tarihli Anı Fotoğrafları";
    photos = (window.currentAllGalleryPhotos || []).filter(p => p.albumId === "date_memories");
  } else {
    const alb = customAlbums.find(a => a.id === albumId);
    if (titleEl) titleEl.innerText = alb ? `📁 ${alb.title}` : "📁 Klasör";
    photos = (window.currentAllGalleryPhotos || []).filter(p => p.albumId === albumId);
  }

  if (countEl) countEl.innerText = `${photos.length} Fotoğraf`;

  if (!gridEl) return;

  if (photos.length === 0) {
    gridEl.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 16px; color: var(--text-sub);">
        <div style="font-size: 2.5rem; margin-bottom: 8px;">📸</div>
        <p style="font-weight: bold; margin-bottom: 4px;">Bu klasörde henüz fotoğraf yok.</p>
        <p style="font-size: 0.8rem; opacity: 0.8;">Yukarıdaki "➕ Bu Klasöre Fotoğraf Yükle" butonuna basarak fotoğraflar ekleyebilirsiniz!</p>
      </div>
    `;
    return;
  }

  let gridHtml = "";
  photos.forEach(p => {
    const emojiBadge = p.emoji ? `<span style="position:absolute; top:6px; right:6px; font-size:1.3rem; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8));">${p.emoji}</span>` : "";
    const noteBadge = p.note ? `<div class="gallery-photo-badge" style="color:#ffb703;">📝 ${escapeHtml(p.note)}</div>` : `<div class="gallery-photo-badge">📸 İncele</div>`;

    gridHtml += `
      <div class="gallery-photo-card" onclick="openPhotoViewerModal('${p.id}')">
        <img src="${p.src}" alt="${escapeHtml(p.caption)}" loading="lazy">
        ${emojiBadge}
        ${noteBadge}
      </div>
    `;
  });

  gridEl.innerHTML = gridHtml;
};

window.closeAlbumDetailSubScreen = function() {
  const mainView = document.getElementById("photoLibraryMainView");
  const subScreen = document.getElementById("albumDetailSubScreen");

  if (mainView) mainView.style.display = "block";
  if (subScreen) subScreen.style.display = "none";
};

window.openNewAlbumModal = function() {
  const modal = document.getElementById("albumModal");
  const input = document.getElementById("inputAlbumTitle");
  if (input) input.value = "";
  if (modal) modal.classList.add("active");
};

window.closeAlbumModal = function() {
  const modal = document.getElementById("albumModal");
  if (modal) modal.classList.remove("active");
};

window.handleAlbumFormSubmit = function(e) {
  e.preventDefault();
  const input = document.getElementById("inputAlbumTitle");
  if (!input) return;
  const title = input.value.trim();
  if (!title) return;

  const newAlbum = {
    id: "album_" + Date.now(),
    title: title,
    createdAt: new Date().toISOString()
  };

  customAlbums.push(newAlbum);
  saveCustomAlbums();
  closeAlbumModal();
  renderVerticalAlbums();
  openAlbumDetailSubScreen(newAlbum.id);
};

window.deleteCustomAlbum = function(e, albumId) {
  if (e) e.stopPropagation();
  if (!confirm("Bu klasörü silmek istediğinize emin misiniz? (Klasördeki fotoğraflar silinmez)")) return;
  customAlbums = customAlbums.filter(a => a.id !== albumId);
  saveCustomAlbums();
  renderVerticalAlbums();
};

window.triggerDirectGalleryUpload = function() {
  const fileInput = document.getElementById("directGalleryFileInput");
  if (fileInput) fileInput.click();
};

window.handleDirectGalleryUpload = async function(e) {
  const files = Array.from(e.target.files);
  if (!files || files.length === 0) return;

  const targetAlbumId = (document.getElementById("albumDetailSubScreen")?.style.display === "block" && activeSubScreenAlbumId !== "all") ? activeSubScreenAlbumId : "";

  for (const file of files) {
    const base64 = await readFileAsBase64(file);
    standalonePhotos.push({
      id: "photo_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      src: base64,
      albumId: targetAlbumId,
      caption: file.name || "Galeriden Yüklenen",
      emoji: "",
      note: "",
      date: new Date().toISOString().split("T")[0]
    });
  }

  saveStandalonePhotos();
  e.target.value = "";

  renderVerticalAlbums();
  if (document.getElementById("albumDetailSubScreen")?.style.display === "block") {
    openAlbumDetailSubScreen(activeSubScreenAlbumId);
  }
};

window.setPhotoEmoji = function(emoji) {
  currentSelectedEmoji = emoji;
  const overlay = document.getElementById("fullPhotoEmojiOverlay");
  if (overlay) {
    overlay.innerText = emoji;
    overlay.style.display = emoji ? "block" : "none";
  }
};

window.openPhotoViewerModal = function(photoId) {
  const photo = window.currentAllGalleryPhotos?.find(p => p.id === photoId);
  if (!photo) return;

  currentViewingPhoto = photo;
  currentSelectedEmoji = photo.emoji || "";

  const img = document.getElementById("fullPhotoImg");
  const caption = document.getElementById("fullPhotoCaption");
  const subtext = document.getElementById("fullPhotoSubtext");
  const noteInput = document.getElementById("inputPhotoNote");
  const emojiOverlay = document.getElementById("fullPhotoEmojiOverlay");
  const modal = document.getElementById("photoViewerModal");

  if (img) img.src = photo.src;
  if (caption) caption.innerText = photo.caption || "Fotoğraf";
  if (noteInput) noteInput.value = photo.note || "";

  if (emojiOverlay) {
    emojiOverlay.innerText = currentSelectedEmoji;
    emojiOverlay.style.display = currentSelectedEmoji ? "block" : "none";
  }

  let detail = "";
  if (photo.albumId) {
    const album = customAlbums.find(a => a.id === photo.albumId);
    if (album) detail = `📁 Klasör: ${album.title}`;
  } else {
    detail = `📸 Fotoğraf Kütüphanesi`;
  }
  if (subtext) subtext.innerText = detail;

  if (modal) modal.classList.add("active");
};

window.closePhotoViewer = function() {
  const modal = document.getElementById("photoViewerModal");
  if (modal) modal.classList.remove("active");
  currentViewingPhoto = null;
};
window.closePhotoViewerModal = window.closePhotoViewer;

// Global Click Listener: Tapping outside modal card on dark backdrop closes modal
document.addEventListener("click", (e) => {
  if (e.target && e.target.classList.contains("modal-overlay")) {
    e.target.classList.remove("active");
  }
});

window.savePhotoNoteAndEmoji = function() {
  if (!currentViewingPhoto) return;

  const noteInput = document.getElementById("inputPhotoNote");
  const noteText = noteInput ? noteInput.value.trim() : "";

  currentViewingPhoto.emoji = currentSelectedEmoji;
  currentViewingPhoto.note = noteText;

  // Update standalonePhotos if this is a standalone photo
  const item = standalonePhotos.find(p => p.id === currentViewingPhoto.id);
  if (item) {
    item.emoji = currentSelectedEmoji;
    item.note = noteText;
    saveStandalonePhotos();
  }

  // Update memory photo caption/note if this is a memory photo
  if (currentViewingPhoto.type === "memory") {
    const parts = currentViewingPhoto.id.split("_");
    // id format: mem_{memId}_{idx}
    const memId = parts.slice(1, parts.length - 1).join("_");
    const mem = memories.find(m => m.id === memId);
    if (mem) {
      if (!mem.photoNotes) mem.photoNotes = {};
      mem.photoNotes[currentViewingPhoto.id] = { emoji: currentSelectedEmoji, note: noteText };
      saveMemory(mem).then(() => {});
    }
  }

  // Show inline success toast instead of closing modal
  const saveBtn = document.getElementById("btnSavePhotoNote");
  if (saveBtn) {
    const originalText = saveBtn.innerText;
    saveBtn.innerText = "✅ Kaydedildi!";
    saveBtn.disabled = true;
    setTimeout(() => {
      saveBtn.innerText = originalText;
      saveBtn.disabled = false;
    }, 1800);
  }

  // Refresh gallery in background without closing
  if (document.getElementById("albumDetailSubScreen")?.style.display === "block") {
    openAlbumDetailSubScreen(activeSubScreenAlbumId);
  } else {
    renderVerticalAlbums();
  }
};

// Library Search
let librarySearchQuery = "";

window.handleLibrarySearch = function() {
  const input = document.getElementById("librarySearchInput");
  const clearBtn = document.getElementById("btnClearLibrarySearch");
  librarySearchQuery = (input ? input.value.trim().toLowerCase() : "");
  if (clearBtn) clearBtn.style.display = librarySearchQuery ? "block" : "none";
  renderVerticalAlbums();
};

window.clearLibrarySearch = function() {
  const input = document.getElementById("librarySearchInput");
  const clearBtn = document.getElementById("btnClearLibrarySearch");
  if (input) input.value = "";
  if (clearBtn) clearBtn.style.display = "none";
  librarySearchQuery = "";
  renderVerticalAlbums();
};;

window.deleteCurrentGalleryPhoto = function() {
  if (!currentViewingPhoto) return;
  showCustomConfirmModal("Fotoğrafı Sil 📸", "Bu fotoğrafı silmek istediğinizden emin misiniz?", () => {
    standalonePhotos = standalonePhotos.filter(p => p.id !== currentViewingPhoto.id);
    saveStandalonePhotos();

    closePhotoViewer();
    renderVerticalAlbums();
    if (document.getElementById("albumDetailSubScreen")?.style.display === "block") {
      openAlbumDetailSubScreen(activeSubScreenAlbumId);
    }
  });
};

window.moveCurrentPhotoToAlbumPrompt = function() {
  if (!currentViewingPhoto) return;
  if (customAlbums.length === 0) {
    alert("Henüz hiç klasör oluşturmadınız! Lütfen önce '📁 Yeni Klasör Oluştur' butonuna basarak bir klasör ekleyin.");
    return;
  }

  let promptMsg = "Fotoğrafı taşımak istediğiniz klasörün numarasını yazın:\n\n";
  promptMsg += "0: Hiçbiri (Klasörsüz Yap)\n";
  customAlbums.forEach((alb, idx) => {
    promptMsg += `${idx + 1}: 📁 ${alb.title}\n`;
  });

  const choice = prompt(promptMsg);
  if (choice === null) return;

  const num = parseInt(choice, 10);
  let selectedAlbumId = "";
  if (num > 0 && num <= customAlbums.length) {
    selectedAlbumId = customAlbums[num - 1].id;
  }

  const item = standalonePhotos.find(p => p.id === currentViewingPhoto.id);
  if (item) {
    item.albumId = selectedAlbumId;
    saveStandalonePhotos();
  }

  closePhotoViewer();
  renderVerticalAlbums();
  if (document.getElementById("albumDetailSubScreen")?.style.display === "block") {
    openAlbumDetailSubScreen(activeSubScreenAlbumId);
  }
};

// ==========================================================================
// 👤 KİŞİSEL PROFİL, OTOMATİK BURÇ HESAPLAMA & KATEGORİLİ PAYLAŞIMLAR
// ==========================================================================
let rawProfile = JSON.parse(localStorage.getItem("love_user_profile") || "{}");
let userProfile = {
  name: rawProfile.name || "Tuğçe",
  avatar: rawProfile.avatar || "",
  coverPhoto: rawProfile.coverPhoto || "",
  birthday: rawProfile.birthday || "",
  hobbies: Array.isArray(rawProfile.hobbies) ? rawProfile.hobbies : (typeof rawProfile.hobbies === "string" && rawProfile.hobbies ? rawProfile.hobbies.split(",").map(s => s.trim()) : ["📚 Kitap Okumak", "🎵 Müzik", "📸 Fotoğrafçılık"]),
  bioText: rawProfile.bioText || "Aşkla ve neşeyle dolu her an en güzel hediyemdir... ✨"
};

let lovePosts = JSON.parse(localStorage.getItem("love_posts") || "[]");
let activePostCategoryFilter = "all";
let tempPostPhotoBase64 = "";
let tempEditHobbies = [];

function getZodiacSign(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return { name: "Koç", icon: "♈" };
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return { name: "Boğa", icon: "♉" };
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return { name: "İkizler", icon: "♊" };
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return { name: "Yengeç", icon: "♋" };
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return { name: "Aslan", icon: "♌" };
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return { name: "Başak", icon: "♍" };
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return { name: "Terazi", icon: "♎" };
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return { name: "Akrep", icon: "♏" };
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return { name: "Yay", icon: "♐" };
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return { name: "Oğlak", icon: "♑" };
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return { name: "Kova", icon: "♒" };
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return { name: "Balık", icon: "♓" };

  return null;
}

window.renderProfilePage = function() {
  const nameEl = document.getElementById("userProfName");
  const bioEl = document.getElementById("userProfBio");
  const bdayText = document.getElementById("userProfBdayText");
  const zodiacText = document.getElementById("userProfZodiacText");
  const avatarImg = document.getElementById("userProfAvatarImg");
  const coverBanner = document.getElementById("userProfCoverBanner");

  if (nameEl) nameEl.innerText = userProfile.name || appState.partner2Name || "Kullanıcı Adı";
  if (bioEl) bioEl.innerText = `"${userProfile.bioText || 'Kişisel biyografinizi ekleyin...'}"`;
  if (avatarImg && userProfile.avatar) avatarImg.src = userProfile.avatar;

  if (coverBanner) {
    if (userProfile.coverPhoto) {
      coverBanner.style.backgroundImage = `url("${userProfile.coverPhoto}")`;
    } else {
      coverBanner.style.backgroundImage = `linear-gradient(135deg, #ff2a6d, #ffb703)`;
    }
  }

  if (bdayText) {
    bdayText.innerText = userProfile.birthday ? `Doğum Tarihi: ${formatProfileDate(userProfile.birthday)}` : "Doğum Tarihi: Belirtilmedi";
  }

  const zodiac = getZodiacSign(userProfile.birthday);
  if (zodiacText) {
    zodiacText.innerText = zodiac ? `Burç: ${zodiac.icon} ${zodiac.name}` : "Burç: Belirtilmedi";
  }

  renderHobbiesListInProfile();
  renderLovePosts();
};

// --- CROPPER STATE FOR AVATAR & BANNER ---
let avatarCropState = {
  img: new Image(),
  target: "profile",
  scale: 1.0,
  x: 0,
  y: 0
};

let bannerCropState = {
  img: new Image(),
  scale: 1.0,
  x: 0,
  y: 0
};

let modalPickTargetType = "avatar"; // "avatar" or "banner"

window.triggerModalPhotoPick = function(type = "avatar") {
  modalPickTargetType = type;
  let fileInput = document.getElementById("cropperModalFileInput");
  if (!fileInput) {
    fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.id = "cropperModalFileInput";
    fileInput.accept = "image/*";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const base64 = await readFileAsBase64(file);
      if (modalPickTargetType === "banner") {
        bannerCropState.img = new Image();
        bannerCropState.img.onload = () => {
          bannerCropState.scale = 1.0;
          bannerCropState.x = 0;
          bannerCropState.y = 0;
          const range = document.getElementById("rangeBannerScale");
          if (range) range.value = 1.0;
          updateBannerCropper();
        };
        bannerCropState.img.src = base64;
      } else {
        avatarCropState.img = new Image();
        avatarCropState.img.onload = () => {
          avatarCropState.scale = 1.0;
          avatarCropState.x = 0;
          avatarCropState.y = 0;
          const range = document.getElementById("rangeAvatarScale");
          if (range) range.value = 1.0;
          updateAvatarCropper();
        };
        avatarCropState.img.src = base64;
      }
      fileInput.value = "";
    };
  }
  fileInput.click();
};

window.adjustAvatarZoom = function(delta) {
  const scaleInput = document.getElementById("rangeAvatarScale");
  if (!scaleInput) return;
  let val = parseFloat(scaleInput.value) + delta;
  val = Math.max(0.5, Math.min(3.5, val));
  scaleInput.value = val.toFixed(2);
  updateAvatarCropper();
};

window.adjustBannerZoom = function(delta) {
  const scaleInput = document.getElementById("rangeBannerScale");
  if (!scaleInput) return;
  let val = parseFloat(scaleInput.value) + delta;
  val = Math.max(0.5, Math.min(3.5, val));
  scaleInput.value = val.toFixed(2);
  updateBannerCropper();
};

// --- AVATAR CIRCULAR CROPPER FUNCTIONS ---
window.openCropAvatarModal = function(imageSrc, targetType = "profile") {
  avatarCropState.target = targetType;
  avatarCropState.scale = 1.0;
  avatarCropState.x = 0;
  avatarCropState.y = 0;

  const rangeScale = document.getElementById("rangeAvatarScale");
  if (rangeScale) rangeScale.value = 1.0;

  const titleEl = document.getElementById("cropAvatarTitle");
  if (titleEl) {
    if (targetType === "partner1") titleEl.innerText = "👤 1. Partner Fotoğrafını Ayarla";
    else if (targetType === "partner2") titleEl.innerText = "👤 2. Partner Fotoğrafını Ayarla";
    else titleEl.innerText = "👤 Profil Fotoğrafını Ayarla";
  }

  document.getElementById("cropAvatarModal")?.classList.add("active");

  if (imageSrc && imageSrc.length > 5) {
    avatarCropState.img = new Image();
    avatarCropState.img.onload = () => {
      updateAvatarCropper();
    };
    avatarCropState.img.src = imageSrc;
  } else {
    updateAvatarCropper();
  }
};

window.closeCropAvatarModal = function() {
  document.getElementById("cropAvatarModal")?.classList.remove("active");
};

window.updateAvatarCropper = function() {
  const scale = parseFloat(document.getElementById("rangeAvatarScale")?.value) || 1.0;
  const posX = avatarCropState.x || 0;
  const posY = avatarCropState.y || 0;

  avatarCropState.scale = scale;

  const lblS = document.getElementById("valAvatarScale");
  if (lblS) lblS.innerText = scale.toFixed(2) + "x";

  const canvas = document.getElementById("cropAvatarCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const cw = canvas.width;
  const ch = canvas.height;

  ctx.clearRect(0, 0, cw, ch);
  ctx.save();

  ctx.translate(cw / 2 + posX, ch / 2 + posY);
  ctx.scale(scale, scale);

  const img = avatarCropState.img;
  if (img && img.width && img.height) {
    const aspect = img.width / img.height;
    let dw = cw;
    let dh = ch;
    if (aspect > 1) dh = cw / aspect;
    else dw = ch * aspect;
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  } else {
    // Canvas empty placeholder text
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("📷 Fotoğraf Yükleyin", 0, 0);
  }

  ctx.restore();
};

window.saveCroppedAvatar = function() {
  const canvas = document.getElementById("cropAvatarCanvas");
  if (!canvas) return;

  let croppedDataUrl = "";
  if (avatarCropState.img && avatarCropState.img.src && avatarCropState.img.width > 0) {
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = 400;
    cropCanvas.height = 400;
    const ctx = cropCanvas.getContext("2d");

    // Circular Clip Mask
    ctx.beginPath();
    ctx.arc(200, 200, 200, 0, Math.PI * 2);
    ctx.clip();

    const scale = avatarCropState.scale * (400 / 300);
    const posX = avatarCropState.x * (400 / 300);
    const posY = avatarCropState.y * (400 / 300);

    ctx.translate(200 + posX, 200 + posY);
    ctx.scale(scale, scale);

    const img = avatarCropState.img;
    const aspect = img.width / img.height;
    let dw = 400;
    let dh = 400;
    if (aspect > 1) dh = 400 / aspect;
    else dw = 400 * aspect;
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    croppedDataUrl = cropCanvas.toDataURL("image/png");
  } else {
    croppedDataUrl = canvas.toDataURL("image/png");
  }

  if (avatarCropState.target === "partner1") {
    appState.avatar1 = croppedDataUrl;
    saveAppState();
    updateCounterDisplay();
    const imgEl = document.getElementById("avatar1Img");
    if (imgEl) imgEl.src = croppedDataUrl;
  } else if (avatarCropState.target === "partner2") {
    appState.avatar2 = croppedDataUrl;
    saveAppState();
    updateCounterDisplay();
    const imgEl = document.getElementById("avatar2Img");
    if (imgEl) imgEl.src = croppedDataUrl;
  } else {
    userProfile.avatar = croppedDataUrl;
    localStorage.setItem("love_user_profile", JSON.stringify(userProfile));

    if (!appState.avatar2 || appState.avatar2.length < 50 || appState.avatar2.includes('svg')) {
      appState.avatar2 = croppedDataUrl;
      saveAppState();
      updateCounterDisplay();
    }

    renderProfilePage();
    const imgEl = document.getElementById("userProfAvatarImg");
    if (imgEl) imgEl.src = croppedDataUrl;
  }

  closeCropAvatarModal();
  showInfoModal("Profil Fotoğrafı Güncellendi ✨", "Yeni profil fotoğrafınız dairesel çerçeveye oturtularak kaydedildi.");
};

// --- BANNER CROPPER FUNCTIONS ---
window.openCropBannerModal = function(imageSrc) {
  bannerCropState.scale = 1.0;
  bannerCropState.x = 0;
  bannerCropState.y = 0;

  const rangeScale = document.getElementById("rangeBannerScale");
  if (rangeScale) rangeScale.value = 1.0;

  document.getElementById("cropBannerModal")?.classList.add("active");

  if (imageSrc && imageSrc.length > 5) {
    bannerCropState.img = new Image();
    bannerCropState.img.onload = () => {
      updateBannerCropper();
    };
    bannerCropState.img.src = imageSrc;
  } else {
    updateBannerCropper();
  }
};

window.closeCropBannerModal = function() {
  document.getElementById("cropBannerModal")?.classList.remove("active");
};

window.updateBannerCropper = function() {
  const scale = parseFloat(document.getElementById("rangeBannerScale")?.value) || 1.0;
  const posX = bannerCropState.x || 0;
  const posY = bannerCropState.y || 0;

  bannerCropState.scale = scale;

  const lblS = document.getElementById("valBannerScale");
  if (lblS) lblS.innerText = scale.toFixed(2) + "x";

  const canvas = document.getElementById("cropBannerCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const cw = canvas.width;
  const ch = canvas.height;

  ctx.clearRect(0, 0, cw, ch);
  ctx.save();

  ctx.translate(cw / 2 + posX, ch / 2 + posY);
  ctx.scale(scale, scale);

  const img = bannerCropState.img;
  if (img && img.width && img.height) {
    const aspect = img.width / img.height;
    let dw = cw;
    let dh = ch;
    if (aspect > cw / ch) dh = cw / aspect;
    else dw = ch * aspect;
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🖼️ Kapak Resmi Yükleyin", 0, 0);
  }

  ctx.restore();
};

window.saveCroppedBanner = function() {
  const canvas = document.getElementById("cropBannerCanvas");
  if (!canvas) return;

  let croppedDataUrl = "";
  if (bannerCropState.img && bannerCropState.img.src && bannerCropState.img.width > 0) {
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = 1200;
    cropCanvas.height = 525;
    const ctx = cropCanvas.getContext("2d");

    const scale = bannerCropState.scale * (1200 / 800);
    const posX = bannerCropState.x * (1200 / 800);
    const posY = bannerCropState.y * (525 / 350);

    ctx.translate(600 + posX, 262.5 + posY);
    ctx.scale(scale, scale);

    const img = bannerCropState.img;
    const aspect = img.width / img.height;
    let dw = 1200;
    let dh = 525;
    if (aspect > 1200 / 525) dh = 1200 / aspect;
    else dw = 525 * aspect;
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    croppedDataUrl = cropCanvas.toDataURL("image/jpeg", 0.92);
  } else {
    croppedDataUrl = canvas.toDataURL("image/jpeg", 0.92);
  }

  userProfile.coverPhoto = croppedDataUrl;
  localStorage.setItem("love_user_profile", JSON.stringify(userProfile));

  closeCropBannerModal();
  renderProfilePage();
  const bannerEl = document.getElementById("userProfCoverBanner");
  if (bannerEl) bannerEl.style.backgroundImage = `url("${croppedDataUrl}")`;
  showInfoModal("Kapak Fotoğrafı Ayarlandı 🖼️", "Kapak görseliniz geniş ekran boyutuna uygun şekilde kaydedildi.");
};

function setupCropperDragListeners() {
  const setupCanvasDrag = (canvasId, getState, updateFn) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let initialX = 0, initialY = 0;

    const getPos = (e) => {
      if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      return { x: e.clientX, y: e.clientY };
    };

    const onStart = (e) => {
      const state = getState();
      isDragging = true;
      const pos = getPos(e);
      startX = pos.x;
      startY = pos.y;
      initialX = state.x || 0;
      initialY = state.y || 0;
      canvas.style.cursor = "grabbing";
      if (e.cancelable) e.preventDefault();
    };

    const onMove = (e) => {
      if (!isDragging) return;
      const state = getState();
      const pos = getPos(e);
      const dx = pos.x - startX;
      const dy = pos.y - startY;

      state.x = initialX + dx;
      state.y = initialY + dy;

      updateFn();
      if (e.cancelable) e.preventDefault();
    };

    const onEnd = () => {
      if (isDragging) {
        isDragging = false;
        canvas.style.cursor = "grab";
      }
    };

    canvas.addEventListener("mousedown", onStart);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);

    canvas.addEventListener("touchstart", onStart, { passive: false });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
  };

  setupCanvasDrag("cropAvatarCanvas", () => avatarCropState, updateAvatarCropper);
  setupCanvasDrag("cropBannerCanvas", () => bannerCropState, updateBannerCropper);
}

window.renderHobbiesListInProfile = function() {
  const container = document.getElementById("userProfHobbiesList");
  if (!container) return;

  const hobbies = Array.isArray(userProfile.hobbies) ? userProfile.hobbies : [];

  if (hobbies.length === 0) {
    container.innerHTML = `<span style="font-size:0.8rem; color:var(--text-sub);">🎨 Henüz hobi eklenmedi.</span>`;
    return;
  }

  let html = "";
  hobbies.forEach(h => {
    html += `
      <div style="background: var(--glass-bg); border: 1px solid var(--glass-border); padding: 5px 12px; border-radius: 20px; font-size: 0.8rem; color: var(--primary-pink); font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
        🎨 ${escapeHtml(h)}
      </div>
    `;
  });
  container.innerHTML = html;
};

window.renderHobbiesListInModal = function() {
  const container = document.getElementById("editHobbiesChipsList");
  if (!container) return;

  if (tempEditHobbies.length === 0) {
    container.innerHTML = `<span style="font-size:0.75rem; color:var(--text-sub);">Henüz hobi seçilmedi. Yukarıdan seçin veya yazın.</span>`;
    return;
  }

  let html = "";
  tempEditHobbies.forEach((h, idx) => {
    html += `
      <div style="background: linear-gradient(135deg, var(--primary-pink), var(--primary-red)); color: white; padding: 4px 10px; border-radius: 16px; font-size: 0.78rem; font-weight: bold; display: inline-flex; align-items: center; gap: 6px;">
        <span>${escapeHtml(h)}</span>
        <span onclick="removeHobbyChip(${idx})" style="cursor: pointer; opacity: 0.8; font-size: 1rem; line-height: 1;" title="Sil">&times;</span>
      </div>
    `;
  });
  container.innerHTML = html;
};

window.addHobbyFromSelect = function(e) {
  const val = e.target.value;
  if (val && !tempEditHobbies.includes(val)) {
    tempEditHobbies.push(val);
    renderHobbiesListInModal();
  }
  e.target.value = "";
};

window.addCustomHobbyFromInput = function() {
  const input = document.getElementById("inputCustomHobby");
  if (!input) return;
  const val = input.value.trim();
  if (val && !tempEditHobbies.includes(val)) {
    tempEditHobbies.push(val);
    renderHobbiesListInModal();
    input.value = "";
  }
};

window.removeHobbyChip = function(idx) {
  tempEditHobbies.splice(idx, 1);
  renderHobbiesListInModal();
};

function formatProfileDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

window.triggerProfileAvatarUpload = function() {
  const input = document.getElementById("userProfAvatarInput");
  if (input) input.click();
};

window.handleUserProfAvatarSelect = async function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const base64 = await readFileAsBase64(file);
  userProfile.avatar = base64;
  localStorage.setItem("love_user_profile", JSON.stringify(userProfile));
  renderProfilePage();
};

window.updateZodiacPreviewInForm = function() {
  const bdayInput = document.getElementById("editUserBday");
  const preview = document.getElementById("zodiacFormPreview");
  if (!bdayInput || !preview) return;

  const zodiac = getZodiacSign(bdayInput.value);
  if (zodiac) {
    preview.innerText = `✨ Otomatik Hesaplanan Burç: ${zodiac.icon} ${zodiac.name}`;
  } else {
    preview.innerText = "";
  }
};

window.openProfileEditModal = function() {
  const modal = document.getElementById("profileEditModal");
  const nameInput = document.getElementById("editUserName");
  const bdayInput = document.getElementById("editUserBday");
  const bioInput = document.getElementById("editUserBio");

  if (nameInput) nameInput.value = userProfile.name || appState.partner2Name || "";
  if (bdayInput) bdayInput.value = userProfile.birthday || "";
  if (bioInput) bioInput.value = userProfile.bioText || "";

  tempEditHobbies = Array.isArray(userProfile.hobbies) ? [...userProfile.hobbies] : [];
  renderHobbiesListInModal();
  updateZodiacPreviewInForm();

  if (modal) modal.classList.add("active");
};

window.closeProfileEditModal = function() {
  const modal = document.getElementById("profileEditModal");
  if (modal) modal.classList.remove("active");
};

window.handleProfileEditSubmit = function(e) {
  e.preventDefault();
  const nameInput = document.getElementById("editUserName");
  const bdayInput = document.getElementById("editUserBday");
  const bioInput = document.getElementById("editUserBio");

  userProfile.name = nameInput ? nameInput.value.trim() : "Kullanıcı";
  userProfile.birthday = bdayInput ? bdayInput.value : "";
  userProfile.bioText = bioInput ? bioInput.value.trim() : "";
  userProfile.hobbies = [...tempEditHobbies];

  localStorage.setItem("love_user_profile", JSON.stringify(userProfile));
  closeProfileEditModal();
  renderProfilePage();
};

window.previewPostPhoto = async function(e) {
  const file = e.target.files[0];
  const label = document.getElementById("postPhotoPreviewName");
  if (file) {
    tempPostPhotoBase64 = await readFileAsBase64(file);
    if (label) label.innerText = `📷 ${file.name}`;
  } else {
    tempPostPhotoBase64 = "";
    if (label) label.innerText = "";
  }
};

let currentPostsSearchQuery = "";

window.handlePostsSearchInput = function() {
  const input = document.getElementById("searchPostsInput");
  const btnClear = document.getElementById("btnClearPostsSearch");
  currentPostsSearchQuery = input ? input.value.toLowerCase().trim() : "";
  if (btnClear) btnClear.style.display = currentPostsSearchQuery ? "block" : "none";
  renderLovePosts();
};

window.clearPostsSearch = function() {
  const input = document.getElementById("searchPostsInput");
  const btnClear = document.getElementById("btnClearPostsSearch");
  if (input) input.value = "";
  if (btnClear) btnClear.style.display = "none";
  currentPostsSearchQuery = "";
  renderLovePosts();
};

window.handleLovePostSubmit = function(e) {
  e.preventDefault();
  const titleInput = document.getElementById("inputPostTitle");
  const textInput = document.getElementById("inputPostText");
  const catInput = document.getElementById("inputPostCategory");

  const title = titleInput ? titleInput.value.trim() : "";
  const text = textInput ? textInput.value.trim() : "";
  const category = catInput ? catInput.value : "not";
  if (!text && !title) return;

  const newPost = {
    id: "post_" + Date.now(),
    title: title,
    text: text,
    category: category,
    photo: tempPostPhotoBase64,
    date: new Date().toISOString(),
    likes: 1
  };

  lovePosts.unshift(newPost);
  localStorage.setItem("love_posts", JSON.stringify(lovePosts));

  if (titleInput) titleInput.value = "";
  if (textInput) textInput.value = "";
  tempPostPhotoBase64 = "";
  const label = document.getElementById("postPhotoPreviewName");
  if (label) label.innerText = "";

  renderLovePosts();
};

window.setPostFeedFilter = function(category) {
  activePostCategoryFilter = category;

  document.querySelectorAll(".post-filter-chip").forEach(btn => btn.classList.remove("active"));
  const activeBtn = document.getElementById(`pfilter_${category}`);
  if (activeBtn) activeBtn.classList.add("active");

  renderLovePosts();
};

window.likeLovePost = function(postId) {
  const post = lovePosts.find(p => p.id === postId);
  if (post) {
    post.likes = (post.likes || 0) + 1;
    localStorage.setItem("love_posts", JSON.stringify(lovePosts));
    renderLovePosts();
  }
};

window.showCustomConfirmModal = function(title, message, onConfirmCallback) {
  const modal = document.getElementById("customConfirmModal");
  const titleEl = document.getElementById("confirmModalTitle");
  const msgEl = document.getElementById("confirmModalMessage");
  const btnAction = document.getElementById("btnConfirmModalAction");
  const btnCancel = document.getElementById("btnConfirmModalCancel");

  if (!modal) {
    if (confirm(message)) {
      if (typeof onConfirmCallback === "function") onConfirmCallback();
    }
    return;
  }

  if (titleEl) titleEl.innerText = title || "Silme Onayı";
  if (msgEl) msgEl.innerText = message || "Bu ögeyi silmek istediğinizden emin misiniz?";

  const handleConfirm = () => {
    cleanup();
    modal.classList.remove("active");
    if (typeof onConfirmCallback === "function") onConfirmCallback();
  };

  const handleCancel = () => {
    cleanup();
    modal.classList.remove("active");
  };

  const cleanup = () => {
    if (btnAction) btnAction.removeEventListener("click", handleConfirm);
    if (btnCancel) btnCancel.removeEventListener("click", handleCancel);
  };

  if (btnAction) btnAction.addEventListener("click", handleConfirm);
  if (btnCancel) btnCancel.addEventListener("click", handleCancel);

  modal.classList.add("active");
};

window.deleteLovePost = function(postId) {
  showCustomConfirmModal("Gönderiyi Sil 🗑️", "Bu gönderiyi silmek istediğinizden emin misiniz?", () => {
    lovePosts = lovePosts.filter(p => p.id !== postId);
    localStorage.setItem("love_posts", JSON.stringify(lovePosts));
    renderLovePosts();
  });
};

const categoryBadgeMap = {
  "siir": { text: "📜 Şiir", color: "#ff7597" },
  "not": { text: "📝 Özel Not", color: "#05d9e8" },
  "tarif": { text: "🍳 Yemek Tarifi", color: "#ffb703" },
  "dusunce": { text: "💭 Düşünce", color: "#b388ff" },
  "hobi": { text: "🎨 Hobi", color: "#ff5252" }
};

window.renderLovePosts = function() {
  const container = document.getElementById("lovePostsFeedContainer");
  if (!container) return;

  let filtered = lovePosts;
  if (activePostCategoryFilter !== "all") {
    filtered = filtered.filter(p => p.category === activePostCategoryFilter);
  }

  if (currentPostsSearchQuery) {
    filtered = filtered.filter(p => {
      const matchTitle = (p.title || "").toLowerCase().includes(currentPostsSearchQuery);
      const matchText = (p.text || "").toLowerCase().includes(currentPostsSearchQuery);
      return matchTitle || matchText;
    });
  }

  if (filtered.length === 0) {
    if (currentPostsSearchQuery) {
      container.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: var(--text-sub); background: rgba(255,255,255,0.03); border-radius: 20px; border: 1px dashed rgba(255,255,255,0.15);">
          <div style="font-size: 2.2rem; margin-bottom: 6px;">🔍</div>
          <p style="margin: 0; font-weight: bold; color: #ffffff;">"${escapeHtml(currentPostsSearchQuery)}" aramanıza uygun gönderi bulunamadı.</p>
          <p style="font-size: 0.8rem; opacity: 0.8; margin-top: 4px;">Farklı bir kelime yazmayı veya aramayı temizlemeyi deneyebilirsiniz.</p>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: var(--text-sub); background: rgba(255,255,255,0.03); border-radius: 20px; border: 1px dashed rgba(255,255,255,0.15);">
          <div style="font-size: 2.2rem; margin-bottom: 6px;">✍️</div>
          <p style="margin: 0; font-weight: bold; color: #ffffff;">Bu kategoride henüz bir gönderi yok.</p>
          <p style="font-size: 0.8rem; opacity: 0.8; margin-top: 4px;">Yukarıdaki kutudan ilk gönderinizi, başlığınızı veya tarifinizi yazabilirsiniz! ✨</p>
        </div>
      `;
    }
    return;
  }

  let html = "";
  const userName = userProfile.name || "Kullanıcı";
  const userAvatar = userProfile.avatar || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%23ff4b72'/><text x='50%' y='55%' font-size='40' fill='white' text-anchor='middle' dominant-baseline='middle'>👤</text></svg>";

  filtered.forEach(post => {
    const d = new Date(post.date);
    const dateFormatted = d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const photoHtml = post.photo ? `<img src="${post.photo}" alt="Gönderi Görseli" style="width:100%; border-radius:14px; margin-top:10px; max-height:300px; object-fit:cover;">` : "";
    const catBadge = categoryBadgeMap[post.category] || categoryBadgeMap["not"];

    const titleHtml = post.title ? `<h4 style="margin: 0 0 6px 0; font-size: 1.05rem; font-weight: 700; color: #ffffff; letter-spacing: 0.3px;">${escapeHtml(post.title)}</h4>` : "";

    html += `
      <div class="glass-card" style="padding: 16px; position: relative;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 38px; height: 38px; border-radius: 50%; overflow: hidden; border: 2px solid var(--primary-pink); flex-shrink: 0;">
              <img src="${userAvatar}" alt="${escapeHtml(userName)}" style="width:100%; height:100%; object-fit:cover;">
            </div>
            <div>
              <strong style="font-size: 0.92rem; color: #ffffff;">${escapeHtml(userName)}</strong>
              <span style="display: block; font-size: 0.72rem; color: var(--text-sub);">${dateFormatted}</span>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 0.75rem; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: ${catBadge.color}; padding: 3px 10px; border-radius: 12px; font-weight: bold;">
              ${catBadge.text}
            </span>
            <button type="button" onclick="deleteLovePost('${post.id}')" style="background: none; border: none; color: var(--text-sub); font-size: 1.1rem; cursor: pointer; padding: 4px;" title="Sil">&times;</button>
          </div>
        </div>

        ${titleHtml}
        <p style="margin: 0; font-size: 0.9rem; color: var(--text-muted); line-height: 1.5; white-space: pre-line;">${escapeHtml(post.text)}</p>
        ${photoHtml}

        <div style="margin-top: 12px; display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
          <button type="button" onclick="likeLovePost('${post.id}')" class="btn-secondary" style="padding: 4px 12px; font-size: 0.8rem; border-radius: 15px; display: inline-flex; align-items: center; gap: 4px;">
            ❤️ ${post.likes || 1} Beğeni
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
};

// ==========================================================================
// 📜 DYNAMIC PROFILE HEADER SCROLL ANIMATION EVENT
// ==========================================================================
window.addEventListener("scroll", () => {
  const profileView = document.getElementById("mainProfileView");
  if (!profileView || profileView.style.display === "none") return;

  const card = document.getElementById("profileMainCard");
  if (!card) return;


  const scrollY = window.scrollY || document.documentElement.scrollTop;
  if (scrollY > 35) {
    card.classList.add("scrolled-header");
  } else {
    card.classList.remove("scrolled-header");
  }
});

// ==========================================================================
// 🥗 DİYET TAKİP MODÜLÜ — Kalori & Öğün & Su & Kilo Takibi
// ==========================================================================

// ---- Besin Veritabanı (kcal/100g, protein/g, karb/g, yağ/g) ----
// ---- Besin Veritabanı (kcal/100g, protein/g, karb/g, yağ/g, pieceGrams, unitName) ----
const FOOD_DB = [
  // 🧀 TÜRK KAHVALTILIKLARI & BÖREKLER
  { name: "Süzme Peynir",          cal: 230, p: 14, c: 3,  f: 18, pieceGrams: 30, unitName: "Dilim" },
  { name: "Ezine Peyniri",          cal: 310, p: 17, c: 2,  f: 26, pieceGrams: 30, unitName: "Dilim" },
  { name: "Beyaz Peynir",          cal: 264, p: 18, c: 2,  f: 21, pieceGrams: 30, unitName: "Dilim" },
  { name: "Kaşar Peyniri",         cal: 366, p: 26, c: 1,  f: 29, pieceGrams: 20, unitName: "Dilim" },
  { name: "Lor Peyniri",           cal: 90,  p: 12, c: 3,  f: 3,  pieceGrams: 50, unitName: "Yemek Kaşığı" },
  { name: "Tulum Peyniri",         cal: 330, p: 22, c: 2,  f: 26, pieceGrams: 30, unitName: "Porsiyon" },
  { name: "Çeçil / Örgü Peyniri",  cal: 320, p: 23, c: 2,  f: 24, pieceGrams: 30, unitName: "Porsiyon" },
  { name: "Hellim Peyniri (ızgara)",cal: 310, p: 21, c: 2,  f: 25, pieceGrams: 30, unitName: "Dilim" },
  { name: "Labne Peyniri",         cal: 160, p: 6,  c: 4,  f: 14, pieceGrams: 25, unitName: "Yemek Kaşığı" },
  { name: "Siyah Zeytin",          cal: 115, p: 1,  c: 6,  f: 11, pieceGrams: 5,  unitName: "Adet" },
  { name: "Yeşil Zeytin",          cal: 145, p: 1,  c: 4,  f: 15, pieceGrams: 5,  unitName: "Adet" },
  { name: "Yumurta (haşlanmış)",   cal: 155, p: 13, c: 1,  f: 11, pieceGrams: 50, unitName: "Adet" },
  { name: "Yumurta (omlet/sahanda)",cal: 184, p: 12, c: 1,  f: 14, pieceGrams: 60, unitName: "Adet" },
  { name: "Menemen",               cal: 124, p: 7,  c: 6,  f: 9,  pieceGrams: 150,unitName: "Porsiyon" },
  { name: "Sucuklu Yumurta",       cal: 240, p: 14, c: 2,  f: 20, pieceGrams: 120,unitName: "Porsiyon" },
  { name: "Kavurmalı Yumurta",     cal: 280, p: 18, c: 1,  f: 22, pieceGrams: 130,unitName: "Porsiyon" },
  { name: "Pastırmalı Yumurta",    cal: 230, p: 16, c: 1,  f: 17, pieceGrams: 120,unitName: "Porsiyon" },
  { name: "Çılbır (yoğurtlu yumurta)",cal: 170, p: 11, c: 4,  f: 12, pieceGrams: 150,unitName: "Porsiyon" },
  { name: "Mıhlama / Kuymak",      cal: 380, p: 11, c: 12, f: 32, pieceGrams: 150,unitName: "Porsiyon" },
  { name: "Simit",                 cal: 296, p: 9,  c: 56, f: 4,  pieceGrams: 100,unitName: "Adet" },
  { name: "Açma (sade)",           cal: 340, p: 7,  c: 48, f: 14, pieceGrams: 90, unitName: "Adet" },
  { name: "Poğaça (peynirli)",     cal: 360, p: 9,  c: 42, f: 18, pieceGrams: 80, unitName: "Adet" },
  { name: "Poğaça (zeytinli/kıymalı)",cal: 380, p: 8, c: 40, f: 20, pieceGrams: 85, unitName: "Adet" },
  { name: "Boyoz",                 cal: 380, p: 7,  c: 45, f: 20, pieceGrams: 90, unitName: "Adet" },
  { name: "Gözleme (peynirli)",    cal: 260, p: 10, c: 38, f: 8,  pieceGrams: 150,unitName: "Adet" },
  { name: "Gözleme (kıymalı/patatesli)",cal: 285, p: 9, c: 40, f: 10, pieceGrams: 160,unitName: "Adet" },
  { name: "Su Böreği",             cal: 320, p: 11, c: 35, f: 15, pieceGrams: 120,unitName: "Dilim" },
  { name: "Sigara Böreği",         cal: 310, p: 9,  c: 32, f: 16, pieceGrams: 30, unitName: "Adet" },
  { name: "Paçanga Böreği",        cal: 340, p: 12, c: 30, f: 19, pieceGrams: 80, unitName: "Adet" },
  { name: "Acuka / Muhammara",     cal: 240, p: 4,  c: 12, f: 20, pieceGrams: 20, unitName: "Tatlı Kaşığı" },
  { name: "Bal",                   cal: 304, p: 0,  c: 82, f: 0,  pieceGrams: 20, unitName: "Yemek Kaşığı" },
  { name: "Kaymak",                cal: 580, p: 2,  c: 3,  f: 62, pieceGrams: 20, unitName: "Yemek Kaşığı" },
  { name: "Tahin Pekmez",          cal: 420, p: 8,  c: 55, f: 18, pieceGrams: 30, unitName: "Yemek Kaşığı" },
  { name: "Fıstık Ezmesi",         cal: 588, p: 25, c: 20, f: 50, pieceGrams: 20, unitName: "Yemek Kaşığı" },
  { name: "Fındık Kakaolu Krem",   cal: 540, p: 6,  c: 57, f: 31, pieceGrams: 20, unitName: "Yemek Kaşığı" },
  { name: "Tereyağı",              cal: 717, p: 1,  c: 0,  f: 81, pieceGrams: 10, unitName: "Tatlı Kaşığı" },

  // 🥘 TÜRK EV YEMEKLERİ & ÇORBALAR
  { name: "Kuru Fasulye",          cal: 140, p: 8,  c: 22, f: 3,  pieceGrams: 200,unitName: "Porsiyon" },
  { name: "Nohut Yemeği",          cal: 160, p: 8,  c: 25, f: 4,  pieceGrams: 200,unitName: "Porsiyon" },
  { name: "Barbunya Pilaki",       cal: 155, p: 7,  c: 24, f: 5,  pieceGrams: 200,unitName: "Porsiyon" },
  { name: "Karnıyarık",            cal: 135, p: 6,  c: 9,  f: 9,  pieceGrams: 180,unitName: "Adet" },
  { name: "İmam Bayıldı",          cal: 98,  p: 2,  c: 10, f: 6,  pieceGrams: 180,unitName: "Adet" },
  { name: "Hünkar Beğendi",        cal: 220, p: 14, c: 8,  f: 15, pieceGrams: 200,unitName: "Porsiyon" },
  { name: "Mantı (yoğurtlu)",      cal: 250, p: 12, c: 35, f: 7,  pieceGrams: 200,unitName: "Porsiyon" },
  { name: "Yaprak Sarma (zeytinyağlı)",cal: 180,p: 3, c: 26, f: 8, pieceGrams: 25, unitName: "Adet" },
  { name: "Biber Dolması (etli)",  cal: 145, p: 7,  c: 16, f: 6,  pieceGrams: 150,unitName: "Adet" },
  { name: "Kabak / Patlıcan Dolma",cal: 130, p: 6,  c: 15, f: 5,  pieceGrams: 160,unitName: "Adet" },
  { name: "İçli Köfte",            cal: 280, p: 12, c: 28, f: 14, pieceGrams: 90, unitName: "Adet" },
  { name: "Mücver (kabak)",        cal: 150, p: 5,  c: 14, f: 8,  pieceGrams: 80, unitName: "Adet" },
  { name: "Zeytinyağlı Enginar",   cal: 110, p: 3,  c: 15, f: 5,  pieceGrams: 150,unitName: "Adet" },
  { name: "Taze Fasulye (zeytinyağlı)",cal: 75,p: 2,  c: 9,  f: 4,  pieceGrams: 180,unitName: "Porsiyon" },
  { name: "Mercimek Çorbası",      cal: 81,  p: 5,  c: 13, f: 2,  pieceGrams: 250,unitName: "Kase" },
  { name: "Ezogelin Çorbası",      cal: 88,  p: 4,  c: 14, f: 2,  pieceGrams: 250,unitName: "Kase" },
  { name: "Yayla Çorbası",         cal: 72,  p: 3,  c: 10, f: 2,  pieceGrams: 250,unitName: "Kase" },
  { name: "Tarhana Çorbası",       cal: 85,  p: 3,  c: 15, f: 2,  pieceGrams: 250,unitName: "Kase" },
  { name: "Kelle Paça Çorbası",    cal: 160, p: 14, c: 2,  f: 11, pieceGrams: 250,unitName: "Kase" },
  { name: "İşkembe Çorbası",       cal: 145, p: 12, c: 3,  f: 9,  pieceGrams: 250,unitName: "Kase" },
  { name: "Domates Çorbası",       cal: 65,  p: 2,  c: 9,  f: 2,  pieceGrams: 250,unitName: "Kase" },

  // 🥙 KEBAPLAR, DÖNERLER & PİDELER
  { name: "İskender Kebap",        cal: 270, p: 18, c: 15, f: 16, pieceGrams: 300,unitName: "Porsiyon" },
  { name: "Adana Kebap",           cal: 260, p: 19, c: 3,  f: 19, pieceGrams: 150,unitName: "Şiş" },
  { name: "Urfa Kebap",            cal: 250, p: 19, c: 3,  f: 18, pieceGrams: 150,unitName: "Şiş" },
  { name: "Beyti Kebap",           cal: 290, p: 16, c: 18, f: 18, pieceGrams: 300,unitName: "Porsiyon" },
  { name: "Ali Nazik Kebap",       cal: 210, p: 15, c: 6,  f: 14, pieceGrams: 250,unitName: "Porsiyon" },
  { name: "Lahmacun",              cal: 222, p: 12, c: 28, f: 7,  pieceGrams: 120,unitName: "Adet" },
  { name: "Kıymalı Pide",          cal: 268, p: 12, c: 32, f: 10, pieceGrams: 200,unitName: "Porsiyon" },
  { name: "Kuşbaşılı Pide",        cal: 280, p: 14, c: 30, f: 12, pieceGrams: 200,unitName: "Porsiyon" },
  { name: "Kaşarlı Pide",          cal: 310, p: 13, c: 34, f: 14, pieceGrams: 180,unitName: "Porsiyon" },
  { name: "Tavuk Döner Dürüm",     cal: 197, p: 22, c: 10, f: 7,  pieceGrams: 200,unitName: "Adet" },
  { name: "Et Döner Dürüm",        cal: 254, p: 19, c: 10, f: 16, pieceGrams: 200,unitName: "Adet" },
  { name: "Tavuk Şiş",             cal: 175, p: 25, c: 2,  f: 7,  pieceGrams: 150,unitName: "Porsiyon" },
  { name: "Kuzu Şiş",              cal: 240, p: 22, c: 1,  f: 16, pieceGrams: 150,unitName: "Porsiyon" },
  { name: "Sac Kavurma",           cal: 260, p: 24, c: 2,  f: 17, pieceGrams: 200,unitName: "Porsiyon" },

  // 🍚 PİLAVLAR, MAKARNALAR & TAHILLAR
  { name: "Beyaz Ekmek",           cal: 265, p: 9,  c: 49, f: 3,  pieceGrams: 30, unitName: "Dilim" },
  { name: "Tam Buğday Ekmek",      cal: 247, p: 13, c: 41, f: 4,  pieceGrams: 30, unitName: "Dilim" },
  { name: "Çavdar Ekmeği",         cal: 250, p: 10, c: 45, f: 3,  pieceGrams: 30, unitName: "Dilim" },
  { name: "Pirinç Pilavı",          cal: 130, p: 3,  c: 28, f: 1,  pieceGrams: 150,unitName: "Porsiyon" },
  { name: "Bulgur Pilavı",          cal: 151, p: 6,  c: 29, f: 1,  pieceGrams: 150,unitName: "Porsiyon" },
  { name: "Makarna (sade)",        cal: 131, p: 5,  c: 25, f: 1,  pieceGrams: 150,unitName: "Porsiyon" },
  { name: "Kıymalı Makarna",       cal: 185, p: 9,  c: 24, f: 6,  pieceGrams: 200,unitName: "Porsiyon" },
  { name: "Erişte (cevizli/peynirli)",cal: 210,p: 7,  c: 28, f: 8,  pieceGrams: 180,unitName: "Porsiyon" },
  { name: "Yulaf Ezmesi",           cal: 389, p: 17, c: 66, f: 7,  pieceGrams: 40, unitName: "Porsiyon" },
  { name: "Kinoa (haşlanmış)",     cal: 120, p: 4,  c: 21, f: 2,  pieceGrams: 120,unitName: "Porsiyon" },

  // 🥩 ET, TAVUK & DENİZ ÜRÜNLERİ
  { name: "Tavuk Göğsü (ızgara)",  cal: 165, p: 31, c: 0,  f: 4,  pieceGrams: 150,unitName: "Porsiyon" },
  { name: "Tavuk Pirzola / But",   cal: 184, p: 28, c: 0,  f: 8,  pieceGrams: 150,unitName: "Adet" },
  { name: "Tavuk Sote",            cal: 150, p: 22, c: 4,  f: 5,  pieceGrams: 180,unitName: "Porsiyon" },
  { name: "Köfte (ızgara)",         cal: 230, p: 20, c: 4,  f: 15, pieceGrams: 35, unitName: "Adet" },
  { name: "Izgara Bonfile / Antrikot",cal: 220,p: 26, c: 0,  f: 12, pieceGrams: 180,unitName: "Porsiyon" },
  { name: "Somon Izgara",           cal: 208, p: 20, c: 0,  f: 13, pieceGrams: 180,unitName: "Porsiyon" },
  { name: "Levrek Izgara",          cal: 124, p: 24, c: 0,  f: 3,  pieceGrams: 200,unitName: "Porsiyon" },
  { name: "Çupra Izgara",           cal: 130, p: 23, c: 0,  f: 4,  pieceGrams: 200,unitName: "Porsiyon" },
  { name: "Hamsi Tava",            cal: 210, p: 18, c: 8,  f: 12, pieceGrams: 150,unitName: "Porsiyon" },
  { name: "Ton Balığı (konserve)",  cal: 116, p: 26, c: 0,  f: 1,  pieceGrams: 80, unitName: "Kutu" },
  { name: "Kalamar Tava",          cal: 230, p: 14, c: 15, f: 13, pieceGrams: 120,unitName: "Porsiyon" },
  { name: "Midye Dolma",           cal: 175, p: 7,  c: 24, f: 5,  pieceGrams: 30, unitName: "Adet" },

  // 🥗 SALATALAR & MEZELER
  { name: "Çoban Salata",          cal: 45,  p: 1,  c: 5,  f: 2,  pieceGrams: 150,unitName: "Porsiyon" },
  { name: "Sezar Salata (tavuklu)",cal: 160, p: 15, c: 6,  f: 9,  pieceGrams: 200,unitName: "Porsiyon" },
  { name: "Ton Balıklı Salata",    cal: 130, p: 16, c: 4,  f: 5,  pieceGrams: 200,unitName: "Porsiyon" },
  { name: "Kısır",                 cal: 170, p: 4,  c: 26, f: 6,  pieceGrams: 120,unitName: "Porsiyon" },
  { name: "Mercimek Köftesi",      cal: 150, p: 5,  c: 24, f: 4,  pieceGrams: 35, unitName: "Adet" },
  { name: "Falafel",               cal: 290, p: 13, c: 30, f: 14, pieceGrams: 30, unitName: "Adet" },
  { name: "Humus",                  cal: 166, p: 8,  c: 14, f: 9,  pieceGrams: 50, unitName: "Kaşık" },
  { name: "Haydari",                cal: 140, p: 5,  c: 4,  f: 12, pieceGrams: 50, unitName: "Kaşık" },
  { name: "Şakşuka",                cal: 110, p: 2,  c: 10, f: 7,  pieceGrams: 100,unitName: "Porsiyon" },

  // 🍔 FAST FOOD & TOSTLAR
  { name: "Hamburger",              cal: 250, p: 13, c: 24, f: 12, pieceGrams: 150,unitName: "Adet" },
  { name: "Cheeseburger",           cal: 300, p: 16, c: 26, f: 15, pieceGrams: 170,unitName: "Adet" },
  { name: "Kaşarlı Tost",          cal: 290, p: 12, c: 30, f: 14, pieceGrams: 100,unitName: "Adet" },
  { name: "Sucuklu Tost",          cal: 330, p: 13, c: 28, f: 19, pieceGrams: 110,unitName: "Adet" },
  { name: "Ayvalık Tostu",          cal: 450, p: 18, c: 44, f: 22, pieceGrams: 200,unitName: "Adet" },
  { name: "Kumru Sandviç",         cal: 480, p: 20, c: 42, f: 25, pieceGrams: 220,unitName: "Adet" },
  { name: "Tantuni (dürüm)",       cal: 220, p: 16, c: 20, f: 9,  pieceGrams: 160,unitName: "Adet" },
  { name: "Kokoreç (çeyrek ekmek)",cal: 320, p: 14, c: 26, f: 18, pieceGrams: 120,unitName: "Adet" },
  { name: "Patates Kızartması",    cal: 312, p: 3,  c: 41, f: 15, pieceGrams: 100,unitName: "Porsiyon" },
  { name: "Pizza (Margherita)",    cal: 230, p: 9,  c: 28, f: 9,  pieceGrams: 100,unitName: "Dilim" },
  { name: "Pizza (Pepperoni/Karışık)",cal: 270,p: 11, c: 26, f: 13, pieceGrams: 100,unitName: "Dilim" },

  // 🍎 MEYVELER, SEBZELER & KURUYEMİŞLER
  { name: "Elma",                   cal: 52,  p: 0,  c: 14, f: 0,  pieceGrams: 120,unitName: "Adet" },
  { name: "Muz",                    cal: 89,  p: 1,  c: 23, f: 0,  pieceGrams: 100,unitName: "Adet" },
  { name: "Portakal",               cal: 47,  p: 1,  c: 12, f: 0,  pieceGrams: 130,unitName: "Adet" },
  { name: "Mandalina",              cal: 53,  p: 1,  c: 13, f: 0,  pieceGrams: 80, unitName: "Adet" },
  { name: "Çilek",                  cal: 32,  p: 1,  c: 8,  f: 0,  pieceGrams: 15, unitName: "Adet" },
  { name: "Karpuz",                 cal: 30,  p: 1,  c: 8,  f: 0,  pieceGrams: 200,unitName: "Dilim" },
  { name: "Kavun",                  cal: 34,  p: 1,  c: 8,  f: 0,  pieceGrams: 200,unitName: "Dilim" },
  { name: "Şeftali / Kayısı",      cal: 39,  p: 1,  c: 10, f: 0,  pieceGrams: 90, unitName: "Adet" },
  { name: "Üzüm",                   cal: 69,  p: 1,  c: 18, f: 0,  pieceGrams: 100,unitName: "Salkım" },
  { name: "İncir (taze)",           cal: 74,  p: 1,  c: 19, f: 0,  pieceGrams: 50, unitName: "Adet" },
  { name: "Hurma",                  cal: 277, p: 2,  c: 75, f: 0,  pieceGrams: 10, unitName: "Adet" },
  { name: "Avokado",                cal: 160, p: 2,  c: 9,  f: 15, pieceGrams: 150,unitName: "Adet" },
  { name: "Ceviz İçi",              cal: 654, p: 15, c: 14, f: 65, pieceGrams: 10, unitName: "Adet (2 tam)" },
  { name: "Fındık",                 cal: 628, p: 15, c: 17, f: 61, pieceGrams: 15, unitName: "Avuç (~10 adet)" },
  { name: "Badem",                  cal: 579, p: 21, c: 22, f: 50, pieceGrams: 15, unitName: "Avuç (~10 adet)" },
  { name: "Antep Fıstığı",          cal: 562, p: 20, c: 28, f: 45, pieceGrams: 15, unitName: "Avuç" },
  { name: "Kaju",                   cal: 553, p: 18, c: 30, f: 44, pieceGrams: 15, unitName: "Avuç" },

  // 🍰 TÜRK TATLILARI & PASTALAR
  { name: "Baklava (fıstıklı)",     cal: 428, p: 6,  c: 48, f: 24, pieceGrams: 40, unitName: "Dilim" },
  { name: "Şöbiyet",                cal: 410, p: 5,  c: 46, f: 23, pieceGrams: 50, unitName: "Dilim" },
  { name: "Sütlaç (fırın)",         cal: 132, p: 4,  c: 25, f: 2,  pieceGrams: 150,unitName: "Kase" },
  { name: "Künefe",                 cal: 380, p: 10, c: 45, f: 18, pieceGrams: 150,unitName: "Porsiyon" },
  { name: "Güllaç",                 cal: 160, p: 4,  c: 28, f: 4,  pieceGrams: 120,unitName: "Dilim" },
  { name: "Kazandibi / Tavukgöğsü",cal: 145, p: 4,  c: 26, f: 3,  pieceGrams: 130,unitName: "Porsiyon" },
  { name: "Profiterol",             cal: 280, p: 5,  c: 32, f: 15, pieceGrams: 120,unitName: "Porsiyon" },
  { name: "San Sebastian Cheesecake",cal: 340,p: 7,  c: 28, f: 22, pieceGrams: 120,unitName: "Dilim" },
  { name: "Çikolatalı Sufle",       cal: 370, p: 6,  c: 40, f: 20, pieceGrams: 100,unitName: "Adet" },
  { name: "İrmik Helvası",          cal: 310, p: 4,  c: 50, f: 10, pieceGrams: 100,unitName: "Porsiyon" },

  // 🌍 DÜNYA MUTFAĞI
  { name: "🇯🇵 Sushi (nigiri, 1 parça)",cal: 40,  p: 2,  c: 8,  f: 0,  pieceGrams: 30, unitName: "Adet" },
  { name: "🇯🇵 Maki Roll (8 parça)",    cal: 290, p: 9,  c: 48, f: 7,  pieceGrams: 200,unitName: "Porsiyon" },
  { name: "🇯🇵 California Roll (8p)",  cal: 320, p: 8,  c: 42, f: 12, pieceGrams: 220,unitName: "Porsiyon" },
  { name: "🇯🇵 Ramen",                  cal: 436, p: 20, c: 54, f: 14, pieceGrams: 350,unitName: "Kase" },
  { name: "🇮🇹 Risotto",                cal: 180, p: 5,  c: 32, f: 4,  pieceGrams: 200,unitName: "Porsiyon" },
  { name: "🇮🇹 Tiramisu",               cal: 320, p: 7,  c: 30, f: 20, pieceGrams: 100,unitName: "Dilim" },
  { name: "🇲🇽 Burrito (et/tavuk)",     cal: 380, p: 18, c: 48, f: 12, pieceGrams: 250,unitName: "Adet" },
  { name: "🇲🇽 Taco (et)",              cal: 210, p: 12, c: 22, f: 9,  pieceGrams: 100,unitName: "Adet" },
  { name: "🇺🇸 Cheesecake",             cal: 400, p: 7,  c: 35, f: 26, pieceGrams: 120,unitName: "Dilim" },
  { name: "🇺🇸 Pancake",                cal: 170, p: 5,  c: 26, f: 5,  pieceGrams: 60, unitName: "Adet" },
  { name: "🇨🇳 Fried Rice",             cal: 200, p: 7,  c: 32, f: 6,  pieceGrams: 200,unitName: "Porsiyon" },
  { name: "🇮🇳 Chicken Tikka Masala",   cal: 160, p: 18, c: 8,  f: 6,  pieceGrams: 200,unitName: "Porsiyon" },
  { name: "🇫🇷 Kruvasan (Croissant)",   cal: 406, p: 8,  c: 46, f: 21, pieceGrams: 60, unitName: "Adet" },
  { name: "🇹🇭 Pad Thai",              cal: 350, p: 14, c: 44, f: 13, pieceGrams: 250,unitName: "Porsiyon" },

  // ☕ İÇECEKLER
  { name: "Türk Kahvesi (sade)",    cal: 5,   p: 0,  c: 1,  f: 0,  pieceGrams: 60, unitName: "Fincan" },
  { name: "Türk Kahvesi (orta/şekerli)",cal: 35,p: 0, c: 8,  f: 0,  pieceGrams: 60, unitName: "Fincan" },
  { name: "Latte / Cappuccino",     cal: 120, p: 6,  c: 9,  f: 6,  pieceGrams: 240,unitName: "Bardak" },
  { name: "Espresso / Americano",   cal: 5,   p: 0,  c: 1,  f: 0,  pieceGrams: 150,unitName: "Bardak" },
  { name: "Ayran",                  cal: 38,  p: 2,  c: 3,  f: 2,  pieceGrams: 200,unitName: "Bardak" },
  { name: "Şalgam Suyu",            cal: 12,  p: 0,  c: 2,  f: 0,  pieceGrams: 200,unitName: "Bardak" },
  { name: "Taze Portakal Suyu",     cal: 45,  p: 1,  c: 10, f: 0,  pieceGrams: 200,unitName: "Bardak" }
];

// ---- MET Values for Exercise Burned Calories ----
const EXERCISE_MET_DB = {
  yuruyus:  { name: "🚶 Tempolu Yürüyüş", met: 3.5 },
  kosu:     { name: "🏃 Koşu / Jogging", met: 8.0 },
  bisiklet: { name: "🚴 Bisiklet Sürme", met: 6.0 },
  yuzme:    { name: "🏊 Yüzme", met: 7.0 },
  fitness:  { name: "🏋️ Ağırlık / Fitness", met: 5.0 },
  pilates:  { name: "🧘 Pilates / Yoga", met: 3.0 },
  futbol:   { name: "⚽ Futbol / Basketbol", met: 7.0 },
  ipatlama: { name: "🪢 İp Atlama", met: 10.0 },
  dans:     { name: "💃 Dans / Zümba", met: 5.5 }
};

// ---- State ----
let dietLogs         = JSON.parse(localStorage.getItem("love_diet_logs")         || "{}");
let dietWaterLogs    = JSON.parse(localStorage.getItem("love_diet_water")        || "{}");
let weightLogs       = JSON.parse(localStorage.getItem("love_weight_logs")       || "[]");
let exerciseLogs     = JSON.parse(localStorage.getItem("love_exercise_logs")     || "{}");
let dietSettings     = JSON.parse(localStorage.getItem("love_diet_settings")     || '{"calTarget":2000,"waterTarget":8,"targetWeight":null}');
let bmiSettings      = JSON.parse(localStorage.getItem("love_bmi_settings")      || '{"height":175,"weight":70,"activity":1.6}');
let waterSettings    = JSON.parse(localStorage.getItem("love_water_settings")    || '{"glassMl":250,"reminder":false}');
let mealAccordionState=JSON.parse(localStorage.getItem("love_meal_accordions")   || '{"sabah":true,"ogle":true,"aksam":true,"ara":true}');

let dietCalendarDate = new Date();
let dietSelectedDate = new Date().toISOString().split("T")[0];
let currentMealType  = "sabah";
let currentFoodItem  = null;
let currentFoodUnit  = "g"; // "g" or "pc"
let editingMealIndex = -1;
let currentViewingPhotoForMove = null;

function saveDietLogs()         { localStorage.setItem("love_diet_logs",        JSON.stringify(dietLogs)); }
function saveDietWaterLogs()    { localStorage.setItem("love_diet_water",       JSON.stringify(dietWaterLogs)); }
function saveWeightLogs()       { localStorage.setItem("love_weight_logs",      JSON.stringify(weightLogs)); }
function saveExerciseLogs()     { localStorage.setItem("love_exercise_logs",    JSON.stringify(exerciseLogs)); }
function saveDietSettingsData() { localStorage.setItem("love_diet_settings",   JSON.stringify(dietSettings)); }
function saveBmiSettingsData()  { localStorage.setItem("love_bmi_settings",    JSON.stringify(bmiSettings)); }
function saveWaterSettingsData(){ localStorage.setItem("love_water_settings",  JSON.stringify(waterSettings)); }
function saveMealAccordions()   { localStorage.setItem("love_meal_accordions",  JSON.stringify(mealAccordionState)); }

// ---- Utility & Calculations ----
function dietDateKey(d) { return (d instanceof Date) ? d.toISOString().split("T")[0] : d; }

function getDayLogs(dateKey) {
  if (!dietLogs[dateKey]) dietLogs[dateKey] = [];
  return dietLogs[dateKey];
}

function getDayTotalCal(dateKey) {
  return getDayLogs(dateKey).reduce((s, e) => s + (e.calories || 0), 0);
}

function getDayTotalBurned(dateKey) {
  if (!exerciseLogs[dateKey]) return 0;
  return exerciseLogs[dateKey].reduce((s, e) => s + (e.burned || 0), 0);
}

function getDayNetCal(dateKey) {
  return getDayTotalCal(dateKey) - getDayTotalBurned(dateKey);
}

function getDayMacros(dateKey) {
  const entries = getDayLogs(dateKey);
  return entries.reduce((acc, e) => {
    acc.p += (e.protein  || 0);
    acc.c += (e.carbs    || 0);
    acc.f += (e.fat      || 0);
    return acc;
  }, { p: 0, c: 0, f: 0 });
}

// ---- Web Audio API Water Droplet Sound Synthesizer ----
function playWaterDropSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (err) {
    console.log("Audio play error:", err);
  }
}

// ---- Main Render ----
window.renderDietPage = function() {
  renderSmartDietAnalysis();
  renderBmiProteinCard();
  renderDietDailySummary();
  renderDietExerciseTracker();
  renderDietCalendar();
  renderDietDayMeals();
  renderDietWater();
  renderDietWeeklyChart();
  renderWeightHistory();
};

// 🤖 ---- AI Smart Analysis & Commentary Card ----
function renderSmartDietAnalysis() {
  const el = document.getElementById("dietAiAnalysisText");
  if (!el) return;

  const dateKey = dietSelectedDate;
  const consumed = getDayTotalCal(dateKey);
  const burned = getDayTotalBurned(dateKey);
  const net = consumed - burned;
  const target = dietSettings.calTarget || 2000;
  const macros = getDayMacros(dateKey);
  const waterCount = dietWaterLogs[dateKey] || 0;
  const glassMl = waterSettings.glassMl || 250;
  const waterLiters = (waterCount * glassMl / 1000).toFixed(1);

  // Protein Target calculation
  const weight = bmiSettings.weight || 70;
  const activity = parseFloat(bmiSettings.activity) || 1.6;
  const proteinTarget = Math.round(weight * activity);

  let commentary = [];

  if (consumed === 0) {
    commentary.push("🌅 **Bugün henüz öğün girişi yapılmadı.** Sağlıklı bir kahvaltı ile güne başlamak metabolizmanı hızlandırır!");
  } else if (net > target + 150) {
    const diff = net - target;
    commentary.push(`⚠️ **Kalori Hedefini Aştın (+${diff} kcal).** Akşam hafif bir salata tercih edebilir veya 20-30 dakika tempolu yürüyüş ile kalorini dengeleyebilirsin!`);
  } else if (net < target - 400 && net > 0) {
    const diff = target - net;
    commentary.push(`⚡ **Kalori Açığın Var (${diff} kcal kalan).** Diyetinde harika gidiyorsun! Protein veya lif yönünden zengin küçük bir ara öğün ekleyebilirsin.`);
  } else {
    commentary.push("🎉 **Mükemmel Kalori Dengesi!** Hedefinle tam uyum içindesin, bu şekilde devam et!");
  }

  // Protein & Water Advice
  if (macros.p >= proteinTarget && proteinTarget > 0) {
    commentary.push(`💪 **Protein Hedefi Tamamlandı!** (${Math.round(macros.p)}g / ${proteinTarget}g). Kas gelişimi ve tokluk hissi için süper bir oran.`);
  } else if (proteinTarget > 0) {
    commentary.push(`🥩 Protein alımın **${Math.round(macros.p)}g** seviyesinde. Hedefin olan **${proteinTarget}g** değerine ulaşmak için yumurta, lor veya ızgara tavuk ekleyebilirsin.`);
  }

  if (burned > 0) {
    commentary.push(`🔥 Bugün egzersiz ile **${burned} kcal** yaktın. Harika bir aktivite seviyesi!`);
  }

  if (parseFloat(waterLiters) >= 2.0) {
    commentary.push(`💧 Su tüketimin harika (**${waterLiters} Litre**)!`);
  }

  el.innerHTML = commentary
    .map(txt => `<p style="margin:0 0 8px 0; line-height:1.45;">${txt.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:700; color:var(--text-main,#fff);">$1</strong>')}</p>`)
    .join("");
}

// 📐 ---- BMI & Protein Target Card ----
function renderBmiProteinCard() {
  const bmiValEl  = document.getElementById("bmiValueText");
  const badgeEl   = document.getElementById("bmiStatusBadge");
  const protText  = document.getElementById("proteinProgressText");
  const fillEl    = document.getElementById("proteinProgressBarFill");
  if (!bmiValEl || !protText || !fillEl) return;

  const h = (bmiSettings.height || 175) / 100;
  const w = bmiSettings.weight || 70;
  const act = parseFloat(bmiSettings.activity) || 1.6;

  const bmi = (w / (h * h)).toFixed(1);
  bmiValEl.textContent = bmi;

  if (badgeEl) {
    badgeEl.textContent = "✨ İndeks Skorun";
    badgeEl.className = "bmi-badge normal";
  }

  const targetProtein = Math.round(w * act);
  const currentProtein = Math.round(getDayMacros(dietSelectedDate).p);
  const pct = Math.min(100, Math.round((currentProtein / targetProtein) * 100));

  protText.textContent = `${currentProtein}g / ${targetProtein}g`;
  fillEl.style.width = `${pct}%`;
}

window.openBmiEditModal = function() {
  const modal = document.getElementById("bmiEditModal");
  const hInput = document.getElementById("inputBmiHeight");
  const wInput = document.getElementById("inputBmiWeight");
  const aSelect = document.getElementById("selectBmiActivity");

  if (hInput)  hInput.value  = bmiSettings.height || 175;
  if (wInput)  wInput.value  = bmiSettings.weight || 70;
  if (aSelect) aSelect.value = bmiSettings.activity || 1.6;

  if (modal) modal.classList.add("active");
};

window.closeBmiEditModal = function() {
  document.getElementById("bmiEditModal")?.classList.remove("active");
};

window.saveBmiSettings = function() {
  const h = parseFloat(document.getElementById("inputBmiHeight")?.value) || 175;
  const w = parseFloat(document.getElementById("inputBmiWeight")?.value) || 70;
  const act = parseFloat(document.getElementById("selectBmiActivity")?.value) || 1.6;

  bmiSettings = { height: h, weight: w, activity: act };
  saveBmiSettingsData();
  closeBmiEditModal();
  renderDietPage();
};

// 🏋️ ---- Exercise Tracker Module ----
function renderDietExerciseTracker() {
  const el = document.getElementById("dietExerciseLogsList");
  if (!el) return;

  const entries = exerciseLogs[dietSelectedDate] || [];
  if (entries.length === 0) {
    el.innerHTML = `<div style="text-align:center; padding:16px; color:var(--text-sub); font-size:0.82rem;">
      🏃 Henüz bugün için egzersiz girilmedi. "+ Egzersiz Gir" ile ekleyin.
    </div>`;
    return;
  }

  let html = "";
  entries.forEach((entry, idx) => {
    const exInfo = EXERCISE_MET_DB[entry.type] || { name: entry.type };
    html += `
      <div class="diet-meal-entry" style="border-left: 3px solid #ff4444; background: rgba(255, 68, 68, 0.04);">
        <div class="diet-meal-entry-left">
          <div class="diet-meal-entry-name">${exInfo.name}</div>
          <div class="diet-meal-entry-sub">⏱️ ${entry.minutes} Dakika Süre</div>
        </div>
        <div class="diet-meal-entry-cal" style="color:#ff4444; font-weight:bold; font-size:1.05rem;">🔥 -${entry.burned} kcal</div>
        <button class="diet-meal-del-btn" onclick="deleteExerciseEntry('${dietSelectedDate}', ${idx})" title="Sil">🗑</button>
      </div>
    `;
  });
  el.innerHTML = html;
}

window.openAddExerciseModal = function() {
  const modal = document.getElementById("addExerciseModal");
  recalcBurnedCalories();
  if (modal) modal.classList.add("active");
};

window.closeAddExerciseModal = function() {
  document.getElementById("addExerciseModal")?.classList.remove("active");
};

window.recalcBurnedCalories = function() {
  const type = document.getElementById("selectExerciseType")?.value || "yuruyus";
  const minutes = parseFloat(document.getElementById("inputExerciseMinutes")?.value) || 30;
  const weight = bmiSettings.weight || 70;
  const met = EXERCISE_MET_DB[type]?.met || 4.0;

  const burned = Math.round(met * weight * (minutes / 60));
  const label = document.getElementById("calculatedBurnedCalLabel");
  if (label) label.textContent = `${burned} kcal`;
};

window.saveExerciseEntry = function() {
  const type = document.getElementById("selectExerciseType")?.value || "yuruyus";
  const minutes = parseFloat(document.getElementById("inputExerciseMinutes")?.value) || 30;
  const weight = bmiSettings.weight || 70;
  const met = EXERCISE_MET_DB[type]?.met || 4.0;
  const burned = Math.round(met * weight * (minutes / 60));

  if (!exerciseLogs[dietSelectedDate]) exerciseLogs[dietSelectedDate] = [];
  exerciseLogs[dietSelectedDate].push({ type, minutes, burned });

  saveExerciseLogs();
  closeAddExerciseModal();
  renderDietDailySummary();
  renderDietExerciseTracker();
  renderSmartDietAnalysis();
  renderDietWeeklyChart();
  renderDietCalendar();
};

window.deleteExerciseEntry = function(dateKey, idx) {
  showCustomConfirmModal("Egzersizi Sil 🗑️", "Bu egzersiz kaydını silmek istediğinize emin misiniz?", () => {
    if (exerciseLogs[dateKey]) {
      exerciseLogs[dateKey].splice(idx, 1);
      saveExerciseLogs();
      renderDietDailySummary();
      renderDietExerciseTracker();
      renderSmartDietAnalysis();
      renderDietWeeklyChart();
      renderDietCalendar();
    }
  });
};

// ---- Daily Summary (Kalori Özet Paneli) ----
function renderDietDailySummary() {
  const el = document.getElementById("dietDailySummary");
  if (!el) return;

  const consumed = getDayTotalCal(dietSelectedDate);
  const burned   = getDayTotalBurned(dietSelectedDate);
  const net      = consumed - burned;
  const target   = dietSettings.calTarget || 2000;
  const macros   = getDayMacros(dietSelectedDate);
  const pct      = Math.min(100, Math.round((Math.max(0, net) / target) * 100));
  const remaining = Math.max(0, target - net);

  const barColor = net > target ? "#ff4444" : "var(--primary-pink)";

  const burnedBadgeHtml = burned > 0 ? `
    <div style="background: rgba(255, 68, 68, 0.15); border: 1.5px solid #ff4444; color: #ff4444; font-size: 0.85rem; font-weight: 800; padding: 6px 14px; border-radius: 20px; margin-bottom: 12px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 0 12px rgba(255,68,68,0.25);">
      🔥 Spor İle Eksilen/Yakılan Kalori: -${burned.toLocaleString("tr-TR")} kcal
    </div>
  ` : "";

  el.innerHTML = `
    <div class="diet-summary-bar-wrap">
      ${burnedBadgeHtml}

      <div class="diet-summary-numbers">
        <div>
          <div class="diet-cal-big">${net.toLocaleString("tr-TR")}</div>
          <div class="diet-cal-target">Net Kalori (Alınan ${consumed} - <span style="color:#ff4444; font-weight:bold;">🔥 Yakılan -${burned}</span>)</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:1.1rem; font-weight:700; color:${net > target ? '#ff6b6b' : '#10b981'}">
            ${net > target ? '+' + (net - target) + ' fazla' : remaining + ' kalan'}
          </div>
          <div class="diet-cal-target">Hedef: ${target.toLocaleString("tr-TR")} kcal</div>
        </div>
      </div>
      <div class="diet-progress-bar-bg">
        <div class="diet-progress-bar-fill" style="width:${pct}%; background:linear-gradient(90deg, ${barColor}, ${barColor});"></div>
      </div>
      <div class="diet-macros-row">
        <div class="diet-macro-chip">🥩 <span class="macro-val">${Math.round(macros.p)}g</span><span class="macro-lbl">Protein</span></div>
        <div class="diet-macro-chip">🌾 <span class="macro-val">${Math.round(macros.c)}g</span><span class="macro-lbl">Karb</span></div>
        <div class="diet-macro-chip">🧈 <span class="macro-val">${Math.round(macros.f)}g</span><span class="macro-lbl">Yağ</span></div>
        <div class="diet-macro-chip" style="border-color:#ff4444; background:rgba(255,68,68,0.12);">🔥 <span class="macro-val" style="color:#ff4444; font-weight:bold;">-${burned}</span><span class="macro-lbl" style="color:#ff4444;">Yakılan</span></div>
      </div>
    </div>
  `;
}

// ---- Diet Calendar ----
window.changeDietCalendarMonth = function(delta) {
  dietCalendarDate = new Date(dietCalendarDate.getFullYear(), dietCalendarDate.getMonth() + delta, 1);
  renderDietCalendar();
};

function renderDietCalendar() {
  const grid  = document.getElementById("dietCalendarDaysGrid");
  const label = document.getElementById("dietCalendarMonthYearText");
  if (!grid || !label) return;

  const TR_MONTHS = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  const y = dietCalendarDate.getFullYear();
  const m = dietCalendarDate.getMonth();
  label.textContent = `${TR_MONTHS[m]} ${y}`;

  const firstDay = new Date(y, m, 1);
  let startDow = firstDay.getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1; // Mon-based
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];
  const target = dietSettings.calTarget || 2000;

  let html = "";
  for (let i = 0; i < startDow; i++) html += `<div class="calendar-day empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const dayNet = getDayNetCal(dateKey);
    const dayConsumed = getDayTotalCal(dateKey);
    const isToday    = dateKey === today;
    const isSelected = dateKey === dietSelectedDate;
    const hasLog     = dayConsumed > 0;

    let cls = "calendar-day";
    if (isToday)    cls += " today";
    if (isSelected) cls += " has-memory selected";

    let statusDot = "";
    if (hasLog) {
      const dotCls = dayNet > target ? "red" : (dayNet >= target - 300 ? "green" : "yellow");
      statusDot = `<div class="diet-cal-day-status ${dotCls}"></div>`;
    }

    const calLabel = hasLog ? `<div class="diet-cal-day-label">${dayNet > 999 ? Math.round(dayNet/1000*10)/10+'k' : dayNet}</div>` : "";
    html += `<div class="${cls}" onclick="dietSelectDay('${dateKey}')" style="${isSelected ? 'border: 2px solid var(--primary-pink); box-shadow: 0 0 12px var(--glass-glow);' : (hasLog ? 'border-color:rgba(255,255,255,0.2);' : '')}">${d}${statusDot}${calLabel}</div>`;
  }
  grid.innerHTML = html;
}

window.dietSelectDay = function(dateKey) {
  dietSelectedDate = dateKey;
  renderDietCalendar();
  renderDietDayMeals();
  renderDietDailySummary();
  renderDietWater();
  renderDietExerciseTracker();
  renderSmartDietAnalysis();

  const titleEl = document.getElementById("dietSelectedDayTitle");
  if (titleEl) {
    const today = new Date().toISOString().split("T")[0];
    const d = new Date(dateKey + "T12:00:00");
    const days = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
    const months = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
    const dayOfWeek = days[d.getDay()];
    const label = dateKey === today
      ? "📅 Bugün"
      : `📅 ${dayOfWeek}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    titleEl.textContent = label;
  }

  const panel = document.getElementById("dietDayPanel");
  if (panel) {
    setTimeout(() => {
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }
};

// 📱 ---- Collapsible Accordion Meals List & Bulk Delete ----
window.toggleMealAccordion = function(groupType) {
  mealAccordionState[groupType] = !mealAccordionState[groupType];
  saveMealAccordions();
  renderDietDayMeals();
};

function renderDietDayMeals() {
  const el = document.getElementById("dietDayMealsList");
  if (!el) return;

  const entries = getDayLogs(dietSelectedDate);
  const mealGroups = [
    { type:"sabah", label:"🌅 Sabah Kahvaltısı" },
    { type:"ogle",  label:"☀️ Öğle Yemeği" },
    { type:"aksam", label:"🌙 Akşam Yemeği" },
    { type:"ara",   label:"🍎 Ara Öğün" },
  ];

  let html = "";
  let anyEntry = false;

  mealGroups.forEach(group => {
    const groupEntries = entries.filter(e => e.mealType === group.type);
    const isOpen = mealAccordionState[group.type] !== false;
    const groupCal = groupEntries.reduce((s, e) => s + (e.calories || 0), 0);

    if (groupEntries.length > 0) anyEntry = true;

    html += `
      <div class="diet-meal-group" style="margin-bottom:10px;">
        <div class="diet-meal-accordion-header ${isOpen ? 'open' : ''}" onclick="toggleMealAccordion('${group.type}')">
          <span class="diet-meal-group-title">${group.label} (${groupEntries.length})</span>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="diet-meal-group-cal">${Math.round(groupCal)} kcal</span>
            <span class="diet-accordion-arrow">▼</span>
          </div>
        </div>
        <div class="diet-accordion-content" style="display:${isOpen ? 'block' : 'none'};">
    `;

    if (groupEntries.length === 0) {
      html += `<div style="font-size:0.78rem; color:var(--text-sub); font-style:italic; padding:6px 10px;">Bu öğüne ekleme yapılmadı.</div>`;
    } else {
      groupEntries.forEach((entry) => {
        const globalIdx = entries.indexOf(entry);
        const sub = [];
        if (entry.grams)   sub.push(`${entry.grams}g`);
        if (entry.protein) sub.push(`P:${Math.round(entry.protein)}g`);
        if (entry.carbs)   sub.push(`K:${Math.round(entry.carbs)}g`);
        if (entry.fat)     sub.push(`Y:${Math.round(entry.fat)}g`);
        if (entry.note)    sub.push(`📝 ${entry.note}`);

        html += `
          <div class="diet-meal-entry">
            <div class="diet-meal-entry-left">
              <div class="diet-meal-entry-name">${escapeHtml(entry.foodName)}</div>
              ${sub.length ? `<div class="diet-meal-entry-sub">${sub.join(" · ")}</div>` : ""}
            </div>
            <div class="diet-meal-entry-cal">${Math.round(entry.calories)} kcal</div>
            <button class="diet-meal-del-btn" onclick="openEditMealModal('${dietSelectedDate}', ${globalIdx})" title="Düzenle" style="color:var(--accent-cyan);">✏️</button>
            <button class="diet-meal-del-btn" onclick="deleteDietEntry('${dietSelectedDate}', ${globalIdx})" title="Sil">🗑</button>
          </div>
        `;
      });
    }
    html += `</div></div>`;
  });

  if (!anyEntry) {
    html = `
      <div style="text-align:center; padding:24px 16px; color:var(--text-sub);">
        <div style="font-size:2.5rem; margin-bottom:8px;">🍽️</div>
        <p style="font-weight:bold; color:#fff; margin:0;">Henüz bu güne öğün eklenmedi</p>
        <p style="font-size:0.82rem; margin-top:4px;">Yukarıdaki "+ Öğün Ekle" butonuna basın</p>
      </div>
    `;
  }

  el.innerHTML = html;
}

window.deleteDietEntry = function(dateKey, index) {
  showCustomConfirmModal("Öğünü Sil 🗑️", "Bu öğünü silmek istediğinize emin misiniz?", () => {
    if (dietLogs[dateKey]) {
      dietLogs[dateKey].splice(index, 1);
      saveDietLogs();
      renderDietDailySummary();
      renderDietDayMeals();
      renderDietCalendar();
      renderDietWeeklyChart();
      renderSmartDietAnalysis();
    }
  });
};

window.bulkDeleteSelectedDayMeals = function() {
  const entries = getDayLogs(dietSelectedDate);
  if (entries.length === 0) {
    showInfoModal("Toplu Silme ℹ️", "Bu güne henüz öğün eklenmemiş.");
    return;
  }
  showCustomConfirmModal("Tüm Öğünleri Sil 🗑️", "Seçili günün TÜM öğün kayıtlarını silmek istediğinize emin misiniz?", () => {
    dietLogs[dietSelectedDate] = [];
    saveDietLogs();
    renderDietDailySummary();
    renderDietDayMeals();
    renderDietCalendar();
    renderDietWeeklyChart();
    renderSmartDietAnalysis();
  });
};

// 💧 ---- Water Tracker & Customization ----
function renderDietWater() {
  const el = document.getElementById("dietWaterGlasses");
  const label = document.getElementById("dietWaterCountLabel");
  const chk = document.getElementById("chkWaterReminder");
  const selGlass = document.getElementById("selWaterGlassMl");
  if (!el) return;

  const targetGlasses = dietSettings.waterTarget || 8;
  const filledGlasses = dietWaterLogs[dietSelectedDate] || 0;
  const glassMl = waterSettings.glassMl || 250;

  const litresFilled = (filledGlasses * glassMl / 1000).toFixed(2).replace(/\.?0+$/, '');
  const litresTarget = (targetGlasses * glassMl / 1000).toFixed(2).replace(/\.?0+$/, '');

  if (label) label.textContent = `${filledGlasses}/${targetGlasses} bardak · ${litresFilled} L / ${litresTarget} L`;
  if (chk) chk.checked = waterSettings.reminder || false;
  if (selGlass) selGlass.value = glassMl;

  let html = "";
  for (let i = 0; i < targetGlasses; i++) {
    const isFilled = i < filledGlasses;
    const glassVol = ((i + 1) * glassMl / 1000).toFixed(2);
    html += `<button class="water-glass-btn${isFilled ? " filled" : ""}" onclick="toggleWaterGlass(${i})" title="${i+1}. bardak (${glassVol}L)">${isFilled ? '🥛' : '🫙'}</button>`;
  }
  el.innerHTML = html;
}

window.toggleWaterGlass = function(index) {
  const current = dietWaterLogs[dietSelectedDate] || 0;
  dietWaterLogs[dietSelectedDate] = (index < current) ? index : index + 1;
  saveDietWaterLogs();

  if (waterSettings.reminder) playWaterDropSound();

  renderDietWater();
  renderSmartDietAnalysis();
};

window.addWaterLiters = function(liters) {
  const glassMl = waterSettings.glassMl || 250;
  const glassesToAdd = Math.round((liters * 1000) / glassMl);
  const current = dietWaterLogs[dietSelectedDate] || 0;

  dietWaterLogs[dietSelectedDate] = current + glassesToAdd;
  saveDietWaterLogs();

  if (waterSettings.reminder) playWaterDropSound();

  renderDietWater();
  renderSmartDietAnalysis();
};

window.changeWaterGlassVolume = function(mlStr) {
  waterSettings.glassMl = parseInt(mlStr, 10) || 250;
  saveWaterSettingsData();
  renderDietWater();
  renderSmartDietAnalysis();
};

window.toggleWaterReminder = function(enabled) {
  waterSettings.reminder = enabled;
  saveWaterSettingsData();
  if (enabled) playWaterDropSound();
};

// 📈 ---- Weekly Trend Chart (Net Calories Canvas) ----
function renderDietWeeklyChart() {
  const canvas = document.getElementById("dietWeeklyChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
  canvas.height = canvas.height * (window.devicePixelRatio || 1);
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

  const W = canvas.offsetWidth;
  const H = 160;
  ctx.clearRect(0, 0, W, H);

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }

  const values = days.map(dk => Math.max(0, getDayNetCal(dk)));
  const target = dietSettings.calTarget || 2000;
  const maxVal = Math.max(target * 1.25, ...values, 100);

  const padL = 36, padR = 10, padT = 16, padB = 36;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  // Grid
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const y = padT + (chartH / 4) * g;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "10px Outfit, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(Math.round(maxVal - (maxVal / 4) * g), padL - 4, y + 3);
  }

  // Target Line
  const targetY = padT + chartH * (1 - target / maxVal);
  ctx.strokeStyle = "rgba(255,183,3,0.6)";
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(padL, targetY); ctx.lineTo(W - padR, targetY); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,183,3,0.8)";
  ctx.font = "10px Outfit, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Hedef", padL + 4, targetY - 3);

  // Bars
  const barW = Math.max(12, (chartW / 7) - 8);
  const TR_DAYS_SHORT = ["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];

  days.forEach((dk, i) => {
    const val = values[i];
    const x = padL + (chartW / 7) * i + (chartW / 7 - barW) / 2;
    const barH = val > 0 ? Math.max(4, chartH * (val / maxVal)) : 0;
    const y = padT + chartH - barH;

    const overTarget = val > target;
    ctx.fillStyle = overTarget ? "rgba(255,80,80,0.85)" : "rgba(255,42,109,0.85)";
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, 6);
    ctx.fill();

    const d = new Date(dk + "T12:00:00");
    const dow = d.getDay();
    const monBased = dow === 0 ? 6 : dow - 1;
    ctx.fillStyle = dk === dietSelectedDate ? "#ffffff" : "rgba(255,255,255,0.5)";
    ctx.font = `${dk === dietSelectedDate ? "bold " : ""}11px Outfit, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(TR_DAYS_SHORT[monBased], x + barW / 2, H - padB + 14);

    if (val > 0) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "9px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(val > 999 ? (val/1000).toFixed(1)+"k" : val, x + barW / 2, y - 3);
    }
  });
}

// ⚖️ ---- Weight History ----
function renderWeightHistory() {
  const el = document.getElementById("dietWeightHistory");
  if (!el) return;

  if (weightLogs.length === 0) {
    el.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-sub);">
      <div style="font-size:2rem; margin-bottom:6px;">⚖️</div>
      <p style="font-size:0.85rem;">Henüz kilo verisi yok. "+ Kilo Gir" ile başla.</p>
    </div>`;
    return;
  }

  const sorted = [...weightLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
  const target = dietSettings.targetWeight;

  let html = "";
  sorted.slice(0, 10).forEach((entry, i) => {
    const prev = sorted[i + 1];
    let delta = null;
    if (prev) delta = entry.kg - prev.kg;

    const d = new Date(entry.date + "T12:00:00");
    const months = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
    const dateLabel = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;

    let deltaHtml = "";
    if (delta !== null) {
      const cls = delta < 0 ? "down" : (delta > 0 ? "up" : "same");
      const sign = delta > 0 ? "+" : "";
      deltaHtml = `<div class="weight-log-delta ${cls}">${sign}${delta.toFixed(1)} kg</div>`;
    }

    const targetDiff = target ? (entry.kg - target).toFixed(1) : null;
    const targetLabel = targetDiff ? `<div style="font-size:0.72rem; color:var(--text-sub);">Hedefe: ${targetDiff > 0 ? '+' : ''}${targetDiff} kg</div>` : "";

    html += `
      <div class="weight-log-entry">
        <div>
          <div class="weight-log-kg">${entry.kg} kg</div>
          <div class="weight-log-date">${dateLabel}</div>
          ${targetLabel}
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          ${deltaHtml}
          <button class="diet-meal-del-btn" onclick="deleteWeightEntry(${i})" title="Sil">🗑</button>
        </div>
      </div>
    `;
  });

  if (target) {
    html = `<div style="font-size:0.82rem; color:var(--text-sub); margin-bottom:10px; text-align:center;">🎯 Hedef Kilo: <strong style="color:var(--primary-pink);">${target} kg</strong></div>` + html;
  }

  el.innerHTML = html;
}

window.deleteWeightEntry = function(idx) {
  const sorted = [...weightLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
  const entryToDelete = sorted[idx];
  showCustomConfirmModal("Kilo Kaydını Sil ⚖️", "Bu kilo kaydını silmek istediğinize emin misiniz?", () => {
    const realIdx = weightLogs.findIndex(e => e.date === entryToDelete.date && e.kg === entryToDelete.kg);
    if (realIdx !== -1) {
      weightLogs.splice(realIdx, 1);
      saveWeightLogs();
      renderWeightHistory();
    }
  });
};

// ➕ ---- Modal: Add / Edit Meal with Units & Live Draft List ----
function renderModalDraftMealList() {
  const container = document.getElementById("modalMealDraftList");
  const totalCalText = document.getElementById("modalDraftTotalCalText");
  if (!container) return;

  const allDayEntries = getDayLogs(dietSelectedDate);
  const entries = allDayEntries.filter(e => e.mealType === currentMealType);
  const totalCal = entries.reduce((s, e) => s + (e.calories || 0), 0);

  if (totalCalText) totalCalText.textContent = `${Math.round(totalCal)} kcal`;

  if (entries.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:12px; color:var(--text-sub); font-size:0.8rem; font-style:italic;">
      Henüz bu öğüne ürün eklenmedi. Arayıp "➕ Listeye Ekle" butonuna basın.
    </div>`;
    return;
  }

  let html = "";
  entries.forEach((entry) => {
    const globalIdx = allDayEntries.indexOf(entry);
    const qtyText = entry.grams ? `${entry.grams}g` : '';
    html += `
      <div class="modal-draft-item">
        <div>
          <div class="modal-draft-item-name">${escapeHtml(entry.foodName)}</div>
          <div class="modal-draft-item-sub">${qtyText} ${entry.note ? '· 📝 ' + escapeHtml(entry.note) : ''}</div>
        </div>
        <div style="display:flex; align-items:center;">
          <span class="modal-draft-item-cal">${Math.round(entry.calories)} kcal</span>
          <button type="button" class="diet-meal-del-btn" onclick="deleteDraftMealEntry(${globalIdx})" title="Sil">🗑</button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

window.deleteDraftMealEntry = function(globalIdx) {
  if (dietLogs[dietSelectedDate]) {
    dietLogs[dietSelectedDate].splice(globalIdx, 1);
    saveDietLogs();
    renderModalDraftMealList();
    renderDietDailySummary();
    renderDietDayMeals();
    renderDietCalendar();
    renderDietWeeklyChart();
    renderSmartDietAnalysis();
  }
};

window.openAddMealModal = function(mealType) {
  editingMealIndex = -1;
  currentFoodItem = null;
  currentFoodUnit = "g";

  const titleEl   = document.getElementById("addMealModalTitle");
  const modal     = document.getElementById("addMealModal");
  const foodInput = document.getElementById("foodSearchInput");
  const gramInput = document.getElementById("inputFoodGrams");
  const noteInput = document.getElementById("inputMealNote");
  const dropdown  = document.getElementById("foodSearchDropdown");
  const selRow    = document.getElementById("selectedFoodRow");
  const manRow    = document.getElementById("manualCalRow");

  if (titleEl)   titleEl.textContent = "🍽️ Öğün Ekle";
  if (foodInput) foodInput.value = "";
  if (gramInput) gramInput.value = "100";
  if (noteInput) noteInput.value = "";
  if (dropdown)  dropdown.style.display = "none";
  if (selRow)    selRow.style.display   = "none";
  if (manRow)    manRow.style.display   = "none";

  toggleFoodUnit("g");
  selectMealType(mealType || currentMealType);
  renderModalDraftMealList();
  if (modal) modal.classList.add("active");
};

window.openEditMealModal = function(dateKey, index) {
  const entries = getDayLogs(dateKey);
  const entry   = entries[index];
  if (!entry) return;

  editingMealIndex = index;
  currentFoodItem  = null;
  currentFoodUnit  = "g";

  const titleEl   = document.getElementById("addMealModalTitle");
  const modal     = document.getElementById("addMealModal");
  const foodInput = document.getElementById("foodSearchInput");
  const gramInput = document.getElementById("inputFoodGrams");
  const noteInput = document.getElementById("inputMealNote");
  const dropdown  = document.getElementById("foodSearchDropdown");
  const selRow    = document.getElementById("selectedFoodRow");
  const manRow    = document.getElementById("manualCalRow");
  const nameEl    = document.getElementById("selectedFoodName");
  const subEl     = document.getElementById("selectedFoodCalPer100");
  const calLabel  = document.getElementById("calculatedCalLabel");
  const macrosRow = document.getElementById("calculatedMacrosRow");
  const manCalInput = document.getElementById("inputManualCalories");

  if (titleEl) titleEl.textContent = "✏️ Öğünü Düzenle";
  if (noteInput) noteInput.value = entry.note || "";
  if (dropdown) dropdown.style.display = "none";

  selectMealType(entry.mealType || "sabah");

  const dbFood = FOOD_DB.find(f => f.name === entry.foodName);
  if (dbFood && entry.grams) {
    currentFoodItem = dbFood;
    if (foodInput) foodInput.value = dbFood.name;
    if (gramInput) gramInput.value = entry.grams;
    if (selRow)    selRow.style.display   = "block";
    if (manRow)    manRow.style.display   = "none";
    if (nameEl)    nameEl.textContent     = dbFood.name;
    if (subEl)     subEl.textContent      = `${dbFood.cal} kcal · P:${dbFood.p}g · K:${dbFood.c}g · Y:${dbFood.f}g (100g başına)`;
    if (calLabel)  calLabel.textContent   = `${entry.calories} kcal`;
    if (macrosRow) macrosRow.innerHTML    = `<span>🥩 Protein: <strong>${entry.protein}g</strong></span><span>🌾 Karb: <strong>${entry.carbs}g</strong></span><span>🧈 Yağ: <strong>${entry.fat}g</strong></span>`;
  } else {
    if (foodInput)   foodInput.value   = entry.foodName;
    if (gramInput)   gramInput.value   = entry.grams || "";
    if (selRow)      selRow.style.display   = "none";
    if (manRow)      manRow.style.display   = "block";
    if (manCalInput) manCalInput.value      = entry.calories || "";
  }

  renderModalDraftMealList();
  if (modal) modal.classList.add("active");
};

window.closeAddMealModal = function() {
  document.getElementById("addMealModal")?.classList.remove("active");
  document.getElementById("foodSearchDropdown").style.display = "none";
};

window.selectMealType = function(type) {
  currentMealType = type;
  document.querySelectorAll(".meal-type-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });
  renderModalDraftMealList();
};

window.toggleFoodUnit = function(unit) {
  currentFoodUnit = unit;
  const btnG = document.getElementById("btnUnitGram");
  const btnPc = document.getElementById("btnUnitPiece");
  const unitLbl = document.getElementById("foodUnitLabel");
  const gramInput = document.getElementById("inputFoodGrams");

  if (btnG)  btnG.classList.toggle("active", unit === "g");
  if (btnPc) btnPc.classList.toggle("active", unit === "pc");

  if (unitLbl) {
    unitLbl.textContent = unit === "pc" ? (currentFoodItem?.unitName || "Adet") : "g";
  }

  if (gramInput && currentFoodItem) {
    if (unit === "pc") {
      gramInput.value = "1"; // Default 1 piece
    } else {
      gramInput.value = "100"; // Default 100g
    }
  }

  recalcCalories();
};

window.adjustMealQty = function(delta) {
  const input = document.getElementById("inputFoodGrams");
  if (!input) return;
  let val = parseFloat(input.value) || 0;
  const step = currentFoodUnit === "pc" ? 1 : 25;

  val = Math.max(1, val + delta * step);
  input.value = val;
  recalcCalories();
};

// ---- Food Search ----
window.handleFoodSearch = function() {
  const input = document.getElementById("foodSearchInput");
  const dropdown = document.getElementById("foodSearchDropdown");
  const selRow = document.getElementById("selectedFoodRow");
  const manRow = document.getElementById("manualCalRow");
  if (!input || !dropdown) return;

  const q = input.value.trim().toLowerCase();
  if (!q) { dropdown.style.display = "none"; return; }

  const matches = FOOD_DB.filter(f => f.name.toLowerCase().includes(q)).slice(0, 15);

  if (matches.length === 0) {
    dropdown.style.display = "none";
    if (selRow) selRow.style.display = "none";
    if (manRow) manRow.style.display = "block";
    return;
  }

  let html = "";
  matches.forEach(food => {
    const unitBadge = food.pieceGrams ? ` ~${food.pieceGrams}g/1 ${food.unitName || 'Adet'}` : '';
    html += `
      <div class="food-search-item" onclick="selectFoodItem('${food.name.replace(/'/g,"\\'")}')">
        <span>${food.name} <small style="color:var(--text-sub);">${unitBadge}</small></span>
        <span class="food-kcal-badge">${food.cal} kcal/100g</span>
      </div>
    `;
  });

  const hasExactMatch = matches.some(f => f.name.toLowerCase() === q);
  if (!hasExactMatch) {
    html += `<div class="food-search-item" onclick="useManualEntry()" style="color:var(--text-sub); font-style:italic;">
      <span>📝 Manuel giriş yap: "${escapeHtml(input.value.trim())}"</span>
    </div>`;
  }

  dropdown.innerHTML = html;
  dropdown.style.display = "block";
  if (manRow) manRow.style.display = "none";
};

window.selectFoodItem = function(name) {
  const food = FOOD_DB.find(f => f.name === name);
  if (!food) return;

  currentFoodItem = food;
  const foodInput = document.getElementById("foodSearchInput");
  const dropdown  = document.getElementById("foodSearchDropdown");
  const selRow    = document.getElementById("selectedFoodRow");
  const manRow    = document.getElementById("manualCalRow");
  const nameEl    = document.getElementById("selectedFoodName");
  const subEl     = document.getElementById("selectedFoodCalPer100");

  if (foodInput) foodInput.value = food.name;
  if (dropdown)  dropdown.style.display = "none";
  if (selRow)    selRow.style.display   = "block";
  if (manRow)    manRow.style.display   = "none";
  if (nameEl)    nameEl.textContent     = food.name;
  if (subEl)     subEl.textContent      = `${food.cal} kcal · P:${food.p}g · K:${food.c}g · Y:${food.f}g (100g başına)`;

  toggleFoodUnit("g");
  recalcCalories();
};

window.useManualEntry = function() {
  currentFoodItem = null;
  document.getElementById("foodSearchDropdown").style.display = "none";
  document.getElementById("selectedFoodRow").style.display   = "none";
  document.getElementById("manualCalRow").style.display      = "block";
};

window.recalcCalories = function() {
  if (!currentFoodItem) return;
  const qtyInput  = document.getElementById("inputFoodGrams");
  const calLabel  = document.getElementById("calculatedCalLabel");
  const macrosRow = document.getElementById("calculatedMacrosRow");
  let qty = parseFloat(qtyInput?.value) || 1;

  let totalGrams = qty;
  if (currentFoodUnit === "pc") {
    totalGrams = qty * (currentFoodItem.pieceGrams || 100);
  }

  const cal = Math.round((currentFoodItem.cal * totalGrams) / 100);
  const p   = Math.round((currentFoodItem.p   * totalGrams) / 100);
  const c   = Math.round((currentFoodItem.c   * totalGrams) / 100);
  const f   = Math.round((currentFoodItem.f   * totalGrams) / 100);

  if (calLabel) calLabel.textContent = `${cal} kcal`;
  if (macrosRow) macrosRow.innerHTML = `
    <span>🥩 Protein: <strong>${p}g</strong></span>
    <span>🌾 Karb: <strong>${c}g</strong></span>
    <span>🧈 Yağ: <strong>${f}g</strong></span>
  `;
};

window.saveMealEntry = function(closeModalAfterSave = true) {
  const note = document.getElementById("inputMealNote")?.value.trim() || "";
  let newEntry = null;

  if (currentFoodItem) {
    let qty = parseFloat(document.getElementById("inputFoodGrams")?.value) || 100;
    let totalGrams = qty;
    if (currentFoodUnit === "pc") {
      totalGrams = qty * (currentFoodItem.pieceGrams || 100);
    }

    const cal = Math.round((currentFoodItem.cal * totalGrams) / 100);
    const p   = (currentFoodItem.p * totalGrams) / 100;
    const c   = (currentFoodItem.c * totalGrams) / 100;
    const f   = (currentFoodItem.f * totalGrams) / 100;

    newEntry = {
      mealType: currentMealType,
      foodName: currentFoodItem.name,
      grams:    Math.round(totalGrams),
      calories: cal,
      protein:  Math.round(p),
      carbs:    Math.round(c),
      fat:      Math.round(f),
      note:     note
    };
  } else {
    const foodName = document.getElementById("foodSearchInput")?.value.trim() || "Manuel Giriş";
    const manCal   = parseInt(document.getElementById("inputManualCalories")?.value) || 0;
    if (manCal <= 0) { showInfoModal("Eksik Kalori ℹ️", "Lütfen geçerli bir kalori değeri giriniz!"); return; }

    newEntry = {
      mealType: currentMealType,
      foodName: foodName || "Manuel Yemek",
      grams:    null,
      calories: manCal,
      protein:  0,
      carbs:    0,
      fat:      0,
      note:     note
    };
  }

  if (!dietLogs[dietSelectedDate]) dietLogs[dietSelectedDate] = [];

  if (editingMealIndex >= 0) {
    dietLogs[dietSelectedDate][editingMealIndex] = newEntry;
    editingMealIndex = -1;
  } else {
    dietLogs[dietSelectedDate].push(newEntry);
  }

  saveDietLogs();
  renderDietDailySummary();
  renderDietDayMeals();
  renderDietCalendar();
  renderDietWeeklyChart();
  renderSmartDietAnalysis();
  renderModalDraftMealList();

  if (closeModalAfterSave) {
    closeAddMealModal();
  } else {
    // Reset inputs for continuous adding into live draft list
    const foodInput = document.getElementById("foodSearchInput");
    const selRow = document.getElementById("selectedFoodRow");
    const manRow = document.getElementById("manualCalRow");
    const noteInput = document.getElementById("inputMealNote");

    if (foodInput) foodInput.value = "";
    if (selRow) selRow.style.display = "none";
    if (manRow) manRow.style.display = "none";
    if (noteInput) noteInput.value = "";
    currentFoodItem = null;
  }
};

// ---- Modal: Diet Settings ----
window.openDietSettingsModal = function() {
  const modal = document.getElementById("dietSettingsModal");
  const calInput    = document.getElementById("inputDailyCalTarget");
  const waterInput  = document.getElementById("inputDailyWaterTarget");
  const weightInput = document.getElementById("inputTargetWeight");

  if (calInput)    calInput.value    = dietSettings.calTarget    || 2000;
  if (waterInput)  waterInput.value  = dietSettings.waterTarget  || 8;
  if (weightInput) weightInput.value = dietSettings.targetWeight || "";

  if (modal) modal.classList.add("active");
};

window.closeDietSettingsModal = function() {
  document.getElementById("dietSettingsModal")?.classList.remove("active");
};

window.saveDietSettings = function() {
  const calTarget    = parseInt(document.getElementById("inputDailyCalTarget")?.value)  || 2000;
  const waterTarget  = parseInt(document.getElementById("inputDailyWaterTarget")?.value) || 8;
  const targetWeight = parseFloat(document.getElementById("inputTargetWeight")?.value)  || null;

  dietSettings = { calTarget, waterTarget, targetWeight };
  saveDietSettingsData();
  closeDietSettingsModal();
  renderDietPage();
};

// ---- Modal: Add Weight ----
window.openAddWeightModal = function() {
  const modal    = document.getElementById("addWeightModal");
  const kgInput  = document.getElementById("inputWeightKg");
  const dateInput= document.getElementById("inputWeightDate");

  if (kgInput)   kgInput.value   = "";
  if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];
  if (modal) modal.classList.add("active");
};

window.closeAddWeightModal = function() {
  document.getElementById("addWeightModal")?.classList.remove("active");
};

window.saveWeightEntry = function() {
  const kg   = parseFloat(document.getElementById("inputWeightKg")?.value);
  const date = document.getElementById("inputWeightDate")?.value;

  if (!kg || kg <= 0) { showInfoModal("Hata ⚠️", "Geçerli bir kilo giriniz!"); return; }
  if (!date)          { showInfoModal("Hata ⚠️", "Lütfen tarih seçiniz!"); return; }

  weightLogs = weightLogs.filter(e => e.date !== date);
  weightLogs.push({ kg, date });
  weightLogs.sort((a, b) => new Date(a.date) - new Date(b.date));

  saveWeightLogs();
  closeAddWeightModal();
  renderWeightHistory();
};

// 📁 ---- KÜTÜPHANE: Klasöre Taşı Modalı ----
window.moveCurrentPhotoToAlbumPrompt = function() {
  if (!currentViewingPhoto) return;
  openMovePhotoModal(currentViewingPhoto);
};

window.openMovePhotoModal = function(photoObj) {
  currentViewingPhotoForMove = photoObj;
  const modal = document.getElementById("movePhotoModal");
  const listEl = document.getElementById("movePhotoAlbumsList");
  if (!modal || !listEl) return;

  let html = `
    <div class="move-photo-album-item" onclick="movePhotoToAlbum('')">
      <span>🌐 Klasörsüz Yap (Ana Galeri)</span>
      <span>${photoObj.albumId === "" ? '✓' : ''}</span>
    </div>
  `;

  customAlbums.forEach(alb => {
    html += `
      <div class="move-photo-album-item" onclick="movePhotoToAlbum('${alb.id}')">
        <span>📁 ${escapeHtml(alb.title)}</span>
        <span>${photoObj.albumId === alb.id ? '✓' : ''}</span>
      </div>
    `;
  });

  listEl.innerHTML = html;
  modal.classList.add("active");
};

window.closeMovePhotoModal = function() {
  document.getElementById("movePhotoModal")?.classList.remove("active");
};

window.movePhotoToAlbum = function(targetAlbumId) {
  if (!currentViewingPhotoForMove) return;

  const item = standalonePhotos.find(p => p.id === currentViewingPhotoForMove.id);
  if (item) {
    item.albumId = targetAlbumId;
    saveStandalonePhotos();
  }

  closeMovePhotoModal();
  closePhotoViewerModal();
  renderVerticalAlbums();
  showInfoModal("Klasör Değişti 📁", "Fotoğraf başarıyla seçilen klasöre taşındı.");
};

// Close dropdown on outside click
document.addEventListener("click", e => {
  if (!e.target.closest("#foodSearchInput") && !e.target.closest("#foodSearchDropdown")) {
    const dd = document.getElementById("foodSearchDropdown");
    if (dd) dd.style.display = "none";
  }
});






