import AroMediaAccessManagerModule from "./AroMediaAccessManager";
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AroMediaRWAModule", (m) => {

  const { accessManager } = m.useModule(AroMediaAccessManagerModule);
  const aroMediaRWA = m.contract("AroMediaRWA", [accessManager]);

  return { aroMediaRWA };
});
