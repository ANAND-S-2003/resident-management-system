# Environment requirements

| Tool | Required version/state | Verification command |
|---|---|---|
| Java | 17 | `java -version` |
| Maven | 3.9 or newer | `mvn -version` |
| Node.js | 22 | `node --version` |
| npm | Available with Node.js 22 | `npm --version` |
| Git | Installed | `git --version` |
| Docker Desktop | Installed and running | `docker --version` and `docker info` |

Docker Compose is included with current Docker Desktop installations; verify with `docker compose version`.

The JWT signing secret is supplied through an environment variable, must be at least 32 bytes, and is required at startup. The first SUPER_ADMIN is bootstrapped from environment variables for email, name, and password if no SUPER_ADMIN exists. Do not commit real values; document variable names and safe placeholders in `.env.example` when application configuration is added.
