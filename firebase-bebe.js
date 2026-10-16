// ===================================================================
// ベーベー福の神ワーク — ログインとデータ保存（Firebase）
//   ・Googleでログインする
//   ・データは bebeFuku/{その人のID}/people/{登録者のID} に入る
//   ・自分のぶんだけ読み書きできる。のりぴさん(管理者)だけ全員ぶんを読める
// ===================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getFirestore, collection, collectionGroup, doc,
  getDocs, writeBatch
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// MetaQ占いアプリと同じFirebaseプロジェクトを使う（置き場所だけ分けている）
const firebaseConfig = {
  apiKey: "AIzaSyCkc0uLgQjUKckjU2uFyLIjPhmKmzGhQGs",
  authDomain: "metaq-uranai.firebaseapp.com",
  projectId: "metaq-uranai",
  storageBucket: "metaq-uranai.firebasestorage.app",
  messagingSenderId: "867275409373",
  appId: "1:867275409373:web:72838f92c2c9fac18ad834"
};

const ADMIN_EMAIL = "orn.pomme@gmail.com"; // 全員ぶんを見られる人
const ROOT = "bebeFuku";                   // この アプリ専用の置き場所

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let readyCb = null;
let readyFired = false;

function peopleCol(uid) { return collection(db, ROOT, uid, "people"); }
function personDoc(uid, id) { return doc(db, ROOT, uid, "people", id); }

function fire() {
  readyFired = true;
  if (readyCb) readyCb(currentUser);
}

onAuthStateChanged(auth, function (user) {
  currentUser = user || null;
  fire();
});

// スマホでポップアップが閉じられた場合などの戻り
getRedirectResult(auth).catch(function () { /* 戻りがないときは何もしない */ });

const BebeDB = {
  get user() { return currentUser; },
  get isAdmin() {
    return !!currentUser && currentUser.email === ADMIN_EMAIL;
  },
  get adminEmail() { return ADMIN_EMAIL; },

  onReady: function (cb) {
    readyCb = cb;
    if (readyFired) cb(currentUser);
  },

  login: function () {
    return signInWithPopup(auth, provider).catch(function (e) {
      // ポップアップがブロックされる環境では画面ごと移動する方式に切り替える
      if (e && /popup|blocked|cancelled/i.test(e.code || e.message || "")) {
        return signInWithRedirect(auth, provider);
      }
      throw e;
    });
  },

  logout: function () { return signOut(auth); },

  // scope: "mine" = 自分が登録した人 / "all" = 全員ぶん（管理者のみ）
  loadPeople: async function (scope) {
    if (!currentUser) return [];
    if (scope === "all" && this.isAdmin) {
      const snap = await getDocs(collectionGroup(db, "people"));
      return snap.docs.map(function (d) {
        const parent = d.ref.parent.parent;
        return Object.assign({}, d.data(), {
          id: d.id,
          _ownerUid: parent ? parent.id : ""
        });
      });
    }
    const snap = await getDocs(peopleCol(currentUser.uid));
    return snap.docs.map(function (d) {
      return Object.assign({}, d.data(), { id: d.id, _ownerUid: currentUser.uid });
    });
  },

  // いまの一覧をまるごと保存し、消えた人は消す
  persist: async function (list, removedIds) {
    if (!currentUser) throw new Error("ログインしていません");
    const uid = currentUser.uid;
    const batch = writeBatch(db);
    list.forEach(function (p) {
      batch.set(personDoc(uid, p.id), {
        name: String(p.name || ""),
        birth: String(p.birth || ""),
        group: String(p.group || ""),
        memo: String(p.memo || ""),
        createdAt: p.createdAt || Date.now(),
        ownerEmail: currentUser.email || "",
        ownerName: currentUser.displayName || ""
      });
    });
    (removedIds || []).forEach(function (id) {
      batch.delete(personDoc(uid, id));
    });
    await batch.commit();
  }
};

window.BebeDB = BebeDB;
window.dispatchEvent(new Event("bebedb-ready"));
