(() => {
  "use strict";

  const CSRF_HEADER_NAME = "X-Requested-With";
  const CSRF_HEADER_VALUE = "DavidsWeb";
  const loginPath = "/login";

  const state = {
    customerId: null,
    email: null,
    activeView: "store",
    basketItems: [],
    toastTimer: null,
    ordersPollTimer: null,
    searchDebounce: null
  };

  const el = id => document.getElementById(id);

  const dom = {
    navStore: el("nav-store"),
    navBasket: el("nav-basket"),
    navBasketCount: el("nav-basket-count"),
    topbarBasketBtn: el("topbar-basket-btn"),
    topbarBasketCount: el("topbar-basket-count"),
    navOrders: el("nav-orders"),
    navOrdersCount: el("nav-orders-count"),
    navProfile: el("nav-profile"),
    navSecurity: el("nav-security"),
    navActivity: el("nav-activity"),
    breadcrumbTitle: el("breadcrumb-title"),
    userAvatar: el("user-avatar"),
    userName: el("user-name"),
    userRole: el("user-role"),
    logoutButton: el("logout-button"),
    toast: el("toast"),

    storeView: el("store-view"),
    basketView: el("basket-view"),
    ordersView: el("orders-view"),
    profileView: el("profile-view"),
    securityView: el("security-view"),
    activityView: el("activity-view"),

    storeRefresh: el("store-refresh"),
    storeSearch: el("store-search"),
    storeCategory: el("store-category"),
    storeMessage: el("store-message"),
    productGrid: el("product-grid"),

    basketClear: el("basket-clear"),
    basketRefresh: el("basket-refresh"),
    basketSubtotal: el("basket-subtotal"),
    basketTbody: el("basket-tbody"),
    checkoutForm: el("checkout-form"),
    checkoutFullName: el("checkout-full-name"),
    checkoutAddress: el("checkout-address"),
    checkoutPaymentMethod: el("checkout-payment-method"),
    checkoutCardLast4: el("checkout-card-last4"),
    checkoutMessage: el("checkout-message"),
    checkoutSubmit: el("checkout-submit"),

    ordersRefresh: el("orders-refresh"),
    ordersPollIndicator: el("orders-poll-indicator"),
    ordersTbody: el("orders-tbody"),
    paymentsTbody: el("payments-tbody"),

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

  function formatMoney(amount, currency = "GBP") {
    const num = Number(amount || 0);
    return `${currency} ${num.toFixed(2)}`;
  }

  function stopOrdersPolling() {
    if (state.ordersPollTimer) {
      clearInterval(state.ordersPollTimer);
      state.ordersPollTimer = null;
    }
    if (dom.ordersPollIndicator) {
      dom.ordersPollIndicator.textContent = "";
    }
  }

  function switchView(view) {
    state.activeView = view;
    if (view !== "orders") {
      stopOrdersPolling();
    }

    dom.storeView.hidden = view !== "store";
    dom.basketView.hidden = view !== "basket";
    dom.ordersView.hidden = view !== "orders";
    dom.profileView.hidden = view !== "profile";
    dom.securityView.hidden = view !== "security";
    dom.activityView.hidden = view !== "activity";

    dom.navStore.classList.toggle("active", view === "store");
    dom.navBasket.classList.toggle("active", view === "basket");
    dom.navOrders.classList.toggle("active", view === "orders");
    dom.navProfile.classList.toggle("active", view === "profile");
    dom.navSecurity.classList.toggle("active", view === "security");
    dom.navActivity.classList.toggle("active", view === "activity");

    const titles = {
      store: "Product Storefront",
      basket: "Shopping Basket & Checkout",
      orders: "My Orders & Payments",
      profile: "My Profile",
      security: "Sign-In & Security",
      activity: "Account Activity"
    };
    dom.breadcrumbTitle.textContent = titles[view] || "Customer Portal";
  }

  async function loadStorefront() {
    const params = new URLSearchParams();
    const search = dom.storeSearch.value.trim();
    const category = dom.storeCategory.value.trim();
    if (search) {
      params.set("search", search);
    }
    if (category) {
      params.set("category", category);
    }

    const query = params.toString();
    const resp = await apiRequest(query ? `/products?${query}` : "/products");
    dom.productGrid.replaceChildren();

    if (!resp.ok || !Array.isArray(resp.data)) {
      showMessage(dom.storeMessage, resp.data?.reason || "Unable to load product catalog.");
      return;
    }
    showMessage(dom.storeMessage, "");

    if (resp.data.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-card";
      const h2 = document.createElement("h2");
      h2.textContent = "No matching products";
      const p = document.createElement("p");
      p.textContent = "Try clearing your search or selecting another category.";
      empty.append(h2, p);
      dom.productGrid.appendChild(empty);
      return;
    }

    for (const prod of resp.data) {
      const card = document.createElement("article");
      card.className = "product-card";

      const top = document.createElement("div");
      const head = document.createElement("div");
      head.className = "product-card-head";
      const cat = document.createElement("span");
      cat.className = "product-category";
      cat.textContent = String(prod.category || "Catalog");
      const sku = document.createElement("span");
      sku.className = "product-sku";
      sku.textContent = String(prod.sku || "");
      head.append(cat, sku);

      const title = document.createElement("h2");
      title.className = "product-title";
      title.textContent = String(prod.name || "");
      const desc = document.createElement("p");
      desc.className = "product-desc";
      desc.textContent = String(prod.description || "");
      top.append(head, title, desc);

      const footer = document.createElement("div");
      footer.className = "product-footer";
      const priceCol = document.createElement("div");
      const price = document.createElement("strong");
      price.className = "product-price";
      price.textContent = formatMoney(prod.price, prod.currency || "GBP");
      const stock = document.createElement("span");
      const inStock = Number(prod.stockQuantity || 0);
      stock.className = inStock > 0 ? "product-stock" : "product-stock out";
      stock.textContent = inStock > 0 ? `In stock: ${inStock}` : "Out of stock";
      priceCol.append(price, stock);

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "button button-primary";
      addBtn.disabled = inStock <= 0;
      addBtn.textContent = inStock > 0 ? "Add to basket" : "Sold out";
      addBtn.addEventListener("click", () => addProductToBasket(prod.id, prod.name));

      footer.append(priceCol, addBtn);
      card.append(top, footer);
      dom.productGrid.appendChild(card);
    }
  }

  function updateBasketCounters(totalItems) {
    const text = String(totalItems || 0);
    dom.navBasketCount.textContent = text;
    dom.topbarBasketCount.textContent = text;
  }

  function renderBasket(basket) {
    const items = Array.isArray(basket?.items) ? basket.items : [];
    state.basketItems = items;
    updateBasketCounters(basket?.totalItems || 0);
    dom.basketSubtotal.textContent = formatMoney(basket?.subtotal || 0, basket?.currency || "GBP");
    dom.basketTbody.replaceChildren();
    dom.checkoutSubmit.disabled = items.length === 0;

    if (items.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.className = "table-empty";
      td.textContent = "Your shopping basket is empty. Add items from the Product Storefront.";
      tr.appendChild(td);
      dom.basketTbody.appendChild(tr);
      return;
    }

    for (const item of items) {
      const tr = document.createElement("tr");

      const prodTd = document.createElement("td");
      const strong = document.createElement("strong");
      strong.textContent = String(item.productName || "");
      const skuSmall = document.createElement("small");
      skuSmall.className = "audit-reason";
      skuSmall.textContent = String(item.sku || "");
      prodTd.append(strong, skuSmall);

      const unitTd = document.createElement("td");
      unitTd.textContent = formatMoney(item.unitPrice, item.currency || "GBP");

      const qtyTd = document.createElement("td");
      const controls = document.createElement("div");
      controls.className = "qty-controls";
      const minus = document.createElement("button");
      minus.type = "button";
      minus.className = "qty-btn";
      minus.textContent = "−";
      minus.addEventListener("click", () => setBasketItemQuantity(item.productId, Number(item.quantity) - 1));
      const qtyText = document.createElement("span");
      qtyText.textContent = String(item.quantity);
      const plus = document.createElement("button");
      plus.type = "button";
      plus.className = "qty-btn";
      plus.textContent = "+";
      plus.addEventListener("click", () => setBasketItemQuantity(item.productId, Number(item.quantity) + 1));
      controls.append(minus, qtyText, plus);
      qtyTd.appendChild(controls);

      const lineTd = document.createElement("td");
      lineTd.textContent = formatMoney(item.lineTotal, item.currency || "GBP");

      const actionTd = document.createElement("td");
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "button button-quiet";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => removeBasketItem(item.productId));
      actionTd.appendChild(removeBtn);

      tr.append(prodTd, unitTd, qtyTd, lineTd, actionTd);
      dom.basketTbody.appendChild(tr);
    }
  }

  async function loadMyBasket() {
    const resp = await apiRequest("/baskets/me");
    if (resp.status === 401) {
      redirectToLogin("expired");
      return;
    }
    if (resp.ok && resp.data) {
      renderBasket(resp.data);
    }
  }

  async function addProductToBasket(productId, productName) {
    const existing = state.basketItems.find(x => String(x.productId) === String(productId));
    const nextQty = existing ? Number(existing.quantity) + 1 : 1;
    const resp = await apiRequest("/baskets/me/items", {
      method: "PUT",
      body: { productId, quantity: nextQty }
    });
    if (resp.status === 401) {
      redirectToLogin("expired");
      return;
    }
    if (!resp.ok) {
      showToast(resp.data?.reason || "Could not add product to basket.");
      return;
    }
    renderBasket(resp.data);
    showToast(`Added ${productName} to basket.`);
  }

  async function setBasketItemQuantity(productId, quantity) {
    if (quantity <= 0) {
      await removeBasketItem(productId);
      return;
    }
    const resp = await apiRequest("/baskets/me/items", {
      method: "PUT",
      body: { productId, quantity }
    });
    if (resp.ok && resp.data) {
      renderBasket(resp.data);
    } else {
      showToast(resp.data?.reason || "Unable to update quantity.");
    }
  }

  async function removeBasketItem(productId) {
    const resp = await apiRequest(`/baskets/me/items/${encodeURIComponent(productId)}`, {
      method: "DELETE"
    });
    if (resp.ok && resp.data) {
      renderBasket(resp.data);
      showToast("Item removed from basket.");
    }
  }

  async function clearMyBasket() {
    const resp = await apiRequest("/baskets/me", { method: "DELETE" });
    if (resp.ok) {
      renderBasket({ items: [], totalItems: 0, subtotal: 0, currency: "GBP" });
      showToast("Shopping basket cleared.");
    }
  }

  async function handleCheckout(event) {
    event.preventDefault();
    const shippingFullName = dom.checkoutFullName.value.trim();
    const shippingAddress = dom.checkoutAddress.value.trim();
    const paymentMethod = dom.checkoutPaymentMethod.value;
    const cardLast4 = dom.checkoutCardLast4.value.trim();

    if (!shippingFullName || !shippingAddress || !/^[0-9]{4}$/.test(cardLast4)) {
      showMessage(dom.checkoutMessage, "Enter recipient name, shipping address, and 4 numeric card digits.");
      return;
    }

    dom.checkoutSubmit.disabled = true;
    showMessage(dom.checkoutMessage, "");
    try {
      const resp = await apiRequest("/orders/checkout", {
        method: "POST",
        body: { shippingFullName, shippingAddress, paymentMethod, cardLast4 }
      });
      if (resp.status === 401) {
        redirectToLogin("expired");
        return;
      }
      if (!resp.ok) {
        showMessage(dom.checkoutMessage, resp.data?.reason || "Checkout could not be completed.");
        return;
      }

      renderBasket({ items: [], totalItems: 0, subtotal: 0, currency: "GBP" });
      showToast("Order placed! Processing payment via RabbitMQ…");
      switchView("orders");
      await loadMyOrdersAndPayments();
      await loadStorefront();
    } catch {
      showMessage(dom.checkoutMessage, "Network error during checkout.");
    } finally {
      dom.checkoutSubmit.disabled = state.basketItems.length === 0;
    }
  }

  async function cancelPendingOrder(orderId) {
    const resp = await apiRequest(`/orders/me/${encodeURIComponent(orderId)}/cancel`, { method: "POST" });
    if (resp.ok) {
      showToast("Order cancelled.");
      await loadMyOrdersAndPayments();
    } else {
      showToast(resp.data?.reason || "Order can no longer be cancelled.");
    }
  }

  async function loadMyOrdersAndPayments() {
    const [ordersResp, paymentsResp] = await Promise.all([
      apiRequest("/orders/me?limit=50"),
      apiRequest("/payments/me?limit=50")
    ]);

    const orders = ordersResp.ok && Array.isArray(ordersResp.data) ? ordersResp.data : [];
    const payments = paymentsResp.ok && Array.isArray(paymentsResp.data) ? paymentsResp.data : [];
    dom.navOrdersCount.textContent = String(orders.length);

    dom.ordersTbody.replaceChildren();
    if (orders.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 7;
      td.className = "table-empty";
      td.textContent = "You have not placed any orders yet.";
      tr.appendChild(td);
      dom.ordersTbody.appendChild(tr);
    } else {
      for (const ord of orders) {
        const tr = document.createElement("tr");
        const idTd = document.createElement("td");
        idTd.textContent = String(ord.id || "").slice(0, 8).toUpperCase();
        const dateTd = document.createElement("td");
        dateTd.textContent = formatDateTime(ord.createdAt);
        const countTd = document.createElement("td");
        countTd.textContent = `${ord.itemCount || 0} items`;
        const totalTd = document.createElement("td");
        totalTd.textContent = formatMoney(ord.totalAmount, ord.currency || "GBP");

        const statusTd = document.createElement("td");
        const chip = document.createElement("span");
        const statusStr = String(ord.status || "pending_payment");
        chip.className = `status-chip ${statusStr}`;
        chip.textContent = statusStr.replace(/_/g, " ");
        statusTd.appendChild(chip);

        const refTd = document.createElement("td");
        refTd.textContent = ord.paymentReference || ord.failureReason || "Awaiting capture…";

        const actTd = document.createElement("td");
        if (statusStr === "pending_payment") {
          const cancelBtn = document.createElement("button");
          cancelBtn.type = "button";
          cancelBtn.className = "button button-quiet";
          cancelBtn.textContent = "Cancel";
          cancelBtn.addEventListener("click", () => cancelPendingOrder(ord.id));
          actTd.appendChild(cancelBtn);
        } else {
          actTd.textContent = "—";
        }

        tr.append(idTd, dateTd, countTd, totalTd, statusTd, refTd, actTd);
        dom.ordersTbody.appendChild(tr);
      }
    }

    dom.paymentsTbody.replaceChildren();
    if (payments.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
      td.className = "table-empty";
      td.textContent = "No payment receipts recorded yet.";
      tr.appendChild(td);
      dom.paymentsTbody.appendChild(tr);
    } else {
      for (const pay of payments) {
        const tr = document.createElement("tr");
        const dtTd = document.createElement("td");
        dtTd.textContent = formatDateTime(pay.createdAt);
        const refTd = document.createElement("td");
        refTd.textContent = String(pay.providerReference || "—");
        const methTd = document.createElement("td");
        methTd.textContent = `${pay.paymentMethod || "card"} •••• ${pay.cardLast4 || "4242"}`;
        const amtTd = document.createElement("td");
        amtTd.textContent = formatMoney(pay.amount, pay.currency || "GBP");
        const stTd = document.createElement("td");
        const stChip = document.createElement("span");
        const pStatus = String(pay.status || "captured");
        stChip.className = `status-chip ${pStatus}`;
        stChip.textContent = pStatus;
        stTd.appendChild(stChip);
        const noteTd = document.createElement("td");
        noteTd.textContent = String(pay.failureReason || "Captured via RabbitMQ saga");
        tr.append(dtTd, refTd, methTd, amtTd, stTd, noteTd);
        dom.paymentsTbody.appendChild(tr);
      }
    }

    const hasPending = orders.some(o => o.status === "pending_payment");
    if (hasPending && state.activeView === "orders") {
      dom.ordersPollIndicator.textContent = "Live polling payment capture…";
      if (!state.ordersPollTimer) {
        state.ordersPollTimer = window.setInterval(async () => {
          await loadMyOrdersAndPayments();
          await loadMyProfile();
        }, 1500);
      }
    } else {
      stopOrdersPolling();
    }
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
    const fullName = String(p.fullName || p.FullName || "");
    const address = String(p.address || p.Address || "");

    dom.profileState.textContent = standing;
    dom.profileVip.textContent = isVip ? "VIP tier active" : "Standard tier";
    dom.profileOrdersCount.textContent = String(orders.length);
    dom.profileEmail.textContent = String(p.email || p.Email || state.email || "—");
    dom.profileCreated.textContent = `Since ${formatDateTime(p.createdAt || p.CreatedAt)}`;
    dom.profileFullName.value = fullName;
    dom.profileAddress.value = address;
    if (!dom.checkoutFullName.value && fullName) {
      dom.checkoutFullName.value = fullName;
    }
    if (!dom.checkoutAddress.value && address) {
      dom.checkoutAddress.value = address;
    }
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
      dom.checkoutFullName.value = fullName;
      dom.checkoutAddress.value = address;
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
    stopOrdersPolling();
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

      await Promise.all([
        loadStorefront(),
        loadMyBasket(),
        loadMyProfile(),
        loadMyOrdersAndPayments()
      ]);
    } catch {
      redirectToLogin("expired");
    }
  }

  dom.navStore.addEventListener("click", () => {
    switchView("store");
    loadStorefront();
  });
  dom.navBasket.addEventListener("click", () => {
    switchView("basket");
    loadMyBasket();
  });
  dom.topbarBasketBtn.addEventListener("click", () => {
    switchView("basket");
    loadMyBasket();
  });
  dom.navOrders.addEventListener("click", () => {
    switchView("orders");
    loadMyOrdersAndPayments();
  });
  dom.navProfile.addEventListener("click", () => {
    switchView("profile");
    loadMyProfile();
  });
  dom.navSecurity.addEventListener("click", () => switchView("security"));
  dom.navActivity.addEventListener("click", () => {
    switchView("activity");
    loadMyActivity();
  });

  dom.storeRefresh.addEventListener("click", () => loadStorefront());
  dom.storeCategory.addEventListener("change", () => loadStorefront());
  dom.storeSearch.addEventListener("input", () => {
    if (state.searchDebounce) {
      clearTimeout(state.searchDebounce);
    }
    state.searchDebounce = window.setTimeout(() => loadStorefront(), 220);
  });

  dom.basketRefresh.addEventListener("click", () => loadMyBasket());
  dom.basketClear.addEventListener("click", () => clearMyBasket());
  dom.checkoutForm.addEventListener("submit", handleCheckout);
  dom.ordersRefresh.addEventListener("click", () => loadMyOrdersAndPayments());

  dom.profileRefresh.addEventListener("click", () => loadMyProfile());
  dom.activityRefresh.addEventListener("click", () => loadMyActivity());
  dom.profileForm.addEventListener("submit", handleSaveProfile);
  dom.emailForm.addEventListener("submit", handleUpdateEmail);
  dom.passwordForm.addEventListener("submit", handleRotatePassword);
  dom.logoutButton.addEventListener("click", handleSignOut);

  bootstrapCustomerSession();
})();
