(() => {
  "use strict";

  const CSRF_HEADER_NAME = "X-Requested-With";
  const CSRF_HEADER_VALUE = "DavidsWeb";
  const onCustomerHost = /^(portal|web|customer)\./i.test(window.location.hostname);
  const loginPath = onCustomerHost ? "/login" : "/portal/login";

  const state = {
    customerId: null,
    email: null,
    activeView: "profile",
    toastTimer: null
  };

  const el = id => document.getElementById(id);

  const dom = {
    navProfile: el("nav-profile"),
    navSecurity: el("nav-security"),
    navActivity: el("nav-activity"),
    breadcrumbTitle: el("breadcrumb-title"),
    userAvatar: el("user-avatar"),
    userName: el("user-name"),
    userRole: el("user-role"),
    logoutButton: el("logout-button"),
    toast: el("toast"),

    profileView: el("profile-view"),
    securityView: el("security-view"),
    activityView: el("activity-view"),

    profileRefresh: el("profile-refresh"),
    profileState: el("profile-state"),
    profileVip: el("profile-vip"),
    profileOrdersCount: el("profile-orders-count"),
    profileEmail: el("profile-email"),
    profileCreated: el("profile-created"),
    profileForm: el("profile-form"),
    profileFullName: el("profile-full-name"),
    profileAddress: el("profile-address"),
    profileMessage: el("profile-message"),
    profileSubmit: el("profile-submit"),

    emailForm: el("email-form"),
    newEmailInput: el("new-email-input"),
    emailCurrentPassword: el("email-current-password"),
    emailMessage: el("email-message"),
    emailSubmit: el("email-submit"),

    passwordForm: el("password-form"),
    currentPasswordInput: el("current-password-input"),
    newPasswordInput: el("new-password-input"),
    passwordMessage: el("password-message"),
    passwordSubmit: el("password-submit"),

    activityRefresh: el("activity-refresh"),
    myChangesTbody: el("my-changes-tbody"),
    myLoginsTbody: el("my-logins-tbody")
  };

  function showMessage(node, text, kind = "error") {
    if (!node) {
      return;
    }
    if (!text) {
      node.hidden = true;
      node.textContent = "";
      node.classList.remove("success");
      return;
    }
    node.textContent = text;
    node.classList.toggle("success", kind === "success");
    node.hidden = false;
  }

  function showToast(text) {
    if (!dom.toast || !text) {
      return;
    }
    if (state.toastTimer) {
      clearTimeout(state.toastTimer);
    }
    dom.toast.textContent = text;
    dom.toast.hidden = false;
    state.toastTimer = window.setTimeout(() => {
      dom.toast.hidden = true;
    }, 3200);
  }

  function redirectToLogin(reason) {
    const url = reason ? `${loginPath}?reason=${encodeURIComponent(reason)}` : loginPath;
    window.location.replace(url);
  }

  async function apiRequest(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    headers.set(CSRF_HEADER_NAME, CSRF_HEADER_VALUE);

    if (options.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(path, {
      method: options.method || "GET",
      credentials: "same-origin",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });

    let data = null;
    const contentType = response.headers.get("content-type") || "";
    if (response.status !== 204 && contentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    }

    return { ok: response.ok, status: response.status, data };
  }

  function formatDateTime(value) {
    if (!value) {
      return "—";
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
  }

  function switchView(view) {
    state.activeView = view;
    dom.profileView.hidden = view !== "profile";
    dom.securityView.hidden = view !== "security";
    dom.activityView.hidden = view !== "activity";

    dom.navProfile.classList.toggle("active", view === "profile");
    dom.navSecurity.classList.toggle("active", view === "security");
    dom.navActivity.classList.toggle("active", view === "activity");

    dom.breadcrumbTitle.textContent = view === "security"
      ? "Sign-In & Security"
      : view === "activity"
        ? "Account Activity"
        : "My Profile";
  }

  async function loadMyProfile() {
    const resp = await apiRequest("/customers/me");
    if (resp.status === 401) {
      redirectToLogin("expired");
      return;
    }
    if (!resp.ok || !resp.data) {
      showMessage(dom.profileMessage, resp.data?.reason || "Customer profile is still initializing.");
      return;
    }

    const p = resp.data;
    const standing = String(p.state || p.State || "incomplete");
    const isVip = Boolean(p.isVip ?? p.IsVip);
    const orders = Array.isArray(p.completedOrders || p.CompletedOrders) ? (p.completedOrders || p.CompletedOrders) : [];
    dom.profileState.textContent = standing;
    dom.profileVip.textContent = isVip ? "VIP tier active" : "Standard tier";
    dom.profileOrdersCount.textContent = String(orders.length);
    dom.profileEmail.textContent = String(p.email || p.Email || state.email || "—");
    dom.profileCreated.textContent = `Since ${formatDateTime(p.createdAt || p.CreatedAt)}`;
    dom.profileFullName.value = String(p.fullName || p.FullName || "");
    dom.profileAddress.value = String(p.address || p.Address || "");
  }

  async function handleSaveProfile(event) {
    event.preventDefault();
    const fullName = dom.profileFullName.value.trim();
    const address = dom.profileAddress.value.trim();
    if (!fullName || !address) {
      showMessage(dom.profileMessage, "Both full name and delivery address are required.");
      return;
    }

    dom.profileSubmit.disabled = true;
    showMessage(dom.profileMessage, "");
    try {
      const resp = await apiRequest("/customers/me", {
        method: "PUT",
        body: { fullName, address }
      });
      if (resp.status === 401) {
        redirectToLogin("expired");
        return;
      }
      if (!resp.ok) {
        showMessage(dom.profileMessage, resp.data?.reason || "Unable to save profile.");
        return;
      }
      await loadMyProfile();
      showMessage(dom.profileMessage, "Your delivery profile has been updated.", "success");
      showToast("Profile saved.");
    } catch {
      showMessage(dom.profileMessage, "Network error while saving profile.");
    } finally {
      dom.profileSubmit.disabled = false;
    }
  }

  async function handleUpdateEmail(event) {
    event.preventDefault();
    const newEmail = dom.newEmailInput.value.trim();
    const currentPassword = dom.emailCurrentPassword.value;
    if (!newEmail || !newEmail.includes("@") || !currentPassword) {
      showMessage(dom.emailMessage, "Enter your new email address and current password.");
      return;
    }

    dom.emailSubmit.disabled = true;
    showMessage(dom.emailMessage, "");
    try {
      const resp = await apiRequest("/identity/me/email", {
        method: "PUT",
        body: { newEmail, currentPassword }
      });
      if (!resp.ok) {
        showMessage(dom.emailMessage, resp.data?.reason || "Could not update email address.");
        return;
      }
      state.email = newEmail;
      dom.userName.textContent = newEmail;
      dom.emailCurrentPassword.value = "";
      showMessage(dom.emailMessage, "Sign-in email updated and queued for profile synchronization.", "success");
      showToast("Sign-in email updated.");
    } catch {
      showMessage(dom.emailMessage, "Network error while updating email.");
    } finally {
      dom.emailSubmit.disabled = false;
    }
  }

  async function handleRotatePassword(event) {
    event.preventDefault();
    const currentPassword = dom.currentPasswordInput.value;
    const newPassword = dom.newPasswordInput.value;
    if (!currentPassword || !newPassword || newPassword.length < 10) {
      showMessage(dom.passwordMessage, "Enter your current password and a new password of at least 10 characters.");
      return;
    }

    dom.passwordSubmit.disabled = true;
    showMessage(dom.passwordMessage, "");
    try {
      const resp = await apiRequest("/identity/me/password", {
        method: "PUT",
        body: { currentPassword, newPassword }
      });
      if (!resp.ok) {
        showMessage(dom.passwordMessage, resp.data?.reason || "Could not rotate password.");
        return;
      }
      dom.currentPasswordInput.value = "";
      dom.newPasswordInput.value = "";
      showMessage(dom.passwordMessage, "Password rotated and prior sessions revoked. Redirecting to sign in…", "success");
      window.setTimeout(() => handleSignOut(), 900);
    } catch {
      showMessage(dom.passwordMessage, "Network error while rotating password.");
    } finally {
      dom.passwordSubmit.disabled = false;
    }
  }

  async function loadMyActivity() {
    const requests = [
      apiRequest("/identity/me/login-audits?limit=25"),
      apiRequest("/identity/me/change-audits?limit=25")
    ];
    if (state.customerId) {
      requests.push(apiRequest(`/customers/${encodeURIComponent(state.customerId)}/change-audits?limit=25`));
    }

    const [loginsResp, idChangesResp, profileChangesResp] = await Promise.all(requests);
    dom.myChangesTbody.replaceChildren();
    dom.myLoginsTbody.replaceChildren();

    const mergedChanges = [];
    if (idChangesResp?.ok && Array.isArray(idChangesResp.data)) {
      for (const c of idChangesResp.data) {
        mergedChanges.push({ source: "identity", raw: c });
      }
    }
    if (profileChangesResp?.ok && Array.isArray(profileChangesResp.data)) {
      for (const c of profileChangesResp.data) {
        mergedChanges.push({ source: "profile", raw: c });
      }
    }
    mergedChanges.sort(
      (a, b) => new Date(b.raw.occurredAtUtc || 0).getTime() - new Date(a.raw.occurredAtUtc || 0).getTime()
    );

    if (!mergedChanges.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.className = "table-empty";
      td.textContent = "No profile or credential changes recorded yet.";
      tr.appendChild(td);
      dom.myChangesTbody.appendChild(tr);
    } else {
      for (const item of mergedChanges) {
        const r = item.raw;
        const tr = document.createElement("tr");
        const cells = [
          formatDateTime(r.occurredAtUtc),
          item.source,
          String(r.action || "").replace(/_/g, " "),
          `${r.actorAuthority || "customer"} (${r.actorRole || "user"})`,
          (Array.isArray(r.changes) ? r.changes : [])
            .map(ch => `${ch.field}: ${ch.oldValue ?? "∅"} → ${ch.newValue ?? "∅"}`)
            .join("; ")
        ];
        for (const text of cells) {
          const td = document.createElement("td");
          td.textContent = text;
          tr.appendChild(td);
        }
        dom.myChangesTbody.appendChild(tr);
      }
    }

    const logins = loginsResp?.ok && Array.isArray(loginsResp.data) ? loginsResp.data : [];
    if (!logins.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.className = "table-empty";
      td.textContent = "No sign-in attempts recorded yet.";
      tr.appendChild(td);
      dom.myLoginsTbody.appendChild(tr);
    } else {
      for (const entry of logins) {
        const tr = document.createElement("tr");
        for (const text of [
          formatDateTime(entry.occurredAtUtc),
          String(entry.outcome || (entry.succeeded ? "succeeded" : "failed")),
          String(entry.clientIpAddress || "unknown"),
          String(entry.correlationId || "—").slice(0, 16)
        ]) {
          const td = document.createElement("td");
          td.textContent = text;
          tr.appendChild(td);
        }
        dom.myLoginsTbody.appendChild(tr);
      }
    }
  }

  async function handleSignOut() {
    await fetch("/customer-auth/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: { [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE }
    }).catch(() => null);

    redirectToLogin("signed-out");
  }

  async function bootstrapCustomerSession() {
    try {
      const me = await apiRequest("/identity/me");
      if (!me.ok || !me.data || String(me.data.role || "").toLowerCase() !== "user") {
        redirectToLogin("expired");
        return;
      }

      state.customerId = String(me.data.id || "");
      state.email = String(me.data.email || "Customer");
      dom.userName.textContent = state.email;
      dom.userRole.textContent = "Customer";
      dom.userAvatar.textContent = state.email.trim().charAt(0).toUpperCase() || "C";
      if (dom.newEmailInput) {
        dom.newEmailInput.value = state.email;
      }

      await loadMyProfile();
    } catch {
      redirectToLogin("expired");
    }
  }

  dom.navProfile.addEventListener("click", () => {
    switchView("profile");
    loadMyProfile();
  });
  dom.navSecurity.addEventListener("click", () => switchView("security"));
  dom.navActivity.addEventListener("click", () => {
    switchView("activity");
    loadMyActivity();
  });
  dom.profileRefresh.addEventListener("click", () => loadMyProfile());
  dom.activityRefresh.addEventListener("click", () => loadMyActivity());
  dom.profileForm.addEventListener("submit", handleSaveProfile);
  dom.emailForm.addEventListener("submit", handleUpdateEmail);
  dom.passwordForm.addEventListener("submit", handleRotatePassword);
  dom.logoutButton.addEventListener("click", handleSignOut);

  bootstrapCustomerSession();
})();
