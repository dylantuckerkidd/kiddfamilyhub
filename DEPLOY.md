# Deploying to Raspberry Pi with Cloudflare Tunnel

## Prerequisites

- Raspberry Pi (or any Linux server) with Docker and Docker Compose installed
- A domain managed by Cloudflare

## 1. Create a Cloudflare Tunnel

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) > **Networks** > **Tunnels**
2. Click **Create a tunnel** > select **Cloudflared**
3. Name it (e.g. `family-hub`)
4. Copy the tunnel token — you'll need it in step 3
5. Under **Public Hostnames**, add a route:
   - **Subdomain**: e.g. `budget` (or leave blank for root)
   - **Domain**: your Cloudflare domain
   - **Service**: `http://family-hub:3000`

## 2. Clone the repo

```bash
git clone <your-repo-url> family-hub
cd family-hub
```

## 3. Configure environment

Create a `.env` file in the project root:

```
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token-here
```

## 4. Start it up

```bash
docker compose up -d --build
```

This starts two containers:
- **family-hub** — the app on port 3000 (accessible locally)
- **cloudflared** — connects to Cloudflare and proxies traffic to family-hub

## 5. Verify

- **Local**: visit `http://<pi-ip>:3000`
- **Remote**: visit your configured Cloudflare domain

## Updating

```bash
git pull
docker compose up -d --build
```

## Data persistence

The SQLite database is stored in `./data/budget.db` on the host, mounted into the container. This survives container rebuilds.
