# The Dockerization & Deployment Handbook
### A general-purpose guide to containerizing and shipping applications — with the *why* behind every step
Version 1.1 — built on lessons from a real MERN-stack (MongoDB/Express/React/Node) AWS deployment

<details>
<summary>Changelog</summary>

- **v1.1** — Fixed a broken `HEALTHCHECK` (Alpine images don't ship `curl`), removed
  the deprecated `--link` flag from the backend `docker run` example in favor of a
  user-defined bridge network (consistent with what Section 18 itself recommends),
  added a test/lint gate and a rollback-safe rollout to the CI/CD pipeline, added an
  `.dockerignore` example, and added IMDSv2 to the hardening checklist.
- **v1.0** — Initial version.

</details>

> **How to use this handbook:** Every major decision is explained in three layers —
> **What** it is, **Why** you'd choose it, and **Why not** the alternatives. Skim the
> "What" sections if you just need to execute; read the "Why" sections if you want to
> actually understand infrastructure well enough to make your own calls on a different
> project, in an interview, or when something breaks at 2 AM.

---

## Table of Contents

1. [Mental Model: What Problem Are We Actually Solving?](#1-mental-model)
2. [Containers vs. Virtual Machines vs. Bare Metal](#2-containers-vs-vms)
3. [Images vs. Containers — The Core Docker Distinction](#3-images-vs-containers)
4. [Writing a Good Dockerfile](#4-dockerfile)
5. [Docker Compose — Local Orchestration](#5-docker-compose)
6. [Container Registries: Docker Hub vs. ECR vs. GHCR](#6-registries)
7. [Choosing Compute: EC2 vs. ECS/Fargate vs. Lambda vs. Kubernetes](#7-compute-choice)
8. [EC2 Provisioning Fundamentals](#8-ec2)
9. [Networking & Security Groups](#9-networking)
10. [Elastic IP vs. DNS](#10-elastic-ip)
11. [Storage: EBS vs. S3 vs. EFS](#11-storage)
12. [IAM Roles vs. Access Keys](#12-iam)
13. [SSH Access & Key Management](#13-ssh)
14. [Installing Docker on a Server](#14-docker-install)
15. [Swap Memory — Why Small Instances Need It](#15-swap)
16. [Disk Expansion](#16-disk)
17. [Database Deployment Choices](#17-database)
18. [Backend Deployment](#18-backend)
19. [Managing Environment Variables & Secrets](#19-env-vars)
20. [Frontend Deployment & the Build-Time API URL Trap](#20-frontend)
21. [Reverse Proxies — Why Nginx Sits in Front](#21-nginx)
22. [Verification & Health Checks](#22-verification)
23. [Troubleshooting Methodology](#23-troubleshooting)
24. [Production Hardening Checklist](#24-hardening)
25. [CI/CD — Why and How to Automate](#25-cicd)
26. [Scaling Path: From One EC2 Box to Real Infrastructure](#26-scaling)
27. [Common Anti-Patterns](#27-anti-patterns)
28. [Glossary](#28-glossary)
29. [Quick Reference Commands](#29-commands)

---

<a id="1-mental-model"></a>
## 1. Mental Model: What Problem Are We Actually Solving?

Before touching a single command, get this straight in your head:

**The core problem of deployment is: "It works on my machine" must become "It works on
*any* machine, reliably, repeatably, and recoverably."**

Everything in this handbook is in service of four goals:

- **Reproducibility** — the same build produces the same result every time.
- **Isolation** — one app's dependencies don't collide with another's.
- **Portability** — you can move the workload between your laptop, a teammate's laptop,
  and a cloud server without rewriting anything.
- **Recoverability** — when (not if) something breaks, you can diagnose and restore
  service quickly.

Docker solves reproducibility and isolation. Cloud infrastructure (AWS in this case)
solves availability and scale. Everything else — Nginx, IAM, security groups, CI/CD —
exists to make those two things safe and observable in production.

**Why this matters:** if you understand *why* each tool exists, you can substitute AWS
for GCP, Docker Hub for a private registry, or EC2 for Kubernetes without relearning
everything from scratch. The tools change; the problems they solve don't.

---

<a id="2-containers-vs-vms"></a>
## 2. Containers vs. Virtual Machines vs. Bare Metal

| | Bare Metal | Virtual Machine | Container |
|---|---|---|---|
| Isolation unit | None | Full OS (own kernel) | Process (shares host kernel) |
| Boot time | N/A | Minutes | Seconds |
| Overhead | None | High (full OS per VM) | Low (shared kernel) |
| Portability | Poor | Moderate (large images) | Excellent (small images) |
| Use case | Legacy, specialized hardware | Strong isolation, mixed OSes | Microservices, CI/CD, most modern apps |

**What a container actually is:** a container is *not* a lightweight VM. It's a regular
Linux process that the kernel has partitioned off using **namespaces** (so it sees its
own filesystem, network, and process tree) and **cgroups** (so its CPU/memory usage is
capped). There's no hypervisor and no second kernel — that's *why* containers start in
milliseconds instead of minutes.

**Why not just use VMs for everything?** VMs give you stronger isolation (different
kernels, different OSes even) but cost you boot time, image size (gigabytes vs.
megabytes), and density (you can run 10-50x more containers than VMs on the same
hardware). For a stateless web backend, that isolation is usually overkill — you want
speed and density instead.

**Why not skip containers and deploy straight to the VM?** Because then you're back to
"works on my machine": the VM's installed Node version, system libraries, and OS
patches all become part of your app's implicit dependency list. Docker makes those
dependencies *explicit and versioned* inside the image.

---

<a id="3-images-vs-containers"></a>
## 3. Images vs. Containers — The Core Docker Distinction

This trips up almost everyone early on, so get it locked in:

- An **image** is a read-only, layered *template* — think of it like a class in OOP, or
  a frozen snapshot of a filesystem plus metadata (entrypoint, exposed ports, env
  defaults).
- A **container** is a *running instance* of an image — think of it like an object
  instantiated from that class. You can run many containers from one image
  simultaneously, each with its own writable layer, network namespace, and process
  space.

**Why layers matter:** every instruction in a Dockerfile (`FROM`, `RUN`, `COPY`, etc.)
creates a new filesystem layer, cached independently. This is *why* Dockerfile
instruction *order* affects build speed — Docker reuses cached layers for everything
above the first line that changed. Put things that change rarely (installing OS
packages) near the top, and things that change often (your application source code)
near the bottom.

---

<a id="4-dockerfile"></a>
## 4. Writing a Good Dockerfile

A minimal Node.js backend Dockerfile, annotated:

```dockerfile
# 1. Pin a specific base image tag, not `latest`
FROM node:20-alpine AS base
# Why alpine? ~5MB base vs ~900MB for full node image = faster pulls, smaller attack surface.
# Why pin a version? "latest" silently changes over time and breaks reproducibility.

WORKDIR /app

# 2. Copy dependency manifests BEFORE source code
COPY package*.json ./
RUN npm ci --omit=dev
# Why separate this from COPY . .? Docker caches this layer. If only your source code
# changes (not package.json), this expensive npm install step is skipped entirely.
# Why `npm ci` not `npm install`? ci is deterministic — it uses package-lock.json exactly
# and fails if it's out of sync, instead of silently resolving new versions.

# 3. Now copy the rest of the source
COPY . .

# 4. Run as non-root
USER node
# Why? If the container is compromised, the attacker doesn't get root inside it.

ENV NODE_ENV=production
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:4000/health || exit 1
# Why `wget`, not `curl`? Alpine's minimal base doesn't ship curl at all — a HEALTHCHECK
# built around it will fail with "curl: not found" on every single check, and Docker
# will happily report the container as "unhealthy" forever. `wget` is already present
# because it's part of BusyBox, which alpine images include by default — so this works
# with zero extra packages. (If you specifically need curl for other tooling, install it
# explicitly with `apk add --no-cache curl`, but don't reach for it by habit on Alpine.)
CMD ["node", "server.js"]
```

**Why multi-stage builds for frontends (React/Vite/etc.)?**

```dockerfile
# Stage 1: build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
RUN npm run build

# Stage 2: serve — throw away the build tools entirely
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
```

A React app doesn't need Node.js, npm, or your `node_modules` at *runtime* — only at
*build time* to produce static HTML/CSS/JS. Multi-stage builds let the final image
contain just Nginx + static files (tens of MB) instead of the entire Node toolchain
(hundreds of MB). Smaller images pull faster, patch faster, and have a smaller attack
surface.

**Why `.dockerignore`?** Same reason as `.gitignore`, but it also directly affects
build speed and image size — without it, `COPY . .` drags `node_modules`, `.git`, and
local `.env` files into the build context and potentially into the image, bloating it
and risking secret leakage.

```
node_modules
npm-debug.log
.git
.gitignore
.env
.env.*
dist
coverage
*.md
.vscode
```

**Why exclude `node_modules` here if `RUN npm ci` already reinstalls it?** Two
reasons: it keeps the *build context* (everything sent to the Docker daemon before the
build even starts) small and fast to transfer, and it guarantees the image only ever
contains dependencies resolved fresh inside the container — not whatever happens to be
sitting on the developer's laptop, which may not match `package-lock.json` at all.

---

<a id="5-docker-compose"></a>
## 5. Docker Compose — Local Orchestration

**What it's for:** running multiple interdependent containers (backend + frontend +
database) with one command, using a single declarative file instead of a string of
`docker run` commands.

```yaml
services:
  mongodb:
    image: mongo:6-jammy
    volumes:
      - mongo-data:/data/db
  backend:
    build: ./apps/backend
    depends_on: [mongodb]
    environment:
      - MONGO_URI=mongodb://mongodb:27017/medivault
  frontend:
    build: ./apps/frontend
    ports: ["8080:80"]
volumes:
  mongo-data:
```

**Why does the backend reach Mongo at hostname `mongodb` instead of `localhost`?**
Compose creates a private virtual network for the whole stack and registers each
service name as a DNS hostname on that network. This is fundamentally different from
`localhost`, which always refers to the container's *own* network namespace, not its
neighbors.

**Why is Compose good for local dev but usually *not* how you run production at
scale?** Compose has no built-in concept of multi-host scheduling, rolling deploys, or
self-healing (auto-restarting on a different node if a host dies). It's an
orchestration tool for a single Docker host. That's exactly what you want on a laptop
or a lone EC2 box — and exactly what you *don't* want once you need high availability,
which is where ECS/Kubernetes take over (see Section 7).

**Why remove the `version:` key in modern compose files?** Docker Compose v2+ ignores
it and treats presence of the key as a deprecation warning — Compose Spec no longer
uses schema versioning.

---

<a id="6-registries"></a>
## 6. Container Registries: Docker Hub vs. ECR vs. GHCR

A registry is just a versioned storage system for images — `docker push` uploads a
layer set; `docker pull` downloads it.

| Registry | Why choose it | Why not |
|---|---|---|
| **Docker Hub** | Free public repos, huge base-image ecosystem, simplest onboarding | Rate limits on anonymous/free pulls; private repos are limited on free tier |
| **Amazon ECR** | Deep IAM integration (no separate credentials), same-region pulls are fast and free, vulnerability scanning | AWS-only; slightly more setup |
| **GitHub Container Registry (GHCR)** | Free for public repos, ties naturally into GitHub Actions | Less AWS-native integration |

**Why tag images with immutable versions (`v1.0.0`) instead of always pushing
`latest`?** `latest` is a moving target — if you roll back a bad deploy, "the image
tagged latest" might not mean what you think it means anymore, and two people building
at different times get different results. Immutable, semantic version tags make every
deployment traceable and rollback trivial: `docker run myapp:v1.0.0` will always be
exactly that build, forever.

**Why verify with `docker pull` after pushing?** It's a cheap sanity check that the
push actually completed and that the registry has the layers you think it has — cheaper
to catch here than after SSH-ing into a production box and finding a pull failure.

---

<a id="7-compute-choice"></a>
## 7. Choosing Compute: EC2 vs. ECS/Fargate vs. Lambda vs. Kubernetes

This is the single highest-leverage architecture decision you'll make, and it's worth
understanding the full spectrum even if you start on EC2.

| Option | What it is | Why choose it | Why not |
|---|---|---|---|
| **EC2 (raw VM)** | You manage the whole OS and Docker daemon yourself | Full control, cheapest for constant small workloads, best for learning fundamentals | You own patching, scaling, and recovery manually |
| **ECS on EC2** | AWS schedules containers across a fleet of EC2 instances you still manage | Managed orchestration without leaving EC2 pricing | Still manage the underlying instances |
| **ECS on Fargate** | Serverless containers — no EC2 instances to manage at all | No OS patching, scales per-task, pay only for what runs | Costs more per compute-hour than raw EC2; less low-level control |
| **Lambda** | Serverless functions, event-triggered, no always-on process | Best for spiky, short-lived workloads (e.g., image processing, webhooks) | Not suited to long-lived stateful servers or WebSocket-heavy apps |
| **Kubernetes (EKS)** | Full container orchestration platform | Portable across clouds, huge ecosystem, needed at real scale / multi-team orgs | Steep learning curve and operational overhead — overkill for a single small app |

**Why did this handbook use plain EC2?** For a single small full-stack app in early
deployment, a `t3.micro` EC2 instance is the cheapest way to learn every layer of the
stack by hand — OS, Docker daemon, networking, disk, reverse proxy — without an
orchestrator hiding the mechanics from you. That hands-on friction *is* the education.

**Why would you eventually move off it?** A single EC2 instance is a single point of
failure: if it crashes, your app is down until someone manually intervenes. It also
doesn't scale horizontally without manual load balancer setup. ECS/Fargate or EKS solve
both — automatic recovery ("self-healing") and horizontal auto-scaling — at the cost of
added complexity and cost. The rule of thumb: **start on EC2 to learn, graduate to
ECS/Fargate once you need real uptime guarantees, reach for Kubernetes only when you
have multiple teams/services or need cloud portability.**

---

<a id="8-ec2"></a>
## 8. EC2 Provisioning Fundamentals

Typical starting spec for a small full-stack app:

- **AMI:** Ubuntu LTS — long-term support, huge community documentation, predictable
  package availability.
- **Instance type:** `t3.micro` — a "burstable" instance type. It earns CPU credits
  when idle and spends them under load, which suits bursty web traffic far better than
  a constantly-throttled fixed-vCPU type at the same price point. It's also commonly
  within AWS's Free Tier.
- **Storage:** `gp3` EBS volume — general-purpose SSD; cheaper than `gp2` at equivalent
  performance, with independently configurable IOPS/throughput.

**Why Ubuntu over Amazon Linux?** Amazon Linux is more tightly optimized for AWS and
has slightly faster boot/patching cadences from AWS itself, but Ubuntu has the largest
package ecosystem and the most Stack-Overflow-able documentation — a real factor when
you're troubleshooting solo.

---

<a id="9-networking"></a>
## 9. Networking & Security Groups

A **security group** is a stateful virtual firewall attached to your instance's network
interface. "Stateful" means: if you allow inbound traffic on a port, the *response*
traffic is automatically allowed back out — you don't need a matching outbound rule.

Standard rule set for a web app server:

| Port | Purpose | Why |
|---|---|---|
| 22 | SSH | Admin access — should be restricted to your IP, not `0.0.0.0/0` |
| 80 | HTTP | Public web traffic |
| 443 | HTTPS | Encrypted public web traffic |
| 4000/8080 (temporary) | Direct container access during setup | **Must be closed after verification** — these bypass Nginx and expose raw app ports to the internet |

**Why open 4000/8080 only "temporarily"?** During initial deployment you need to
`curl` the backend/frontend directly to confirm they're alive before Nginx is
configured. Leaving those ports open in production means anyone on the internet can hit
your app directly, skipping any rate-limiting, TLS termination, or routing rules your
reverse proxy would otherwise enforce. Close them once Nginx is verified working.

**Why restrict SSH to your IP instead of `0.0.0.0/0`?** Port 22 open to the world is
one of the most commonly automated attack vectors on the internet — bots scan for it
constantly. Restricting the source IP (or better, using a bastion host / AWS Systems
Manager Session Manager instead of open SSH at all) removes that entire surface.

---

<a id="10-elastic-ip"></a>
## 10. Elastic IP vs. DNS

**What:** A normal EC2 public IP changes if you stop/start the instance. An **Elastic
IP** is a static IP you allocate and attach — it survives reboots and stop/start
cycles.

**Why you need one:** without it, every restart potentially breaks your DNS records,
your SSH config, and any hardcoded IPs in frontend builds (see Section 20).

**Why not stop there?** An Elastic IP is still just a raw IP address — hard to
remember, and if you ever migrate to a new instance or load balancer, the IP changes
and every client/bookmark breaks. The next maturity step is pointing a **Route 53** (or
any DNS provider) domain name at the Elastic IP, then eventually at a load balancer,
so the *address people use* never has to change even when the infrastructure behind it
does.

---

<a id="11-storage"></a>
## 11. Storage: EBS vs. S3 vs. EFS

| | EBS | S3 | EFS |
|---|---|---|---|
| What it is | Block storage attached to one EC2 instance | Object storage, accessed over HTTP(S) API | Managed network filesystem, mountable by many instances |
| Use case | OS disk, database data directory | User uploads, backups, static assets, logs | Shared files across multiple instances/containers |
| Durability | Tied to the instance's AZ | 11 nines, cross-AZ by design | High, multi-AZ |

**Why does user-uploaded content (e.g., medical documents in MediVault) go to S3
instead of the EC2 disk?** Three reasons: (1) EC2 disks are ephemeral relative to your
application's lifetime — if you terminate the instance to resize or replace it, data on
its EBS volume that wasn't explicitly preserved is at risk; (2) S3 scales storage
infinitely without you provisioning anything; (3) if you ever run multiple app
instances behind a load balancer, only S3 (not local disk) is naturally shared between
them.

**Why not put the database on S3 too?** S3 is *object* storage — you store and
retrieve whole files by key, with no in-place partial writes, transactions, or query
engine. A database needs low-latency block-level read/write with transactional
guarantees, which is what EBS (or a managed database service) provides.

---

<a id="12-iam"></a>
## 12. IAM Roles vs. Access Keys

**What an IAM Role attached to an EC2 instance does:** it lets code running *on* that
instance call AWS APIs (like S3) using temporary, automatically-rotated credentials
supplied through the instance metadata service — with no access key or secret key ever
stored in your code, environment file, or Docker image.

**Why this is strictly better than hardcoding an access key/secret pair in your
`.env`:**
- Hardcoded keys are static — if leaked (committed to git, logged, baked into an
  image layer), they're valid until someone manually revokes them.
  Role-based credentials are short-lived and auto-rotate.
- Roles are scoped with fine-grained IAM policies — you can grant "PutObject on this
  one S3 bucket only," which limits blast radius if the instance itself is
  compromised.
- One less secret to manage, rotate, and accidentally leak.

**Why would you ever still use access keys?** Local development (your laptop isn't an
EC2 instance, so it has no instance role to assume) or CI/CD runners not running
inside AWS. Even then, prefer short-lived credentials via AWS SSO / OIDC federation
over long-lived static keys where the tooling supports it.

---

<a id="13-ssh"></a>
## 13. SSH Access & Key Management

```bash
ssh -i medivault-key.pem ubuntu@<elastic-ip>
```

**Why key-pair auth instead of a password?** SSH key pairs use asymmetric
cryptography — the private key never leaves your machine, and brute-forcing it is
computationally infeasible, unlike passwords which are vulnerable to guessing/stuffing
attacks. AWS also simply doesn't support password auth by default on Linux AMIs.

**Common "SSH timeout" causes, ranked by likelihood:**
1. Security group doesn't allow port 22 from your current IP (most common — especially
   after your home/office IP changes).
2. Using the instance's old IP instead of the current Elastic IP.
3. Instance isn't actually running (stopped, terminated, or still booting).
4. `.pem` file permissions too open (`chmod 400 key.pem` is required — SSH clients
   refuse to use overly-permissive key files as a security measure).

---

<a id="14-docker-install"></a>
## 14. Installing Docker on a Server

```bash
sudo apt update
sudo apt install docker.io -y
sudo systemctl enable docker   # start on boot
sudo systemctl start docker
sudo usermod -aG docker ubuntu # avoid needing sudo for every docker command
```

**Why do you have to disconnect and reconnect SSH after `usermod -aG docker`?** Group
membership is evaluated when a session starts, not live. Your current shell session
still reflects your *old* group list until you start a fresh login session (reconnect,
or run `newgrp docker`).

**Why not run every Docker command as root/with `sudo` instead of bothering with the
docker group?** You can, but routine use of `sudo` for every command is both
inconvenient and a bad habit — it's easy to accidentally `sudo rm -rf` something you
didn't mean to when you're used to prefixing everything with root privileges.

---

<a id="15-swap"></a>
## 15. Swap Memory — Why Small Instances Need It

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**What's happening:** you're allocating disk space that the kernel can use as
overflow "virtual RAM" when physical RAM is exhausted.

**Why a `t3.micro` (1GB RAM) needs this so badly:** running MongoDB + a Node backend +
an Nginx-served frontend simultaneously on 1GB of RAM leaves almost no headroom. Without
swap, the Linux **OOM killer** will silently terminate whichever process it judges
least important the moment memory runs out — often mid-request, with no clean error,
just a container that mysteriously died. Swap buys you a safety margin, trading some
latency (disk is far slower than RAM) for stability.

**Why not just always add swap by default on every server?** On instances with ample
RAM it's unnecessary, and heavy reliance on swap under sustained load is a *symptom*
that you're undersized for the workload — the real fix at that point is a bigger
instance type, not more swap. Swap is a stopgap for occasional spikes, not a substitute
for adequate memory.

---

<a id="16-disk"></a>
## 16. Disk Expansion

```
no space left on device
```

Fix (Linux, `nvme`-based EBS volumes):

```bash
sudo apt install cloud-guest-utils -y
sudo growpart /dev/nvme0n1 1
sudo resize2fs /dev/nvme0n1p1
df -h
```

**Why two separate resize steps?** `growpart` resizes the *partition table entry* to
claim the newly-available space on the underlying block device (which you also had to
expand in the AWS console first). `resize2fs` then resizes the *filesystem itself*
(ext4) to actually use that newly available partition space. Resizing the partition
without resizing the filesystem leaves the extra space allocated but unusable.

**Why does Docker eat disk so fast on a small instance?** Every image layer, every
build cache, every stopped container, and every unused volume persists on disk until
explicitly pruned. `docker system df` shows the breakdown; `docker system prune -a`
reclaims it (with caution — this deletes anything not actively in use).

---

<a id="17-database"></a>
## 17. Database Deployment Choices

Running MongoDB yourself in a container is one valid option — but it's worth knowing
what you're trading off against a managed service.

| | Self-hosted Mongo container | MongoDB Atlas (managed) | AWS DocumentDB |
|---|---|---|---|
| Setup effort | You configure everything | Minutes, GUI-driven | AWS-native, Mongo-compatible API |
| Backups | Manual (cron + `mongodump`, or EBS snapshots) | Automatic, point-in-time | Automatic snapshots |
| Scaling | Manual — resize instance/volume yourself | Click-to-scale, auto-sharding options | Vertical + read replicas |
| Cost at small scale | Cheapest (just the EC2 you're already paying for) | Free tier available, then usage-based | No free tier, generally pricier |
| Operational burden | You own patching, monitoring, HA | Offloaded entirely | Offloaded, AWS-managed |

**Why self-host for a learning project or MVP?** Zero extra cost beyond the EC2 you're
already running, and you learn how databases actually behave in production (backups,
memory pressure, restart behavior).

**Why move to a managed service later?** The moment your data matters (real users,
real money, compliance requirements like HIPAA for a medical app), the operational risk
of hand-rolled backups and no automatic failover stops being worth the savings.
Managed services exist precisely to remove "did the 2 AM backup cron job actually run"
from your list of things to worry about.

**Why never expose MongoDB's port (27017) to the public internet?** MongoDB has
historically had no authentication enabled by default, and instances left open on
27017 are a well-documented target for automated ransomware scanners that wipe unsecured
databases. Keep it reachable only from the backend container's internal Docker network
or a private VPC subnet — never from `0.0.0.0/0`.

---

<a id="18-backend"></a>
## 18. Backend Deployment

```bash
# One-time setup: a user-defined bridge network gives containers DNS-based
# service discovery by container name, the same way Compose does it automatically.
docker network create medivault-net
docker run -d --name mongodb --restart always \
  --network medivault-net \
  -v mongo-data:/data/db \
  mongo:6-jammy

docker run -d --name medivault-backend --restart always \
  --network medivault-net -p 4000:4000 \
  --env-file ~/app/apps/backend/.env \
  devam246/medivault-backend:v1.0.0
```

**Why `--restart always`?** If the container crashes, or the host reboots (e.g., after
an AWS maintenance event), Docker automatically restarts it — this is the single-box
equivalent of "self-healing" until you graduate to a real orchestrator.

**Why a user-defined network instead of `--link`?** `--link` is Docker's original,
now-deprecated mechanism for one container to resolve another by name — it's fragile
(links break if you recreate the linked container) and one-directional. A
user-defined bridge network gives every attached container automatic DNS resolution
of every other container's name, in both directions, and lets you attach or detach
containers from the network without recreating them. It's also exactly what Compose
sets up for you under the hood (Section 5) — using the same mechanism by hand here
keeps the manual deployment consistent with how you'd already reasoned about it in
local dev, instead of teaching two different mental models for the same problem.

**Why check `/health` instead of just seeing the container is "Up"?** A container can
be in the `Up` state while the application inside it is still initializing, crash-
looping internally, or unable to reach its database — "container running" and
"application healthy" are different facts. A dedicated health endpoint that actually
checks downstream dependencies (like DB connectivity) is what `HEALTHCHECK` and load
balancers should query.

---

<a id="19-env-vars"></a>
## 19. Managing Environment Variables & Secrets

A typical backend needs secrets like `JWT_SECRET`, `MONGO_URI`, `PRIVATE_KEY`, and
third-party API keys. How you deliver them to the container matters:

| Method | Why use it | Why not |
|---|---|---|
| `--env-file .env` on the host | Simple, works everywhere | `.env` sits in plaintext on disk; must never be committed to git |
| Baked into the image (`ENV` in Dockerfile) | **Don't.** | Secrets become permanently embedded in every layer of a *publicly pushed* image — recoverable by anyone who pulls it, forever, even after "removal" in a later layer |
| AWS Secrets Manager / SSM Parameter Store | Centralized, auditable, rotatable, IAM-controlled access | Slightly more setup; small runtime cost to fetch at startup |

**Why is baking secrets into an image so much worse than a leaked `.env` file?** A
leaked `.env` file is a single point-in-time incident you can rotate away from. A
secret baked into an image layer is distributed every time someone pulls that image —
including via cached layers even if you "delete" it in a later `RUN` instruction,
because earlier layers remain part of the image history.

**Why move toward Secrets Manager eventually?** It gives you audit logs (who accessed
which secret when), automatic rotation for supported secret types (like RDS
passwords), and removes plaintext secrets from disk entirely — the application fetches
them at runtime via IAM-authenticated API calls instead.

---

<a id="20-frontend"></a>
## 20. Frontend Deployment & the Build-Time API URL Trap

The single most common "why doesn't my frontend talk to my backend" bug:

```
VITE_API_URL=http://localhost:4000
```

**Why this breaks in production:** Vite (like Create React App and most frontend
build tools) **bakes environment variables into the JavaScript bundle at build time**,
not at container runtime. `localhost` inside that bundle refers to *the browser's own
machine* — the end user's laptop — not the EC2 server the code was built on. So the
compiled JS tries to fetch `http://localhost:4000` on the user's own computer, where
nothing is listening, and every API call silently fails.

**The fix:**

```bash
docker build -f apps/frontend/Dockerfile \
  --build-arg VITE_API_URL=http://<elastic-ip>:4000 \
  -t devam246/medivault-frontend:v1.0.1 .
```

**Why does this need a full image rebuild instead of just changing an env var at
runtime?** Because the value is compiled *into* the static JS bundle during `npm run
build` — by the time the container is running Nginx serving static files, there's no
running process left to read a fresh environment variable from. This is fundamentally
different from the backend, where env vars are read live by the Node process on every
request.

**Why is "use relative API paths" listed as a best practice for the future?** If the
frontend calls `/api/...` (relative, no host) instead of a hardcoded absolute URL, and
Nginx is configured to proxy `/api/` requests to the backend container, you never need
to bake an environment-specific URL into the build at all — the same built image works
unchanged across dev, staging, and production. This is strictly better and is where a
mature setup should end up.

---

<a id="21-nginx"></a>
## 21. Reverse Proxies — Why Nginx Sits in Front

```bash
sudo apt install nginx -y
sudo nginx -t          # validate config syntax before reloading
sudo systemctl restart nginx
```

Goal: `Port 80 → Frontend container`, with backend API routes proxied through rather
than exposed directly on port 4000.

**Why put a reverse proxy in front of your app containers at all, instead of just
exposing them directly?**
- **Single entry point:** users hit port 80/443 only; internal container ports
  (4000, 8080, 27017) never need to be public.
- **TLS termination:** Nginx (or a load balancer) handles HTTPS certificates in one
  place instead of every service implementing its own TLS.
- **Routing:** one domain can serve `/` from the frontend and `/api/` from the backend
  without the browser needing to know they're different containers/ports.
- **Buffering & rate limiting:** Nginx can shed load, cache static assets, and limit
  request rates before traffic ever reaches your application code.

**Why always run `nginx -t` before restarting?** A syntax error in an Nginx config
that you `restart` blindly will bring down your *entire* web-facing service — `-t`
validates the config against a *running* Nginx without touching it, so a bad edit fails
safely instead of taking production down.

---

<a id="22-verification"></a>
## 22. Verification & Health Checks

A minimum "is this actually working" checklist after any deploy:

- [ ] `docker ps` — are all expected containers `Up`, not restarting in a loop?
- [ ] `curl http://localhost:<port>/health` from *inside* the server, for each service
- [ ] `curl http://<public-ip-or-domain>` from *outside* the server (confirms
      security groups + Nginx routing, not just that the app itself is alive)
- [ ] Database connectivity confirmed from backend logs, not assumed
- [ ] Registry has the exact image/tag you intended to deploy (`docker pull` check)
- [ ] Temporary debug ports (4000/8080) closed once verified

**Why test from both inside and outside the server?** A backend responding to
`curl localhost:4000/health` on the server itself only proves the *process* is alive —
it says nothing about whether the security group, Elastic IP, or Nginx config are
correctly routing real internet traffic to it. Both checks catch different failure
classes.

---

<a id="23-troubleshooting"></a>
## 23. Troubleshooting Methodology

Beyond memorizing specific fixes, internalize the general debugging *process*, because
it transfers to problems this handbook never anticipated:

1. **Localize the failure layer.** Is it DNS, network/security group, the reverse
   proxy, the container, or the application code? Test each layer independently
   (`curl` locally on the box vs. from outside; check `docker ps` before app logs).
2. **Read logs before guessing.** `docker logs <container>` and `journalctl -u nginx`
   are almost always faster than trial-and-error changes.
3. **Reproduce the smallest failing case.** If the frontend can't reach the backend,
   isolate: can Nginx reach the backend container directly? Can the backend reach
   Mongo? Narrow it down instead of restarting everything at once.
4. **Check what changed.** Most production incidents follow a deploy, a config edit,
   or an expired credential/certificate — check recent changes before assuming novel
   failure.
5. **Validate before you apply** (`nginx -t`, `docker compose config`) wherever the
   tooling offers a dry-run, so config mistakes fail safely instead of taking down a
   live service.

| Symptom | Likely cause |
|---|---|
| SSH timeout | Security group rule, wrong/changed IP, instance not running |
| `docker login`/push failures | Not authenticated to the registry |
| `no space left on device` | EBS volume full — expand + resize filesystem |
| Frontend can't reach backend | Build-time API URL baked wrong (see Section 20) |
| Container "Up" but app not responding | Health check missing/misconfigured; app crash-looping silently |
| Nginx 502 Bad Gateway | Backend container down, or Nginx pointed at wrong port/host |

---

<a id="24-hardening"></a>
## 24. Production Hardening Checklist

- [ ] Build immutable, versioned images — never deploy `latest` in production.
- [ ] Verify images with `docker pull` after every push.
- [ ] Never expose the database port publicly.
- [ ] Restrict SSH to known IPs; prefer key-based auth, consider disabling password
      auth entirely and/or using AWS Systems Manager Session Manager instead of open
      SSH.
- [ ] Use IAM roles instead of long-lived access keys wherever code runs inside AWS.
- [ ] Require IMDSv2 on EC2 instances (`aws ec2 modify-instance-metadata-options
      --http-tokens required`). IMDSv1 is queryable with a plain HTTP GET, which makes
      it a known escalation path for SSRF vulnerabilities in your app to steal the
      instance's IAM role credentials; IMDSv2 requires a session token first, closing
      that path.
- [ ] Add real health-check endpoints that verify downstream dependencies, not just
      "process is running."
- [ ] Put a reverse proxy in front of every service; never expose app ports directly.
- [ ] Move secrets out of `.env` files and into a secrets manager once the project is
      more than a personal experiment.
- [ ] Enable HTTPS (e.g., via Let's Encrypt/Certbot) — plaintext HTTP for anything
      handling auth tokens or sensitive data (like medical records) is not acceptable
      in production.
- [ ] Set up automated backups for any stateful data store.
- [ ] Set up basic monitoring/alerting (CloudWatch or equivalent) so you find out about
      outages before your users tell you.

---

<a id="25-cicd"></a>
## 25. CI/CD — Why and How to Automate

**Why automate deployment at all, once it works manually?** Manual deployment is
error-prone (forgotten steps), slow (you're the bottleneck), and undocumented in
practice (the "real" process lives in someone's head/terminal history, not in version
control). A CI/CD pipeline turns your deployment runbook into code that runs the same
way every time.

A typical GitHub Actions flow for this stack:

```yaml
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm test

  build-and-deploy:
    needs: test   # never build/deploy code that failed its own test suite
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Log in to Docker Hub
        run: echo "${{ secrets.DOCKERHUB_TOKEN }}" | docker login -u devam246 --password-stdin
      - name: Build and push image
        run: |
          docker build -t devam246/medivault-backend:${{ github.sha }} .
          docker push devam246/medivault-backend:${{ github.sha }}
      - name: Deploy to EC2 over SSH (rollback-safe)
        run: |
          ssh ubuntu@$EC2_HOST '
            set -e
            PREV=$(docker inspect --format "{{.Image}}" medivault-backend 2>/dev/null || true)
            docker pull devam246/medivault-backend:${{ github.sha }}
            docker stop medivault-backend || true
            docker rm medivault-backend || true
            docker run -d --name medivault-backend --restart always \
              --network medivault-net --env-file ~/.env -p 4000:4000 \
              devam246/medivault-backend:${{ github.sha }}
            sleep 5
            if ! curl -sf http://localhost:4000/health; then
              echo "New container failed health check — rolling back"
              docker stop medivault-backend && docker rm medivault-backend
              docker run -d --name medivault-backend --restart always \
                --network medivault-net --env-file ~/.env -p 4000:4000 "$PREV"
              exit 1
            fi
          '
```

**Why does `test` gate `build-and-deploy` with `needs: test` instead of running
everything in one job?** Splitting them means a failing test suite stops the pipeline
*before* anything gets built, pushed to a public registry, or touches production —
catching the cheapest possible failure at the cheapest possible point, rather than
discovering a broken build only after it's already live.

**Why capture the previous image ID and roll back on a failed health check, instead
of just deploying and hoping?** Without this, a bad deploy silently replaces a
working container with a broken one, and "is prod actually up" becomes something a
human has to notice and fix manually — often after users already have. A rollback
step turns "someone gets paged at 2 AM" into "the pipeline self-corrects and the
on-call engineer reads about it in the morning."

**Why tag images with the git commit SHA instead of a manually-chosen version
number?** It guarantees traceability — you can always answer "exactly which code is
running in production right now" by checking the running image tag, with zero risk of
a human forgetting to bump a version number.

**Why is "Blue/Green deployment" listed as a future improvement rather than done from
day one?** Blue/Green (running the new version alongside the old, then switching
traffic) requires either a load balancer or a second environment to switch between —
infrastructure a single EC2 instance doesn't have. It's a natural next step once you
move to ECS/Fargate or add a load balancer, not something meaningful to bolt onto a
lone box.

---

<a id="26-scaling"></a>
## 26. Scaling Path: From One EC2 Box to Real Infrastructure

A realistic maturity ladder, and *why* each rung exists:

1. **Single EC2 + Docker Compose** — learn every layer by hand. Fine for a portfolio
   project or early MVP with tolerant users.
2. **Single EC2 + Nginx + immutable images + CI/CD** — the state this handbook ends
   at. Reasonably solid for low-stakes production, but still a single point of failure.
3. **Load Balancer + 2+ EC2 instances (Auto Scaling Group)** — removes the single
   point of failure; traffic is distributed and unhealthy instances are automatically
   replaced.
4. **ECS/Fargate** — AWS manages container placement and recovery for you; you stop
   thinking about individual servers at all.
5. **Managed database (Atlas/RDS/DocumentDB) + Secrets Manager + HTTPS + CloudWatch
   alerts** — offload operational risk on the pieces that matter most (data durability,
   secret handling, incident awareness).
6. **Kubernetes (EKS) / multi-region** — only relevant once you have multiple
   services, multiple teams, or genuine need for cloud portability. Most projects never
   need to reach this rung, and reaching for it too early is itself an anti-pattern
   (see next section).

---

<a id="27-anti-patterns"></a>
## 27. Common Anti-Patterns

- **Using `latest` tags in production.** Non-reproducible, makes rollback guesswork.
- **Baking secrets into image layers.** Permanent, distributed leak the moment the
  image is pushed anywhere.
- **Exposing the database directly to the internet** "just for now." "For now" is how
  data breaches happen.
- **Skipping health checks** because "the container shows as running." Running and
  healthy are different claims.
- **Over-engineering early** — reaching for Kubernetes or a multi-region architecture
  before you have the traffic, team size, or reliability requirements to justify the
  operational overhead.
- **Manual, undocumented deploys** — if the process only exists in someone's terminal
  history, it isn't a process, it's a single point of failure in human form.
- **Ignoring `nginx -t` / config validation** before reloading a live proxy.
- **Committing `.env` files to git.** Rotate immediately if this happens; treat the
  leaked secrets as compromised, not just "hidden now."
- **A CI/CD pipeline that builds and deploys without ever running tests.** Automation
  without a test gate just means bugs reach production *faster and more reliably* —
  it doesn't make the code any more correct.
- **Deploying with no rollback path.** If the deploy step can't detect a failed
  health check and revert, "the deploy succeeded" and "the app works" are being
  treated as the same claim when they aren't.

---

<a id="28-glossary"></a>
## 28. Glossary

- **Image** — a read-only template for creating containers.
- **Container** — a running (or stopped) instance of an image.
- **Layer** — a cached filesystem diff produced by one Dockerfile instruction.
- **Registry** — a storage/distribution system for images (Docker Hub, ECR, GHCR).
- **Security Group** — a stateful virtual firewall attached to AWS resources.
- **Elastic IP** — a static public IP address you own and can reattach to instances.
- **IAM Role** — a set of permissions an AWS resource (like EC2) can assume, granting
  temporary auto-rotated credentials.
- **Reverse Proxy** — a server that sits in front of application servers, forwarding
  client requests to them (e.g., Nginx).
- **Health Check** — an endpoint or probe that verifies an application (not just its
  process) is functioning correctly.
- **CI/CD** — Continuous Integration / Continuous Deployment: automating build, test,
  and deploy steps.
- **Swap** — disk space used as overflow memory when physical RAM is exhausted.
- **OOM Killer** — the Linux kernel mechanism that force-kills processes when memory is
  critically low.
- **Multi-stage build** — a Dockerfile pattern that produces a lean final image by
  discarding build-only tooling from earlier stages.

---

<a id="29-commands"></a>
## 29. Quick Reference Commands

**Docker**
```bash
docker ps                     # running containers
docker logs <container>       # view logs
docker images                 # local images
docker system df              # disk usage breakdown
docker system prune -a        # reclaim disk (careful — removes unused resources)
docker exec -it <container> sh
```

**Nginx**
```bash
sudo nginx -t                 # validate config before reload
sudo systemctl restart nginx
sudo systemctl status nginx
```

**Disk**
```bash
df -h
lsblk
sudo growpart /dev/nvme0n1 1
sudo resize2fs /dev/nvme0n1p1
```

**Networking**
```bash
curl http://localhost:4000/health   # from inside the server
curl http://<public-ip>             # from outside — tests SG + Nginx too
```

---

## Closing Principle

Every tool in this handbook exists to answer one of four questions:
**Does it build the same way every time? Is it isolated from things that shouldn't
touch it? Can traffic reach it safely? And when it breaks, can you tell — and fix it —
fast?**

If you can answer those four questions for any new stack you're handed, you don't need
to memorize this handbook — you can rebuild its equivalent from first principles on any
cloud, with any container runtime, for any application.
