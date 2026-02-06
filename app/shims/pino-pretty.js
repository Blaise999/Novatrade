// Browser shim for pino-pretty (WalletConnect logger tries to resolve it)
function pinoPretty() {
  // If anything ever calls it in the browser, keep it harmless.
  return { write() {}, end() {}, on() {}, pipe() {} };
}

module.exports = pinoPretty;
module.exports.default = pinoPretty;
