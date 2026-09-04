#!/usr/bin/env bash
# Amazon Linux 2023 bootstrap with Node 24.19.0.
set -euo pipefail

# Log everything for SSM troubleshooting
exec > >(tee /var/log/user-data.log | logger -t user-data) 2>&1
echo "=== user_data.sh start: $(date) ==="

# Update system packages
dnf update -y --quiet

dnf install -y curl tar xz --quiet
NODE_VERSION=24.19.0
case "$(uname -m)" in
  x86_64) NODE_ARCH=x64; NODE_SHA256=14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647 ;;
  aarch64) NODE_ARCH=arm64; NODE_SHA256=01443c1e1a29e531ccad5a46fefa6df490d2189c49f7955904aecdbb0fe86fdc ;;
  *) echo "Unsupported Node architecture" >&2; exit 1 ;;
esac
NODE_INSTALL_DIR=$(mktemp -d)
trap 'rm -rf "$NODE_INSTALL_DIR"' EXIT
NODE_ARCHIVE="$NODE_INSTALL_DIR/node.tar.xz"
curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-$NODE_ARCH.tar.xz" -o "$NODE_ARCHIVE"
printf '%s  %s\n' "$NODE_SHA256" "$NODE_ARCHIVE" | sha256sum --check --status
tar -xJf "$NODE_ARCHIVE" -C /usr/local --strip-components=1
export PATH="/usr/local/bin:$PATH"
test "$(node --version)" = "v$NODE_VERSION"
npm --version

# Pre-install system deps required by Playwright Chromium on Amazon Linux 2023.
# The actual Chromium binary is installed later by the benchmark package's
# own playwright-core version (via `npx playwright install chromium`).
dnf install -y \
  atk \
  at-spi2-atk \
  cups-libs \
  gtk3 \
  libdrm \
  libXcomposite \
  libXdamage \
  libXfixes \
  libXrandr \
  libxkbcommon \
  mesa-libgbm \
  nss \
  pango \
  xorg-x11-server-Xvfb \
  alsa-lib \
  --quiet || true

# Create working directory for benchmark uploads
mkdir -p /opt/bb-benchmark
chmod 777 /opt/bb-benchmark

echo "=== user_data.sh complete: $(date) ==="
