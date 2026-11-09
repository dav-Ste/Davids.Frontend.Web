(() => {
  "use strict";

  const homePath = "/";

  const banner = document.getElementById("login-banner");
  const oidcBtn = document.getElementById("oidc-login-btn");
  const signupForm = document.getElementById("signup-form");
  const signupEmail = document.getElementById("signup-email");
  const signupPassword = document.getElementById("signup-password");
  const signupMessage = document.getElementById("signup-message");
  const signupSubmit = document.getElementById("signup-submit");

  function setBanner(node, text, isSuccess = false) {
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
    node.classList.toggle("success", isSuccess);
    node.hidden = false;
  }

  function readQueryNotice() {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const reason = params.get("reason");
    if (error === "oidc_failed") {
      setBanner(banner, "Customer Single Sign-On could not be completed. Please try again.");
    } else if (reason === "signed-out") {
      setBanner(banner, "You have been signed out and your customer session tokens were revoked.", true);
    } else if (reason === "expired") {
      setBanner(banner, "Your customer session expired. Please sign in again.");
    }
  }

  async function checkExistingSession() {
    try {
      const response = await fetch("/customer-auth/session", {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      if (response.ok) {
        window.location.replace(homePath);
      }
    } catch {
      // Remain on login page when unauthenticated.
    }
  }

  if (oidcBtn) {
    oidcBtn.addEventListener("click", () => {
      oidcBtn.disabled = true;
      window.location.assign(`/customer-auth/login?returnUrl=${encodeURIComponent(homePath)}`);
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", async event => {
      event.preventDefault();
      const email = signupEmail.value.trim();
      const password = signupPassword.value;
      if (!email || !email.includes("@")) {
        setBanner(signupMessage, "Please enter a valid email address.");
        return;
      }
      if (!password || password.length < 10) {
        setBanner(signupMessage, "Password must be at least 10 characters.");
        return;
      }

      signupSubmit.disabled = true;
      setBanner(signupMessage, "");

      try {
        const response = await fetch("/identity/sign-up", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
          let payload = null;
          try {
            payload = await response.json();
          } catch {
            payload = null;
          }
          setBanner(
            signupMessage,
            payload?.reason || payload?.detail || "Unable to create customer account."
          );
          return;
        }

        signupPassword.value = "";
        setBanner(
          signupMessage,
          "Account created! Click 'Continue with Customer OIDC' above to sign in.",
          true
        );
      } catch {
        setBanner(signupMessage, "Network error while creating your account.");
      } finally {
        signupSubmit.disabled = false;
      }
    });
  }

  readQueryNotice();
  checkExistingSession();
})();
