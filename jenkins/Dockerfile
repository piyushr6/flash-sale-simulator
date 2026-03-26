# ─────────────────────────────────────────────────────────────────
# Custom Jenkins image with Docker CLI + kubectl built in
# Build:  docker build -t jenkins-flash-sale ./jenkins/
# ─────────────────────────────────────────────────────────────────
FROM jenkins/jenkins:lts-jdk17

# Switch to root to install tools
USER root

# ── Install Docker CLI ────────────────────────────────────────────
RUN apt-get update -y && \
    apt-get install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release \
        wget \
        --no-install-recommends && \
    # Add Docker's official GPG key and repo
    install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg \
        -o /etc/apt/keyrings/docker.asc && \
    chmod a+r /etc/apt/keyrings/docker.asc && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
        https://download.docker.com/linux/debian \
        $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        > /etc/apt/sources.list.d/docker.list && \
    apt-get update -y && \
    apt-get install -y docker-ce-cli && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# ── Install kubectl ───────────────────────────────────────────────
RUN KUBECTL_VERSION=$(curl -sL https://dl.k8s.io/release/stable.txt) && \
    curl -sLO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl" && \
    install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl && \
    rm kubectl && \
    kubectl version --client

# ── Add jenkins user to docker group ─────────────────────────────
# The docker group GID must match the host's docker group GID.
# We create group with GID 999 (common default) — adjust if needed.
RUN groupadd -f -g 999 docker && \
    usermod -aG docker jenkins

# ── Skip initial setup wizard (convenient for demos) ─────────────
ENV JAVA_OPTS="-Djenkins.install.runSetupWizard=false"

# ── Pre-install plugins at build time ────────────────────────────
# This avoids having to click through the UI during demo setup
COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt

# Switch back to jenkins user
USER jenkins
