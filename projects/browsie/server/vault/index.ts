import { NativeVaultProvider } from "./native";
import { OnePasswordVaultProvider } from "./onepassword";

export const nativeVault = new NativeVaultProvider();
export const onePasswordVault = new OnePasswordVaultProvider();
