import AroMediaAccessManagerModule from "./AroMediaAccessManager";
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("ForcedTransferManagerModule", (m) => {

  const { accessManager } = m.useModule(AroMediaAccessManagerModule);
  const forcedTransferManager = m.contract("ForcedTransferManager", [accessManager]);

  return { forcedTransferManager };
});
