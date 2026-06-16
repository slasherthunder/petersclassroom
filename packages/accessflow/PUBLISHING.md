# Publishing @axolassist/accessflow

One-time setup, then every release is a git tag.

## 1. Create the npm organization

1. Sign in at [npmjs.com](https://www.npmjs.com/) (create an account if needed).
2. Open **[Create an organization](https://www.npmjs.com/org/create)**.
3. Choose **Unlimited public packages** (free).
4. Set the organization name to **`axolassist`** (this creates the `@axolassist` scope).

## 2. Create an npm automation token

1. Go to **[Access Tokens](https://www.npmjs.com/settings/~your-username~/tokens)** (or your org’s token page).
2. **Generate New Token** → **Granular Access Token**.
3. Permissions: **Read and write** for packages under **`@axolassist`**.
4. Copy the token (starts with `npm_…`) — you won’t see it again.

## 3. Add `NPM_TOKEN` to GitHub

Repo: **slasherthunder/petersclassroom**

### Option A — GitHub website

1. [Repository Settings → Secrets and variables → Actions](https://github.com/slasherthunder/petersclassroom/settings/secrets/actions)
2. **New repository secret**
3. Name: `NPM_TOKEN`
4. Value: paste your npm token

### Option B — GitHub CLI

```bash
gh auth login
gh secret set NPM_TOKEN --repo slasherthunder/petersclassroom
# paste npm token when prompted
```

## 4. Publish v1.0.0 (automated via GitHub Actions)

From the repo root:

```bash
git tag accessflow-v1.0.0
git push origin accessflow-v1.0.0
```

The workflow [`.github/workflows/publish-accessflow.yml`](../../.github/workflows/publish-accessflow.yml) will:

- Install dependencies
- Typecheck and build
- Publish `@axolassist/accessflow@1.0.0` to npm with public access

Watch progress: [Actions tab](https://github.com/slasherthunder/petersclassroom/actions)

## 5. Publish manually (optional)

```bash
cd packages/accessflow
npm login
npm run build
npm publish
```

`publishConfig.access` is already set to `public`.

## 6. Future releases (semver)

1. Bump version in `packages/accessflow/package.json` and update `CHANGELOG.md`.
2. Commit and push.
3. Tag and push:

```bash
git tag accessflow-v1.0.1
git push origin accessflow-v1.0.1
```

Tag format must be `accessflow-v*` (e.g. `accessflow-v1.1.0`).

## Verify after publish

```bash
npm view @axolassist/accessflow
npm install @axolassist/accessflow
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `402 Payment Required` on publish | Org missing or scoped package set private — use `--access public` or create free public org |
| `403 Forbidden` | Token lacks write access to `@axolassist` |
| GitHub Action fails on publish | Confirm `NPM_TOKEN` secret exists and matches a valid granular token |
| Provenance warning | Enable [npm provenance](https://docs.npmjs.com/generating-provenance-statements) — repo must be public and linked in `package.json` `repository` |
