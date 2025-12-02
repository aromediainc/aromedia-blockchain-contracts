import AroMediaAccessManagerModule from "./AroMediaAccessManager";
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AroMediaAssetsRegistryModule", (m) => {

  const { accessManager } = m.useModule(AroMediaAccessManagerModule);
  const aroMediaAssetsRegistry = m.contract("AroMediaAssetsRegistry", [accessManager]);

  return { aroMediaAssetsRegistry };
});
