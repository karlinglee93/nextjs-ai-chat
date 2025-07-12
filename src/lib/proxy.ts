import { ProxyAgent, setGlobalDispatcher } from "undici";

export function setupGlobalProxy() {
  if (process.env.HTTP_PROXY) {
    const proxyAgent = new ProxyAgent(process.env.HTTP_PROXY);
    setGlobalDispatcher(proxyAgent);
  }
}