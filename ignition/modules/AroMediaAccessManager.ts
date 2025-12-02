import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { getAuthorityAddress } from "../../utils/constants";

export default buildModule("AroMediaAccessManagerModule", (m) => {
  const multiSigOwner = getAuthorityAddress();
  const accessManager = m.contract("AroMediaAccessManager", [multiSigOwner]);

  return { accessManager };
});
