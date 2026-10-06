import link from "@stripe/link-integrations-eve";
import type { ToolAuthProvider } from "eve/tools";

import { requireLinkAccessToken } from "../../../server/link-wallet.js";

const linkAuth: ToolAuthProvider = {
  principalType: "app",
  async getToken() {
    return { token: requireLinkAccessToken() };
  },
};

export default link({ auth: linkAuth });
