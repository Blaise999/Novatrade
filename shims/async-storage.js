// Web shim for @react-native-async-storage/async-storage (MetaMask SDK pulls it in)
const mem = new Map();

function hasLS() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

const AsyncStorage = {
  async getItem(key) {
    try {
      if (hasLS()) return window.localStorage.getItem(key);
    } catch {}
    return mem.has(key) ? mem.get(key) : null;
  },

  async setItem(key, value) {
    const v = String(value);
    try {
      if (hasLS()) {
        window.localStorage.setItem(key, v);
        return;
      }
    } catch {}
    mem.set(key, v);
  },

  async removeItem(key) {
    try {
      if (hasLS()) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch {}
    mem.delete(key);
  },

  async clear() {
    try {
      if (hasLS()) {
        window.localStorage.clear();
        return;
      }
    } catch {}
    mem.clear();
  },

  async getAllKeys() {
    try {
      if (hasLS()) return Object.keys(window.localStorage);
    } catch {}
    return Array.from(mem.keys());
  },

  async multiGet(keys) {
    return Promise.all(keys.map(async (k) => [k, await AsyncStorage.getItem(k)]));
  },

  async multiSet(pairs) {
    await Promise.all(pairs.map(([k, v]) => AsyncStorage.setItem(k, v)));
  },

  async multiRemove(keys) {
    await Promise.all(keys.map((k) => AsyncStorage.removeItem(k)));
  },
};

module.exports = AsyncStorage;
module.exports.default = AsyncStorage;
