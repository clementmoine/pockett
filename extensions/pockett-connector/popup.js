const originInput = document.getElementById("origin");
const statusEl = document.getElementById("status");

async function refresh() {
  const res = await chrome.runtime.sendMessage({ type: "pockett.getStatus" });
  originInput.value = res?.origin || "http://localhost:3000";
  if (res?.capture) {
    statusEl.innerHTML = `Capture en cours : <strong>${res.capture.providerId}</strong> — scan des onglets Klarna…`;
  } else {
    statusEl.innerHTML =
      'Prêt — ouvre Pockett → Comptes liés.';
  }
}

document.getElementById("save").addEventListener("click", async () => {
  const origin = originInput.value.trim().replace(/\/$/, "");
  const res = await chrome.runtime.sendMessage({
    type: "pockett.setOrigin",
    origin,
  });
  statusEl.innerHTML = res?.ok
    ? `<span class="ok">Enregistré :</span> ${origin}`
    : `<span class="bad">Erreur</span>`;
});

document.getElementById("open").addEventListener("click", async () => {
  const origin =
    originInput.value.trim().replace(/\/$/, "") || "http://localhost:3000";
  await chrome.tabs.create({ url: origin + "/?connections=1" });
});

const scanBtn = document.getElementById("scan");
if (scanBtn) {
  scanBtn.addEventListener("click", async () => {
    statusEl.textContent = "Scan…";
    const res = await chrome.runtime.sendMessage({ type: "pockett.scanNow" });
    if (res?.ok) {
      statusEl.innerHTML = '<span class="ok">Token envoyé à Pockett</span>';
    } else {
      statusEl.innerHTML = `<span class="bad">${res?.reason || res?.error || "Pas encore de token"}</span>`;
    }
    setTimeout(refresh, 800);
  });
}

refresh();
