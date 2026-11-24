import { serviceSuite } from "./service.suite";
import { MemoryStore } from "./store";

serviceSuite("memory store", async () => ({ store: new MemoryStore() }));
