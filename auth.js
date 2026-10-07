/* =========================================================
   auth.js  -  shared by login.html and index.html
   ---------------------------------------------------------
   MODE 1 (Firebase): fill in AUTH_CONFIG.firebase below.
     Then create your users in Firebase Console ->
     Authentication -> Sign-in method -> Email/Password -> Users.
   MODE 2 (Demo): leave firebase keys empty. Login works with the
     demo account below. Demo mode is NOT secure (credentials sit in
     this file), use it only to preview the screens.
   ========================================================= */
const AUTH_CONFIG = {
  firebase: { apiKey: '', authDomain: '', projectId: '', appId: '' },
  demo: { email: 'admin@example.com', password: 'admin123' },
  loginPage: 'login.html',
  homePage: 'index.html'
};

const Auth = (() => {
  const useFirebase = !!(AUTH_CONFIG.firebase.apiKey && AUTH_CONFIG.firebase.projectId);
  const KEY = 'bc_session';
  let fb = null, dbPromise = null;

  const loadScript = src => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src));
    document.head.appendChild(s);
  });

  async function initFirebase() {
    if (fb) return fb;
    const v = '10.12.2';
    await loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-app-compat.js`);
    await loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-auth-compat.js`);
    if (!firebase.apps.length) firebase.initializeApp(AUTH_CONFIG.firebase);
    fb = firebase.auth();
    return fb;
  }

  const readDemo = () => {
    try { return JSON.parse(sessionStorage.getItem(KEY) || localStorage.getItem(KEY)); } catch (e) { return null; }
  };

  const friendly = e => {
    const m = {
      'auth/invalid-email': 'That email address does not look right.',
      'auth/invalid-credential': 'Incorrect email or password.',
      'auth/wrong-password': 'Incorrect email or password.',
      'auth/user-not-found': 'Incorrect email or password.',
      'auth/user-disabled': 'This account has been disabled. Contact the administrator.',
      'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
      'auth/network-request-failed': 'No connection. Check your internet and try again.'
    };
    return m[e && e.code] || (e && e.message) || 'Something went wrong. Please try again.';
  };

  return {
    useFirebase,

    /* Resolves to { email } if signed in, otherwise null */
    async current() {
      if (!useFirebase) return readDemo();
      const a = await initFirebase();
      return new Promise(res => { const off = a.onAuthStateChanged(u => { off(); res(u ? { email: u.email } : null); }); });
    },

    /* Firestore handle (null in demo mode). Waits for the SDK + offline cache. */
    async db() {
      if (!useFirebase) return null;
      await initFirebase();
      if (!dbPromise) dbPromise = (async () => {
        await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js');
        const d = firebase.firestore();
        try { await d.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* cache unavailable: still works online */ }
        return d;
      })();
      return dbPromise;
    },

    async signIn(email, password, remember) {
      try {
        if (!useFirebase) {
          await new Promise(r => setTimeout(r, 400));
          if (email.toLowerCase() !== AUTH_CONFIG.demo.email.toLowerCase() || password !== AUTH_CONFIG.demo.password)
            throw { code: 'auth/invalid-credential' };
          localStorage.removeItem(KEY); sessionStorage.removeItem(KEY);
          (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify({ email }));
          return { email };
        }
        const a = await initFirebase();
        await a.setPersistence(remember ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION);
        const c = await a.signInWithEmailAndPassword(email, password);
        return { email: c.user.email };
      } catch (e) { throw new Error(friendly(e)); }
    },

    async resetPassword(email) {
      if (!useFirebase) return 'Demo mode: password reset is available once Firebase is connected.';
      try { const a = await initFirebase(); await a.sendPasswordResetEmail(email); return 'Reset link sent. Check your inbox (and spam folder).'; }
      catch (e) { throw new Error(friendly(e)); }
    },

    async signOut() {
      localStorage.removeItem(KEY); sessionStorage.removeItem(KEY);
      if (useFirebase) { try { await (await initFirebase()).signOut(); } catch (e) {} }
      location.replace(AUTH_CONFIG.loginPage);
    },

    /* Call on protected pages. Redirects to login if nobody is signed in. */
    async guard() {
      let u = null;
      try { u = await this.current(); } catch (e) {}
      if (!u) { location.replace(AUTH_CONFIG.loginPage); return null; }
      document.documentElement.classList.remove('auth-wait');
      return u;
    }
  };
})();
