(function applyBootstrapConfig() {
  let parsedConfig = {};
  const configNode = document.getElementById("app-bootstrap-config");
  if (configNode && configNode.textContent) {
    try {
      const candidate = JSON.parse(configNode.textContent);
      if (candidate && typeof candidate === "object") {
        parsedConfig = candidate;
      }
    } catch (_error) {}
  }

  window.__XSS_CLIENT_SIDE_SANITIZE_ENABLED__ =
    parsedConfig.clientSideSanitizeEnabled !== false;
  const options = parsedConfig.xssClientSideOptions;
  window.__XSS_CLIENT_SIDE_OPTIONS__ =
    options && typeof options === "object" ? options : {};
})();
