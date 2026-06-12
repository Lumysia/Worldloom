import { MockAgent, setGlobalDispatcher } from "undici";

const networkDenyAgent = new MockAgent();
networkDenyAgent.disableNetConnect();

setGlobalDispatcher(networkDenyAgent);
